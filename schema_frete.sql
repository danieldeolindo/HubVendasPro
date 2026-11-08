-- =====================================================
-- HubVendasPro — schema_frete.sql
-- Execute no SQL Editor do Supabase depois do schema
-- de Atendimento RT / histórico de clientes.
-- Inclui também horários da loja e solicitação de troco no catálogo.
-- =====================================================

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS isento_frete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE historico ADD COLUMN IF NOT EXISTS frete NUMERIC DEFAULT 0;
ALTER TABLE pedidos_rt ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
ALTER TABLE pedidos_rt ADD COLUMN IF NOT EXISTS desconto NUMERIC DEFAULT 0;
ALTER TABLE pedidos_rt ADD COLUMN IF NOT EXISTS frete NUMERIC DEFAULT 0;
ALTER TABLE pedidos_rt ADD COLUMN IF NOT EXISTS precisa_troco BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pedidos_rt ADD COLUMN IF NOT EXISTS troco_para NUMERIC;
DROP POLICY IF EXISTS "publico_insere_pedidos_rt" ON pedidos_rt;
DROP POLICY IF EXISTS "autenticado_insere_pedidos_rt" ON pedidos_rt;
REVOKE INSERT ON pedidos_rt FROM anon, authenticated;

CREATE OR REPLACE VIEW catalogo_publico AS
SELECT id, user_id, nome, preco, categoria, foto_url, estoque, isento_frete
FROM produtos;

GRANT SELECT ON catalogo_publico TO anon;
GRANT SELECT ON catalogo_publico TO authenticated;

CREATE OR REPLACE FUNCTION public.loja_esta_aberta(
  p_config JSONB,
  p_agora TIMESTAMPTZ DEFAULT now()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  status_manual TEXT;
  status_manual_ate TIMESTAMPTZ;
  horario_dia JSONB;
  agora_local TIMESTAMP;
  dia_semana INTEGER;
  abre TIME;
  fecha TIME;
BEGIN
  status_manual := p_config->>'status_manual';
  status_manual_ate := NULLIF(p_config->>'status_manual_ate', '')::timestamptz;
  IF status_manual IN ('aberto', 'fechado')
     AND (status_manual_ate IS NULL OR status_manual_ate > p_agora) THEN
    RETURN status_manual = 'aberto';
  END IF;

  IF COALESCE((p_config->>'horario_ativo')::boolean, FALSE) = FALSE THEN
    RETURN TRUE;
  END IF;

  agora_local := p_agora AT TIME ZONE 'America/Sao_Paulo';
  dia_semana := EXTRACT(DOW FROM agora_local);
  horario_dia := (p_config->'horario_funcionamento')->(dia_semana::text);
  IF COALESCE(horario_dia->>'aberto', 'false') <> 'true'
     OR COALESCE(horario_dia->>'abre', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     OR COALESCE(horario_dia->>'fecha', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RETURN FALSE;
  END IF;

  abre := (horario_dia->>'abre')::time;
  fecha := (horario_dia->>'fecha')::time;
  RETURN agora_local::time >= abre AND agora_local::time < fecha;
END;
$$;

REVOKE ALL ON FUNCTION public.loja_esta_aberta(JSONB, TIMESTAMPTZ) FROM PUBLIC;

-- Pedidos só podem ser criados pela RPC, que valida o horário da loja.
-- Remove versões anteriores para evitar ambiguidade com parâmetros opcionais.
DROP FUNCTION IF EXISTS public.criar_pedido_rt(UUID, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.criar_pedido_rt(UUID, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION public.criar_pedido_rt(
  p_loja_user_id UUID,
  p_cliente_nome TEXT,
  p_cliente_telefone TEXT,
  p_cliente_endereco TEXT,
  p_itens JSONB,
  p_total NUMERIC,
  p_pagamento TEXT DEFAULT 'dinheiro',
  p_pagamentos JSONB DEFAULT '{}',
  p_subtotal NUMERIC DEFAULT NULL,
  p_desconto NUMERIC DEFAULT 0,
  p_precisa_troco BOOLEAN DEFAULT FALSE,
  p_troco_para NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  novo_id UUID;
  telefone_normalizado TEXT;
  cliente_existente UUID;
  minimo_frete NUMERIC := 0;
  valor_frete NUMERIC := 0;
  frete_calculado NUMERIC := 0;
  total_calculado NUMERIC := 0;
  percentual_juros_cartao NUMERIC := 0;
  valor_cartao NUMERIC := 0;
  valor_dinheiro NUMERIC := 0;
  juros_cartao NUMERIC := 0;
  configuracao_loja JSONB;
  pagamentos_calculados JSONB := COALESCE(p_pagamentos, '{}'::jsonb);
  itens_com_custo JSONB := '[]'::jsonb;
  item_json JSONB;
  produto_id UUID;
  custo_produto NUMERIC;
  preco_produto NUMERIC;
  quantidade_item INTEGER;
  isento_frete_produto BOOLEAN;
  subtotal_itens_calculado NUMERIC := 0;
  subtotal_elegivel_frete NUMERIC := 0;
  desconto_elegivel_frete NUMERIC := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM config WHERE user_id = p_loja_user_id) THEN
    RAISE EXCEPTION 'Loja não encontrada';
  END IF;

  SELECT loja_config,
         COALESCE(NULLIF(loja_config->>'frete_minimo', '')::numeric, 0),
         COALESCE(NULLIF(loja_config->>'valor_frete', '')::numeric, 0),
         LEAST(100, GREATEST(0, COALESCE(NULLIF(loja_config->>'juros_cartao_percentual', '')::numeric, 0)))
  INTO configuracao_loja, minimo_frete, valor_frete, percentual_juros_cartao
  FROM config WHERE user_id = p_loja_user_id;
  IF NOT public.loja_esta_aberta(configuracao_loja, now()) THEN
    RAISE EXCEPTION 'A loja está fechada no momento';
  END IF;

  telefone_normalizado := regexp_replace(COALESCE(p_cliente_telefone, ''), '\D', '', 'g');
  IF left(telefone_normalizado, 2) = '55' AND length(telefone_normalizado) IN (12, 13) THEN
    telefone_normalizado := right(telefone_normalizado, length(telefone_normalizado) - 2);
  END IF;

  IF telefone_normalizado <> '' THEN
    SELECT id INTO cliente_existente
    FROM clientes
    WHERE user_id = p_loja_user_id
      AND regexp_replace(COALESCE(telefone, ''), '\D', '', 'g') IN (telefone_normalizado, '55' || telefone_normalizado)
      AND lower(trim(COALESCE(nome, ''))) = lower(COALESCE(NULLIF(trim(p_cliente_nome), ''), 'Cliente'))
    LIMIT 1;

    IF cliente_existente IS NULL THEN
      INSERT INTO clientes (user_id, nome, telefone, endereco)
      VALUES (
        p_loja_user_id,
        COALESCE(NULLIF(trim(p_cliente_nome), ''), 'Cliente'),
        COALESCE(p_cliente_telefone, ''),
        COALESCE(p_cliente_endereco, '')
      );
    ELSE
      UPDATE clientes
      SET nome = COALESCE(NULLIF(trim(p_cliente_nome), ''), nome),
          endereco = COALESCE(NULLIF(trim(p_cliente_endereco), ''), endereco)
      WHERE id = cliente_existente;
    END IF;
  END IF;

  IF jsonb_typeof(COALESCE(p_itens, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Itens do pedido inválidos';
  END IF;

  FOR item_json IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb))
  LOOP
    IF jsonb_typeof(item_json) <> 'object' THEN
      RAISE EXCEPTION 'Item do pedido inválido';
    END IF;

    BEGIN
      produto_id := NULLIF(item_json->>'produtoId', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Produto inválido no pedido';
    END;

    IF produto_id IS NULL THEN
      RAISE EXCEPTION 'Produto não identificado no pedido';
    END IF;

    quantidade_item := NULLIF(item_json->>'quantidade', '')::integer;
    IF quantidade_item IS NULL OR quantidade_item <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida no pedido';
    END IF;

    SELECT custo, preco, COALESCE(isento_frete, FALSE)
    INTO custo_produto, preco_produto, isento_frete_produto
    FROM produtos
    WHERE id = produto_id AND user_id = p_loja_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto do pedido não encontrado';
    END IF;

    subtotal_itens_calculado := subtotal_itens_calculado + preco_produto * quantidade_item;
    IF NOT isento_frete_produto THEN
      subtotal_elegivel_frete := subtotal_elegivel_frete + preco_produto * quantidade_item;
    END IF;

    itens_com_custo := itens_com_custo || jsonb_build_array(
      item_json || jsonb_build_object(
        'custo', COALESCE(custo_produto, 0),
        'isentoFrete', isento_frete_produto
      )
    );
  END LOOP;

  IF subtotal_itens_calculado > 0 THEN
    desconto_elegivel_frete := ROUND(LEAST(
      GREATEST(COALESCE(p_desconto, 0), 0),
      subtotal_itens_calculado
    ) * subtotal_elegivel_frete / subtotal_itens_calculado, 2);
  END IF;

  IF minimo_frete > 0 AND valor_frete > 0 AND subtotal_elegivel_frete > 0
     AND GREATEST(0, subtotal_elegivel_frete - desconto_elegivel_frete) < minimo_frete THEN
    frete_calculado := valor_frete;
  END IF;
  total_calculado := GREATEST(0, COALESCE(p_subtotal, p_total, 0) - COALESCE(p_desconto, 0)) + frete_calculado;
  IF jsonb_typeof(pagamentos_calculados) = 'object' AND percentual_juros_cartao > 0 THEN
    valor_cartao := GREATEST(0, COALESCE(NULLIF(pagamentos_calculados->>'cartao', '')::numeric, 0));
    juros_cartao := ROUND(valor_cartao * percentual_juros_cartao / 100, 2);
    IF juros_cartao > 0 THEN
      pagamentos_calculados := jsonb_set(pagamentos_calculados, '{cartao}', to_jsonb(valor_cartao + juros_cartao), true);
      total_calculado := total_calculado + juros_cartao;
    END IF;
  END IF;
  IF p_precisa_troco THEN
    valor_dinheiro := GREATEST(0, COALESCE(NULLIF(pagamentos_calculados->>'dinheiro', '')::numeric, 0));
    IF valor_dinheiro <= 0 OR p_troco_para IS NULL OR p_troco_para <= valor_dinheiro THEN
      RAISE EXCEPTION 'Informe um valor válido para o troco';
    END IF;
  END IF;

  INSERT INTO pedidos_rt (
    loja_user_id, cliente_nome, cliente_telefone, cliente_endereco, itens,
    subtotal, desconto, frete, total, pagamento, pagamentos, precisa_troco, troco_para, status
  )
  VALUES (
    p_loja_user_id,
    COALESCE(NULLIF(trim(p_cliente_nome), ''), 'Cliente'),
    COALESCE(p_cliente_telefone, ''),
    COALESCE(p_cliente_endereco, ''),
    itens_com_custo,
    COALESCE(p_subtotal, p_total, 0),
    COALESCE(p_desconto, 0),
    frete_calculado,
    total_calculado,
    COALESCE(NULLIF(p_pagamento, ''), 'dinheiro'),
    pagamentos_calculados,
    COALESCE(p_precisa_troco, FALSE),
    CASE WHEN p_precisa_troco THEN p_troco_para ELSE NULL END,
    'novo'
  )
  RETURNING id INTO novo_id;

  RETURN novo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_pedido_rt(UUID, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC, BOOLEAN, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_pedido_rt(UUID, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC, BOOLEAN, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION public.criar_pedido_rt(UUID, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC, BOOLEAN, NUMERIC) TO authenticated;

-- Os campos novos são acrescentados ao fim para preservar as colunas da view existente.
CREATE OR REPLACE VIEW loja_publica AS
SELECT
  user_id,
  loja_config->>'nome' AS nome,
  loja_config->>'cor' AS cor,
  loja_config->>'whatsapp' AS whatsapp,
  catalogo_produtos,
  loja_config->>'fonte' AS fonte,
  avatar_url,
  loja_config->>'cupom_codigo' AS cupom_codigo,
  loja_config->>'cupom_percentual' AS cupom_percentual,
  COALESCE(NULLIF(loja_config->>'frete_minimo', '')::numeric, 0) AS frete_minimo,
  COALESCE(NULLIF(loja_config->>'valor_frete', '')::numeric, 0) AS valor_frete,
  COALESCE(NULLIF(loja_config->>'juros_cartao_percentual', '')::numeric, 0) AS juros_cartao_percentual,
  COALESCE((loja_config->>'horario_ativo')::boolean, FALSE) AS horario_ativo,
  loja_config->'horario_funcionamento' AS horario_funcionamento,
  loja_config->>'status_manual' AS status_manual,
  loja_config->>'status_manual_ate' AS status_manual_ate
FROM config;

GRANT SELECT ON loja_publica TO anon;
GRANT SELECT ON loja_publica TO authenticated;

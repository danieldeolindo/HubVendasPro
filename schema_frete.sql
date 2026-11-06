-- =====================================================
-- HubVendasPro — schema_frete.sql
-- Execute no SQL Editor do Supabase depois do schema
-- de Atendimento RT / histórico de clientes.
-- =====================================================

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS isento_frete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE historico ADD COLUMN IF NOT EXISTS frete NUMERIC DEFAULT 0;
ALTER TABLE pedidos_rt ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
ALTER TABLE pedidos_rt ADD COLUMN IF NOT EXISTS desconto NUMERIC DEFAULT 0;
ALTER TABLE pedidos_rt ADD COLUMN IF NOT EXISTS frete NUMERIC DEFAULT 0;

CREATE OR REPLACE VIEW catalogo_publico AS
SELECT id, user_id, nome, preco, categoria, foto_url, estoque, isento_frete
FROM produtos;

GRANT SELECT ON catalogo_publico TO anon;
GRANT SELECT ON catalogo_publico TO authenticated;

-- Remove a versão anterior para evitar ambiguidade com os parâmetros opcionais.
DROP FUNCTION IF EXISTS public.criar_pedido_rt(UUID, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB);

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
  p_desconto NUMERIC DEFAULT 0
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
  juros_cartao NUMERIC := 0;
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

  SELECT COALESCE(NULLIF(loja_config->>'frete_minimo', '')::numeric, 0),
         COALESCE(NULLIF(loja_config->>'valor_frete', '')::numeric, 0),
         LEAST(100, GREATEST(0, COALESCE(NULLIF(loja_config->>'juros_cartao_percentual', '')::numeric, 0)))
  INTO minimo_frete, valor_frete, percentual_juros_cartao
  FROM config WHERE user_id = p_loja_user_id;

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

  INSERT INTO pedidos_rt (
    loja_user_id, cliente_nome, cliente_telefone, cliente_endereco, itens,
    subtotal, desconto, frete, total, pagamento, pagamentos, status
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
    'novo'
  )
  RETURNING id INTO novo_id;

  RETURN novo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_pedido_rt(UUID, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_pedido_rt(UUID, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION public.criar_pedido_rt(UUID, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC) TO authenticated;

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
  COALESCE(NULLIF(loja_config->>'juros_cartao_percentual', '')::numeric, 0) AS juros_cartao_percentual
FROM config;

GRANT SELECT ON loja_publica TO anon;
GRANT SELECT ON loja_publica TO authenticated;

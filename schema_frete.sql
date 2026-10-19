-- =====================================================
-- HubVendasPro — schema_frete.sql
-- Execute no SQL Editor do Supabase depois do schema
-- de Atendimento RT / histórico de clientes.
-- =====================================================

ALTER TABLE historico ADD COLUMN IF NOT EXISTS frete NUMERIC DEFAULT 0;
ALTER TABLE pedidos_rt ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
ALTER TABLE pedidos_rt ADD COLUMN IF NOT EXISTS desconto NUMERIC DEFAULT 0;
ALTER TABLE pedidos_rt ADD COLUMN IF NOT EXISTS frete NUMERIC DEFAULT 0;

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
BEGIN
  IF NOT EXISTS (SELECT 1 FROM config WHERE user_id = p_loja_user_id) THEN
    RAISE EXCEPTION 'Loja não encontrada';
  END IF;

  SELECT COALESCE(NULLIF(loja_config->>'frete_minimo', '')::numeric, 0),
         COALESCE(NULLIF(loja_config->>'valor_frete', '')::numeric, 0)
  INTO minimo_frete, valor_frete
  FROM config WHERE user_id = p_loja_user_id;

  IF minimo_frete > 0 AND valor_frete > 0
     AND GREATEST(0, COALESCE(p_subtotal, p_total, 0) - COALESCE(p_desconto, 0)) < minimo_frete THEN
    frete_calculado := valor_frete;
  END IF;
  total_calculado := GREATEST(0, COALESCE(p_subtotal, p_total, 0) - COALESCE(p_desconto, 0)) + frete_calculado;

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

  INSERT INTO pedidos_rt (
    loja_user_id, cliente_nome, cliente_telefone, cliente_endereco, itens,
    subtotal, desconto, frete, total, pagamento, pagamentos, status
  )
  VALUES (
    p_loja_user_id,
    COALESCE(NULLIF(trim(p_cliente_nome), ''), 'Cliente'),
    COALESCE(p_cliente_telefone, ''),
    COALESCE(p_cliente_endereco, ''),
    COALESCE(p_itens, '[]'::jsonb),
    COALESCE(p_subtotal, p_total, 0),
    COALESCE(p_desconto, 0),
    frete_calculado,
    total_calculado,
    COALESCE(NULLIF(p_pagamento, ''), 'dinheiro'),
    COALESCE(p_pagamentos, '{}'::jsonb),
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
  COALESCE(NULLIF(loja_config->>'valor_frete', '')::numeric, 0) AS valor_frete
FROM config;

GRANT SELECT ON loja_publica TO anon;
GRANT SELECT ON loja_publica TO authenticated;

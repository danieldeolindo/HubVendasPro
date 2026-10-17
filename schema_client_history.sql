-- =====================================================
-- HubVendasPro — schema_client_history.sql
-- Execute no SQL Editor do Supabase em bancos existentes.
-- =====================================================

-- Guarda o vínculo do cliente e o telefone em cada venda.
ALTER TABLE historico DROP CONSTRAINT IF EXISTS historico_cliente_id_fkey;
ALTER TABLE historico ALTER COLUMN cliente_id TYPE TEXT USING cliente_id::text;
ALTER TABLE historico ADD COLUMN IF NOT EXISTS cliente_telefone TEXT DEFAULT '';

-- Pedidos com o mesmo telefone e nomes diferentes representam clientes diferentes.
CREATE OR REPLACE FUNCTION public.criar_pedido_rt(
  p_loja_user_id UUID,
  p_cliente_nome TEXT,
  p_cliente_telefone TEXT,
  p_cliente_endereco TEXT,
  p_itens JSONB,
  p_total NUMERIC,
  p_pagamento TEXT DEFAULT 'dinheiro',
  p_pagamentos JSONB DEFAULT '{}'
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
BEGIN
  IF NOT EXISTS (SELECT 1 FROM config WHERE user_id = p_loja_user_id) THEN
    RAISE EXCEPTION 'Loja não encontrada';
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

  INSERT INTO pedidos_rt (
    loja_user_id, cliente_nome, cliente_telefone, cliente_endereco,
    itens, total, pagamento, pagamentos, status
  )
  VALUES (
    p_loja_user_id,
    COALESCE(NULLIF(trim(p_cliente_nome), ''), 'Cliente'),
    COALESCE(p_cliente_telefone, ''),
    COALESCE(p_cliente_endereco, ''),
    COALESCE(p_itens, '[]'::jsonb),
    COALESCE(p_total, 0),
    COALESCE(NULLIF(p_pagamento, ''), 'dinheiro'),
    COALESCE(p_pagamentos, '{}'::jsonb),
    'novo'
  )
  RETURNING id INTO novo_id;
  RETURN novo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_pedido_rt(UUID, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_pedido_rt(UUID, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.criar_pedido_rt(UUID, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB) TO authenticated;

-- =====================================================
--  HubVendasPro — schema_atendimento_rt_v2.sql
--  Execute no SQL Editor do Supabase DEPOIS do
--  schema_atendimento_rt.sql.
--
--  Adiciona: split de pagamento nos pedidos_rt, e mais
--  campos na view pública (fonte + avatar) para a página
--  do catálogo poder usar a identidade visual da loja.
-- =====================================================

-- Pedido pode ter mais de uma forma de pagamento (igual à aba Vendas)
ALTER TABLE pedidos_rt ADD COLUMN IF NOT EXISTS pagamentos JSONB DEFAULT '{}';
ALTER TABLE config ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';

CREATE OR REPLACE FUNCTION public.criar_pedido_rt(
  p_loja_user_id UUID,
  p_cliente_nome TEXT,
  p_cliente_telefone TEXT,
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
BEGIN
  IF NOT EXISTS (SELECT 1 FROM config WHERE user_id = p_loja_user_id) THEN
    RAISE EXCEPTION 'Loja não encontrada';
  END IF;
  INSERT INTO pedidos_rt (loja_user_id, cliente_nome, cliente_telefone, itens, total, pagamento, pagamentos, status)
  VALUES (p_loja_user_id, COALESCE(NULLIF(trim(p_cliente_nome), ''), 'Cliente'), COALESCE(p_cliente_telefone, ''), COALESCE(p_itens, '[]'::jsonb), COALESCE(p_total, 0), COALESCE(NULLIF(p_pagamento, ''), 'dinheiro'), COALESCE(p_pagamentos, '{}'::jsonb), 'novo')
  RETURNING id INTO novo_id;
  RETURN novo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_pedido_rt(UUID, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_pedido_rt(UUID, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.criar_pedido_rt(UUID, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB) TO authenticated;

GRANT INSERT ON pedidos_rt TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE ON pedidos_rt TO authenticated;

-- Recria a view pública incluindo fonte e avatar da loja.
-- IMPORTANTE: novas colunas vão sempre no final, sem remover/reordenar
-- as existentes — é uma exigência do Postgres para CREATE OR REPLACE VIEW.
CREATE OR REPLACE VIEW loja_publica AS
SELECT
  user_id,
  loja_config->>'nome'      AS nome,
  loja_config->>'cor'       AS cor,
  loja_config->>'whatsapp'  AS whatsapp,
  catalogo_produtos,
  loja_config->>'fonte'     AS fonte,
  avatar_url,
  loja_config->>'cupom_codigo' AS cupom_codigo,
  loja_config->>'cupom_percentual' AS cupom_percentual
FROM config;

GRANT SELECT ON loja_publica TO anon;
GRANT SELECT ON loja_publica TO authenticated;

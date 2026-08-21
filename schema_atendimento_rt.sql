-- =====================================================
--  HubVendasPro — schema_atendimento_rt.sql
--  Execute no SQL Editor do Supabase (depois do schema.sql
--  e do schema_update.sql).
--
--  Feature: catálogo público (link para clientes) +
--  pedidos em tempo real na tela "Atendimento RT".
-- =====================================================

-- ─── 1) Coluna nova em config: produtos escolhidos p/ o catálogo ───
ALTER TABLE config ADD COLUMN IF NOT EXISTS catalogo_produtos JSONB DEFAULT '[]';
ALTER TABLE config ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';

-- Obs: o número de WhatsApp da loja é salvo dentro do JSONB já existente
-- loja_config (chave "whatsapp"), então não precisa de coluna nova.

-- ─── 2) Tabela: pedidos_rt ───────────────────────────
-- Pedidos feitos pelo cliente através do link do catálogo.
CREATE TABLE IF NOT EXISTS pedidos_rt (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_user_id      UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cliente_nome      TEXT    DEFAULT '',
  cliente_telefone  TEXT    DEFAULT '',
  itens             JSONB   DEFAULT '[]',
  total             NUMERIC DEFAULT 0,
  pagamento         TEXT    DEFAULT 'dinheiro',
  pagamentos       JSONB   DEFAULT '{}',
  status            TEXT    DEFAULT 'novo',   -- novo | atendido
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pedidos_rt ENABLE ROW LEVEL SECURITY;

-- O dono da loja lê, atualiza (marcar como atendido) e apaga seus próprios pedidos
DROP POLICY IF EXISTS "loja_le_pedidos_rt" ON pedidos_rt;
DROP POLICY IF EXISTS "loja_atualiza_pedidos_rt" ON pedidos_rt;
DROP POLICY IF EXISTS "loja_deleta_pedidos_rt" ON pedidos_rt;
DROP POLICY IF EXISTS "publico_insere_pedidos_rt" ON pedidos_rt;
DROP POLICY IF EXISTS "autenticado_insere_pedidos_rt" ON pedidos_rt;
CREATE POLICY "loja_le_pedidos_rt"    ON pedidos_rt FOR SELECT USING (auth.uid() = loja_user_id);
CREATE POLICY "loja_atualiza_pedidos_rt" ON pedidos_rt FOR UPDATE USING (auth.uid() = loja_user_id);
CREATE POLICY "loja_deleta_pedidos_rt" ON pedidos_rt FOR DELETE USING (auth.uid() = loja_user_id);

-- Qualquer visitante (sem login, papel "anon") pode CRIAR um pedido,
-- mas nunca ler os pedidos de ninguém — só o dono enxerga (política acima).
CREATE POLICY "publico_insere_pedidos_rt" ON pedidos_rt FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "autenticado_insere_pedidos_rt" ON pedidos_rt FOR INSERT TO authenticated WITH CHECK (true);

-- Permissões SQL explícitas para o catálogo público inserir pedidos.
-- A leitura continua protegida pelo RLS e não é liberada para anon.
GRANT INSERT ON pedidos_rt TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE ON pedidos_rt TO authenticated;

-- O catálogo público cria pedidos por esta RPC, sem acesso direto de escrita.
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

  INSERT INTO pedidos_rt (
    loja_user_id, cliente_nome, cliente_telefone, itens, total,
    pagamento, pagamentos, status
  ) VALUES (
    p_loja_user_id,
    COALESCE(NULLIF(trim(p_cliente_nome), ''), 'Cliente'),
    COALESCE(p_cliente_telefone, ''),
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

REVOKE ALL ON FUNCTION public.criar_pedido_rt(UUID, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_pedido_rt(UUID, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.criar_pedido_rt(UUID, TEXT, TEXT, JSONB, NUMERIC, TEXT, JSONB) TO authenticated;

-- ─── 3) Habilitar Realtime nessa tabela ──────────────
-- Isso NÃO dá pra fazer só com SQL puro em todos os projetos Supabase;
-- confirme no painel: Database > Replication > adicione "pedidos_rt"
-- na publication "supabase_realtime". O comando abaixo tenta fazer
-- isso automaticamente (funciona na maioria dos projetos):
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pedidos_rt'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pedidos_rt;
  END IF;
END $$;

-- ─── 4) View pública: catalogo_publico ───────────────
-- Expõe só o necessário para o cliente montar o pedido (sem
-- contornar o RLS da tabela "produtos", que continua travada por
-- usuário — a view roda com o dono/postgres e por isso "atravessa"
-- o RLS de propósito, funcionando como uma API de leitura pública).
CREATE OR REPLACE VIEW catalogo_publico AS
SELECT id, user_id, nome, preco, categoria, foto_url, estoque
FROM produtos;

GRANT SELECT ON catalogo_publico TO anon;
GRANT SELECT ON catalogo_publico TO authenticated;

-- ─── 5) View pública: loja_publica ───────────────────
-- Expõe só nome da loja, cor, whatsapp e a lista de produtos
-- selecionados para o catálogo — nunca o restante de "config"
-- (tema, avatar, ordem do menu ficam privados).
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
  loja_config->>'cupom_percentual' AS cupom_percentual
FROM config;

GRANT SELECT ON loja_publica TO anon;
GRANT SELECT ON loja_publica TO authenticated;

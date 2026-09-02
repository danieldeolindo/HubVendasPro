-- =====================================================
--  HubVendasPro — schema.sql (Supabase Edition)
--  Execute no SQL Editor do seu projeto Supabase
-- =====================================================

-- ─── TABELA: produtos ────────────────────────────────
CREATE TABLE IF NOT EXISTS produtos (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  internal_id   BIGINT,          -- id numérico original (Date.now)
  sku_id        INT,
  nome          TEXT    NOT NULL,
  preco         NUMERIC NOT NULL,
  custo         NUMERIC DEFAULT 0,
  estoque       INTEGER DEFAULT 0,
  categoria     TEXT    DEFAULT '',
  foto_key      TEXT    DEFAULT '',  -- chave do IndexedDB (mantida para compatibilidade)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABELA: clientes ────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  internal_id   INT,             -- id numérico sequencial original
  nome          TEXT    DEFAULT '',
  telefone      TEXT    DEFAULT '',
  cpf           TEXT    DEFAULT '',
  email         TEXT    DEFAULT '',
  endereco      TEXT    DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABELA: historico ───────────────────────────────
CREATE TABLE IF NOT EXISTS historico (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  internal_id   BIGINT,          -- id numérico original (Date.now)
  data          TEXT,            -- formato dd/mm/yyyy
  hora          TEXT,            -- formato hh:mm
  itens         JSONB   DEFAULT '[]',
  subtotal      NUMERIC DEFAULT 0,
  desconto      NUMERIC DEFAULT 0,
  total         NUMERIC DEFAULT 0,
  pagamento     TEXT    DEFAULT 'dinheiro',
  pagamentos    JSONB   DEFAULT '{}',
  cliente_id    INT,
  cliente_nome  TEXT    DEFAULT '',
  cancelada     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABELA: config ──────────────────────────────────
CREATE TABLE IF NOT EXISTS config (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID    REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  tema          TEXT    DEFAULT 'light',
  loja_config   JSONB   DEFAULT '{"nome":"","cor":"#00bf63","fonte":"jakarta"}',
  menu_ordem    JSONB,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ROW LEVEL SECURITY ──────────────────────────────
ALTER TABLE produtos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE config    ENABLE ROW LEVEL SECURITY;

-- Políticas: cada usuário só acessa seus próprios dados
CREATE POLICY "user_produtos"  ON produtos  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_clientes"  ON clientes  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_historico" ON historico FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_config"    ON config    FOR ALL USING (auth.uid() = user_id);

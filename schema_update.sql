-- =====================================================
--  HubVendasPro — schema_update.sql
--  Execute no SQL Editor do Supabase APENAS SE JÁ
--  tiver rodado o schema.sql anteriormente.
--  Se estiver começando do zero, use o schema.sql
--  completo abaixo.
-- =====================================================

-- Adiciona coluna foto_url na tabela produtos (se não existir)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS foto_url TEXT DEFAULT '';
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS custo NUMERIC DEFAULT 0;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque INTEGER DEFAULT 0;

-- =====================================================
--  SCHEMA COMPLETO (do zero) — pode usar no lugar do
--  schema.sql original, já inclui foto_url
-- =====================================================

-- CREATE TABLE IF NOT EXISTS produtos (
--   id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
--   user_id       UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
--   internal_id   BIGINT,
--   sku_id        INT,
--   nome          TEXT    NOT NULL,
--   preco         NUMERIC NOT NULL,
--   categoria     TEXT    DEFAULT '',
--   foto_key      TEXT    DEFAULT '',
--   foto_url      TEXT    DEFAULT '',
--   created_at    TIMESTAMPTZ DEFAULT NOW()
-- );

-- =====================================================
--  STORAGE — Criar bucket para fotos de produtos
--  Execute também no SQL Editor
-- =====================================================

-- Cria o bucket "fotos" se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos', 'fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Política: usuário autenticado pode fazer upload na sua pasta
CREATE POLICY "upload_fotos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Política: leitura pública das fotos
CREATE POLICY "leitura_fotos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'fotos');

-- Política: usuário pode deletar suas próprias fotos
CREATE POLICY "deletar_fotos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

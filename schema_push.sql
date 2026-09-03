-- Execute no SQL Editor do Supabase.
-- Armazena uma inscrição por celular/navegador da loja.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lojista_gerencia_push" ON push_subscriptions;
CREATE POLICY "lojista_gerencia_push"
  ON push_subscriptions FOR ALL
  TO authenticated
  USING (auth.uid() = loja_user_id)
  WITH CHECK (auth.uid() = loja_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;

-- Dispara a Edge Function automaticamente após cada pedido do catálogo.
-- Substitua o valor pelo mesmo WEBHOOK_SECRET configurado na Edge Function.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.disparar_push_novo_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://ykfvccrfylnlbooqdrvu.supabase.co/functions/v1/notify-new-order',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'sb_publishable_b-74GmHr8Oki_wekagD-zA_xaR-V8b7'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'pedidos_rt',
      'schema', 'public',
      'record', to_jsonb(NEW)
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_push_novo_pedido ON public.pedidos_rt;

CREATE TRIGGER trigger_push_novo_pedido
AFTER INSERT ON public.pedidos_rt
FOR EACH ROW
EXECUTE FUNCTION public.disparar_push_novo_pedido();

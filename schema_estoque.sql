-- =====================================================
-- HubVendasPro — schema_estoque.sql
-- Execute no SQL Editor do Supabase depois de
-- schema_atendimento_rt.sql e schema_frete.sql.
-- Aplica ajustes de estoque de forma atômica, sem gravar
-- quantidades antigas vindas de outras sessões. Pedidos do
-- catálogo também baixam o estoque na mesma transação.
-- =====================================================

CREATE OR REPLACE FUNCTION public.ajustar_estoque_produtos(p_ajustes JSONB)
RETURNS TABLE(produto_id UUID, estoque INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  ajuste JSONB;
  ajuste_produto_id UUID;
  delta_estoque INTEGER;
  estoque_atual INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF jsonb_typeof(p_ajustes) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Ajustes de estoque inválidos';
  END IF;
  IF jsonb_array_length(p_ajustes) = 0 THEN
    RAISE EXCEPTION 'Ajustes de estoque inválidos';
  END IF;

  FOR ajuste IN SELECT value FROM jsonb_array_elements(p_ajustes)
  LOOP
    BEGIN
      ajuste_produto_id := NULLIF(ajuste->>'produto_id', '')::UUID;
      delta_estoque := NULLIF(ajuste->>'delta', '')::INTEGER;
    EXCEPTION
      WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'Ajuste de estoque inválido';
    END;

    IF ajuste_produto_id IS NULL OR delta_estoque IS NULL OR delta_estoque = 0 THEN
      RAISE EXCEPTION 'Ajuste de estoque inválido';
    END IF;

    UPDATE public.produtos AS p
    SET estoque = COALESCE(p.estoque, 0) + delta_estoque
    WHERE p.id = ajuste_produto_id
      AND p.user_id = auth.uid()
      AND COALESCE(p.estoque, 0) + delta_estoque >= 0
    RETURNING p.estoque INTO estoque_atual;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Estoque insuficiente ou produto não encontrado';
    END IF;

    produto_id := ajuste_produto_id;
    estoque := estoque_atual;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.ajustar_estoque_produtos(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ajustar_estoque_produtos(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.ajustar_estoque_pedido_rt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_json JSONB;
  produto_id UUID;
  quantidade INTEGER;
  variacao INTEGER;
  estoque_atual INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS NOT DISTINCT FROM 'cancelado' OR NEW.status IS DISTINCT FROM 'cancelado' THEN
      RETURN NEW;
    END IF;
    variacao := 1;
  ELSE
    variacao := -1;
  END IF;

  IF jsonb_typeof(NEW.itens) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.itens) = 0 THEN
    RAISE EXCEPTION 'Itens do pedido inválidos';
  END IF;

  FOR item_json IN SELECT value FROM jsonb_array_elements(NEW.itens)
  LOOP
    IF jsonb_typeof(item_json) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Item do pedido inválido';
    END IF;

    BEGIN
      produto_id := NULLIF(item_json->>'produtoId', '')::UUID;
      quantidade := NULLIF(item_json->>'quantidade', '')::INTEGER;
    EXCEPTION
      WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'Produto ou quantidade inválidos no pedido';
    END;

    IF produto_id IS NULL OR quantidade IS NULL OR quantidade <= 0 THEN
      RAISE EXCEPTION 'Produto ou quantidade inválidos no pedido';
    END IF;

    UPDATE public.produtos AS p
    SET estoque = COALESCE(p.estoque, 0) + (quantidade * variacao)
    WHERE p.id = produto_id
      AND p.user_id = NEW.loja_user_id
      AND COALESCE(p.estoque, 0) + (quantidade * variacao) >= 0
    RETURNING p.estoque INTO estoque_atual;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Estoque insuficiente ou produto não encontrado: %', produto_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ajustar_estoque_pedido_rt() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_ajustar_estoque_pedido_rt ON public.pedidos_rt;
CREATE TRIGGER trigger_ajustar_estoque_pedido_rt
AFTER INSERT OR UPDATE ON public.pedidos_rt
FOR EACH ROW
EXECUTE FUNCTION public.ajustar_estoque_pedido_rt();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'produtos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos;
  END IF;
END $$;

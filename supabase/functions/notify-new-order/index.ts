import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async request => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (webhookSecret && request.headers.get("x-webhook-secret") !== webhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) throw new Error("Secrets VAPID não configurados");
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    const payload = await request.json();
    const pedido = payload.record;
    if (payload.type !== "INSERT" || payload.table !== "pedidos_rt" || !pedido?.loja_user_id) {
      return Response.json({ ignored: true });
    }

    const { data: inscricoes, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("loja_user_id", pedido.loja_user_id);
    if (error) throw error;

    const mensagem = JSON.stringify({
      title: "Novo pedido recebido",
      body: `${pedido.cliente_nome || "Cliente"} · R$ ${Number(pedido.total || 0).toFixed(2).replace(".", ",")}`,
      tag: `pedido-${pedido.id}`,
      url: "/",
    });
    const removidas: string[] = [];
    await Promise.all((inscricoes || []).map(async inscricao => {
      try {
        await webpush.sendNotification({ endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } }, mensagem, { TTL: 60, urgency: "high" });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) removidas.push(inscricao.id);
        else console.error("Falha ao enviar push", error);
      }
    }));
    if (removidas.length) await supabase.from("push_subscriptions").delete().in("id", removidas);
    return Response.json({ sent: (inscricoes || []).length - removidas.length });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Falha ao enviar notificações" }, { status: 500 });
  }
});

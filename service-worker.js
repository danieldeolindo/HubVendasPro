const CACHE_NAME = "hubvendaspro-v2";
const APP_SHELL = ["./", "./index.html", "./style.css", "./script.js", "./manifest.json", "./favicon/logo.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).then(response => {
      const copia = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copia));
      return response;
    }).catch(() => caches.match(event.request))
  );
});

self.addEventListener("push", event => {
  let dados = {};
  try { dados = event.data ? event.data.json() : {}; } catch { dados = { body: event.data?.text() || "Novo pedido recebido" }; }
  const opcoes = {
    body: dados.body || "Um novo pedido foi recebido.",
    tag: dados.tag || "novo-pedido",
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [400, 100, 400, 100, 700],
    icon: "favicon/logo.png",
    badge: "favicon/logo.png",
    data: { url: dados.url || "./" },
  };
  event.waitUntil(self.registration.showNotification(dados.title || "Novo pedido recebido", opcoes));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      const cliente = clients.find(item => "focus" in item);
      return cliente ? cliente.focus() : self.clients.openWindow(event.notification.data?.url || "./");
    })
  );
});

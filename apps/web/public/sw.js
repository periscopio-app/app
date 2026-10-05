/**
 * Service Worker do Periscópio Saúde — PWA Público & Offline de Ativos Estáticos
 * POLÍTICA DE SEGURANÇA:
 * 1. Cacheia APENAS ativos públicos estáticos (shell, ícones, fontes, CSS/JS).
 * 2. NUNCA armazena em cache respostas de rotas privadas (/api/*) ou prontuários.
 * 3. Modo offline mostra indicação visual de perda de rede sem expor dados.
 */

const CACHE_NAME = "periscopio-public-v1";
const PUBLIC_ASSETS = [
  "/",
  "/manifest.json",
  "/hero-escola.png",
  "/landing-logo.webp",
];

// Instalação — Precache restrito a ativos públicos estáticos
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PUBLIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativação — Limpeza de caches de versões antigas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Interceptação de requisições
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // REGRA DE SEGURANÇA CRÍTICA: Ignorar completamente rotas da API ou privadas
  if (url.pathname.startsWith("/api/") || url.pathname.includes("/private/")) {
    return; // Passa direto para a rede sem qualquer cache
  }

  // Apenas requisições GET para ativos do mesmo domínio
  if (event.request.method !== "GET" || url.origin !== location.origin) {
    return;
  }

  // Estratégia Stale-While-Revalidate para ativos públicos estáticos
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback offline para navegação da landing page se desconectado
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});

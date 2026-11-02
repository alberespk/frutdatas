// Service worker do FrutDatas: guarda o app no celular para abrir sem internet.
// A lista ARQUIVOS e a VERSAO são preenchidas no build (scripts/gerar-sw.mjs).
const VERSAO = "__VERSAO__";
const ARQUIVOS = __ARQUIVOS__;
const CACHE = `frutdatas-${VERSAO}`;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  const url = new URL(req.url);
  // Dados (Supabase) nunca passam pelo cache: o app usa o banco local quando está offline.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    // Páginas: tenta a rede; sem internet, usa a cópia guardada.
    evento.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
          return resp;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          const caminho = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
          return (
            (await cache.match(req, { ignoreSearch: true })) ||
            (await cache.match(`${caminho}index.html`)) ||
            (await cache.match("/index.html"))
          );
        }),
    );
    return;
  }

  // Arquivos estáticos (JS, CSS, fontes, ícones): cache primeiro.
  evento.respondWith(
    caches.match(req).then(
      (achado) =>
        achado ||
        fetch(req).then((resp) => {
          if (resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return resp;
        }),
    ),
  );
});

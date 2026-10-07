// Service worker of the browser version (added to the site root by tools/build_site.py; the local program does not use it).
// After the first visit the whole program works offline: the app files are fetched from the network first (so a new
// version is picked up as soon as there is one) and the big, rarely changing ones (Pyodide, Ketcher) come from the cache.
const APP = "qqq-app-__APP__", BIG = "qqq-big-__BIG__";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith("qqq-") && k !== APP && k !== BIG) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || req.headers.has("range")) return;
  const big = /\/static\/(pyodide|vendor)\//.test(url.pathname);
  e.respondWith((async () => {
    const cache = await caches.open(big ? BIG : APP);
    if (big) { const hit = await cache.match(req); if (hit) return hit; }
    try {
      const res = await fetch(req, big ? undefined : { cache: "no-cache" }); // revalidate: GitHub Pages sends max-age=600
      if (res.status === 200) { try { await cache.put(req, res.clone()); } catch (_) { /* storage full: serve anyway */ } }
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});

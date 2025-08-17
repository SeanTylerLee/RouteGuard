// sw.js (minimal cache for installability)
const CACHE = "routeguard-v1";
const ASSETS = [
  "/", "/index.html", "/styles.css", "/app.js", "/manifest.json",
  "/RouteGuard_192x192_Android.png",
  "/RouteGuard_512x512_PlayStore.png",
  "/RouteGuard_180x180_iPhone.png",
  "/RouteGuard_167x167_iPadPro.png",
  "/RouteGuard_152x152_iPad.png",
  "/RouteGuard_120x120_iPhone.png",
  "/RouteGuard_1024x1024_AppStore.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
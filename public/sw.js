// Service Worker for Burjolevelup PWA
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Passthrough fetch handler to satisfy PWA installability requirements
  // without caching dynamic API / database requests.
});

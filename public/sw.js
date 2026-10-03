'use strict';
// Lets the site open instantly, work offline with the last stories, and be installed on a phone.
const CACHE = 'top10news-v1';
const SHELL = ['./', 'index.html', 'about.html', 'style.css', 'app.js', 'favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isData = /\/data\/|feed\.xml$/.test(req.url);
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (isData) return (await network) || cached || Response.error(); // fresh data first
    return cached || (await network) || Response.error();               // page shell: instant, refreshed in background
  })());
});

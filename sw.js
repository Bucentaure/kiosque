/* Kiosque — service worker : rend l'app disponible hors ligne.
   Stratégie : réseau d'abord (pour toujours servir la dernière version),
   repli sur le cache quand il n'y a pas de connexion. */
const CACHE = 'kiosque-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  /* On ne gère que notre propre site en GET : les appels vers Google,
     les relais CORS et les sites d'articles passent en direct. */
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(resp => {
        /* Ne jamais avaler une page d'erreur (404 si le site est indisponible) :
           on retombe sur la copie locale de l'app. */
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return resp;
      })
      .catch(() =>
        caches.match(e.request).then(hit => hit || caches.match('./index.html'))
      )
  );
});

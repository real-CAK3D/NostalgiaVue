// App-shell cache so NostalgiaVue opens instantly and works as an installed app.
// Video, archive.org, YouTube and Bridge traffic always go straight to the network.
const CACHE = 'nostalgiavue-v1';
const SHELL = ['./', 'index.html', 'games.html', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png',
  'css/base.css', 'css/sets.css', 'css/screen.css', 'css/ui.css',
  'js/app.js', 'js/util.js', 'js/store.js', 'js/lineup.js', 'js/icons.js', 'js/sound.js', 'js/logo.js', 'js/osd.js',
  'js/player.js', 'js/guide.js', 'js/menu.js', 'js/sets.js', 'js/ads.js', 'js/games.js',
  'js/sources/archive.js', 'js/sources/youtube.js', 'js/sources/local.js', 'js/sources/special.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // network first so updates show up; fall back to the cached shell offline
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});

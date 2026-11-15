/* Offline shell for the game. Bump VERSION with package.json and CHANGELOG.md on every release.
   It never touches /api/ (sign-in, progress and rounds always go to the server) and never caches the teacher console.
   It prefers the network so a new version shows up straight away, and falls back to its saved copy when the network is slow or gone. */
var VERSION = '0.3.0';
var CACHE = 'ddj-' + VERSION;
var SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
  'css/app.css', 'js/engine.js', 'js/items-data.js', 'js/util.js', 'js/net.js', 'js/art.js', 'js/activities.js', 'js/app.js',
  'fonts/andika-latin-400-normal.woff2', 'fonts/andika-latin-700-normal.woff2', 'fonts/OFL.txt'
];
var WAIT_MS = 4000; // on slow school wifi, use the saved copy after this long

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('ddj-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function shouldHandle(request) {
  if (request.method !== 'GET') return false;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  var p = url.pathname;
  if (p.indexOf('/api/') === 0 || /\/sw\.js$/.test(p)) return false;
  if (/\/teacher(\.|\/)/.test(p) || /\/js\/teacher\.js$/.test(p) || /\/css\/teacher\.css$/.test(p)) return false; // the teacher console always loads fresh
  return true;
}

self.addEventListener('fetch', function (e) {
  if (!shouldHandle(e.request)) return;
  e.respondWith(new Promise(function (resolve) {
    var settled = false;
    function fromCache() { return caches.match(e.request, { ignoreSearch: true }); }
    var timer = setTimeout(function () {
      fromCache().then(function (hit) { if (hit && !settled) { settled = true; resolve(hit); } });
    }, WAIT_MS);
    fetch(e.request).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      if (!settled) { settled = true; resolve(res); }
    }, function () {
      clearTimeout(timer);
      fromCache().then(function (hit) { if (!settled) { settled = true; resolve(hit || Response.error()); } });
    });
  }));
});

// sw.js (DEV MODE) — bust cache automatically for local testing
const DEV_BUST = true; // set to false before deploying to GitHub Pages

self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // same-origin only
  if (url.origin !== location.origin) return;

  // 1) Keep your existing traits_json remap working under subpaths
  if (url.pathname.startsWith('/traits_json/')) {
    const scope = self.registration.scope; // e.g., http://localhost:8000/ or /createPhil/
    const rewritten = scope + 'traits_json/' + url.pathname.split('/').slice(2).join('/');
    event.respondWith(fetchNoStore(new Request(rewritten, event.request)));
    return;
  }

  // 2) In DEV, bust cache for local .js/.json/.css files
  if (DEV_BUST && [".js", ".json", ".css"].some(ext => url.pathname.endsWith(ext))) {
    url.searchParams.set('v', Date.now().toString());
    event.respondWith(fetchNoStore(new Request(url.toString(), event.request)));
    return;
  }

  // default: just fetch, but still no-store to be safe in dev
  event.respondWith(fetchNoStore(event.request));
});

async function fetchNoStore(reqLike) {
  const req = new Request(reqLike, { cache: 'reload' });
  const res = await fetch(req);
  // wrap response with no-store header
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers
  });
}
// Cho phép Sổ từ vựng chạy offline. Tăng số phiên bản khi đổi danh sách file.
const CACHE = 'sotu-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'api.github.com') return; // đồng bộ luôn đi thẳng ra mạng

  // Trang chính: lấy bản mới từ mạng nếu được (để nhận từ vựng mới), mất mạng thì dùng bản đã lưu.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(req.url, { signal: ctrl.signal, cache: 'no-cache', credentials: 'same-origin' });
        clearTimeout(t);
        if (res.ok) { const c = await caches.open(CACHE); await c.put('./index.html', res.clone()); }
        return res;
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Biểu tượng, manifest, font: dùng bản đã lưu, chưa có thì tải và lưu lại.
  if (url.origin === location.origin || /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
        return res;
      }))
    );
  }
});

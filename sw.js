// Cho phép Sổ từ vựng chạy offline. Tăng số phiên bản khi đổi danh sách file (thêm, bớt, đổi tên).
// Sửa nội dung file có sẵn (thêm từ vựng, sửa app) thì KHÔNG cần tăng: các file APP luôn được lấy bản mới khi có mạng.
const CACHE = 'sotu-v2';

// Trang, mã và dữ liệu từ vựng: lấy bản mới từ mạng nếu được, mất mạng thì dùng bản đã lưu.
const APP = ['./', './index.html', './style.css', './app.js', './data-ko.js', './data-en.js', './data-zh.js'];
// Biểu tượng, manifest: ít khi đổi, dùng bản đã lưu.
const STATIC = ['./manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

const APP_PATHS = new Set(APP.map(p => new URL(p, self.location.href).pathname));

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' để bỏ qua bộ nhớ đệm HTTP, lưu đúng bản vừa đưa lên GitHub.
      .then(c => c.addAll([...APP, ...STATIC].map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Thử mạng trước (tối đa 4 giây), được thì lưu lại; mất mạng hoặc máy chủ lỗi thì dùng bản đã lưu.
async function networkFirst(req, key, fallbacks = []) {
  const cache = await caches.open(CACHE);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(req.url, { signal: ctrl.signal, cache: 'no-cache', credentials: 'same-origin' });
    if (res.ok) { await cache.put(key, res.clone()); return res; }
    return (await cache.match(key)) || res;
  } catch (err) {
    for (const k of [key, ...fallbacks]) { const hit = await cache.match(k); if (hit) return hit; }
    return Response.error();
  } finally {
    clearTimeout(t);
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'api.github.com') return; // đồng bộ luôn đi thẳng ra mạng

  // Trang chính
  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req, './index.html', ['./']));
    return;
  }

  // style.css, app.js, data-*.js: cùng cách với trang chính để luôn nhận từ vựng mới
  if (url.origin === location.origin && APP_PATHS.has(url.pathname)) {
    e.respondWith(networkFirst(req, url.origin + url.pathname));
    return;
  }

  // Biểu tượng, manifest, font, bộ viết chữ Hán (jsDelivr, đã ghim phiên bản): dùng bản đã lưu, chưa có thì tải và lưu lại.
  if (url.origin === location.origin || /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
        return res;
      }))
    );
  }
});

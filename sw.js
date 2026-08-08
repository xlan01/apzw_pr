// 班级座位编排系统 - Service Worker
// 缓存策略：所有资源 CacheFirst，确保移动网络不稳定时也能正常打开

const CACHE_NAME = 'seating-v3';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js'
];

// 安装：预缓存所有关键资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] 正在缓存关键资源...');
      return Promise.allSettled(
        CACHE_URLS.map(url =>
          cache.add(url).catch(err => {
            console.warn('[SW] 缓存失败:', url, err.message);
          })
        )
      );
    })
  );
  // 立即激活，不等待旧 SW
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// 请求拦截：CacheFirst 策略
self.addEventListener('fetch', event => {
  // 跳过非 GET 请求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // 缓存命中，后台更新（stale-while-revalidate）
        fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, response);
            });
          }
        }).catch(() => {});
        return cached;
      }

      // 缓存未命中，在线获取并缓存
      return fetch(event.request).then(response => {
        if (!response.ok) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(() => {
        // 网络完全不可用，返回离线页面（对于导航请求）
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('离线状态', { status: 503 });
      });
    })
  );
});

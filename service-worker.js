/* 大学生生活费管家 Service Worker
 * 作用：缓存应用文件，支持离线打开和自动更新缓存。
 */
var CACHE_NAME = "college-life-manager-v8";
var APP_SHELL = [
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];
var INDEX_URL = new URL("./index.html", self.location).href;

/* 安装时预缓存应用入口和图标。 */
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(APP_SHELL);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

/* 激活时清理旧版本缓存。 */
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames.map(function (cacheName) {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
            return null;
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

/* 网络优先加载页面，离线时回退到缓存的首页。 */
function handleNavigation(event) {
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        var responseCopy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(INDEX_URL, responseCopy);
        });
        return response;
      })
      .catch(function () {
        return caches.match(INDEX_URL);
      })
  );
}

/* 静态资源优先使用缓存，并自动补充缓存。 */
function handleAsset(event) {
  event.respondWith(
    caches.match(event.request).then(function (cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then(function (response) {
        if (response && response.status === 200 && response.type === "basic") {
          var responseCopy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseCopy);
          });
        }
        return response;
      });
    })
  );
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  var requestUrl = new URL(request.url);

  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    handleNavigation(event);
    return;
  }

  handleAsset(event);
});
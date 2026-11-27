// 게임 화면과 스크립트는 온라인에서 갱신하고 오프라인에서는 마지막으로 받은 버전을 사용합니다.
const CACHE_NAME = 'samgukji-7balls-v4';
const gameRoot = self.registration.scope;
const coreURLs = new Set([
  './', './index.html', './manifest.json', './css/style.css',
  './js/audio.js', './js/data.js', './js/game.js'
].map(path => new URL(path, gameRoot).href));
const assetRoot = new URL('assets/', gameRoot).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // 오프라인 이미지와 저장 슬롯을 유지하면서 v4.0 화면 파일만 한 번에 교체합니다.
    await cache.addAll([...coreURLs].map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const path = url.origin + url.pathname;
  if (coreURLs.has(path)) {
    event.respondWith(loadCore(request, path));
  } else if (path.startsWith(assetRoot)) {
    event.respondWith(loadAsset(request));
  }
});

async function loadCore(request, cacheKey) {
  const cache = await caches.open(CACHE_NAME);
  let response;
  try {
    response = await fetch(request, { cache: 'no-cache' });
  } catch (error) {
    const saved = await cache.match(cacheKey);
    if (saved) return saved;
    throw error;
  }
  if (response.ok) {
    await cache.put(cacheKey, response.clone()).catch(() => {});
  } else if (response.status >= 500) {
    return (await cache.match(cacheKey)) || response;
  }
  return response;
}

async function loadAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

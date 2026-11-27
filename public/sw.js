// 정비핵 서비스 워커: 캐시는 하지 않고, 인터넷이 끊겼을 때 화면 이동만 안내 페이지로 대신한다.
// (페이지·가격은 항상 새로 받아야 해서 일부러 저장하지 않음)
const OFFLINE = "/offline.html"
const CACHE = "mh-offline-v1"

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(new Request(OFFLINE, { cache: "reload" }))))
  self.skipWaiting()
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)))
})

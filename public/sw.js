// 정비핵 서비스 워커: 캐시는 하지 않고, 인터넷이 끊겼을 때 화면 이동만 안내 페이지로 대신한다.
// (페이지·가격은 항상 새로 받아야 해서 일부러 저장하지 않음)
const OFFLINE = "/offline" // Cloudflare가 /offline.html을 /offline으로 넘겨서 (넘겨진 응답은 화면 이동에 못 씀)
const CACHE = "mh-offline-v2"

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

// 교체 시기 알림 (서버가 매일 아침 보냄). 누르면 마이 화면으로
self.addEventListener("push", (e) => {
  let d = {}
  try {
    d = e.data ? e.data.json() : {}
  } catch {}
  e.waitUntil(
    self.registration.showNotification(d.title || "정비핵", {
      body: d.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "mh-due",
      data: { url: d.url || "/my" },
    }),
  )
})

self.addEventListener("notificationclick", (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || "/my"
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.navigate(url).then((w) => (w || c).focus())
      return self.clients.openWindow(url)
    }),
  )
})

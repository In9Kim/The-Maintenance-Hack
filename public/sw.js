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
      // 안드로이드 상태줄 작은 아이콘: 흰색·투명 배경이어야 함 (컬러 아이콘은 흰 사각형으로 보임)
      badge: "/badge-96.png",
      tag: "mh-due",
      data: { url: sameOrigin(d.url) },
    }),
  )
})

/** 알림이 여는 주소는 이 사이트 안만 (없거나 다른 사이트면 마이 화면) */
function sameOrigin(u) {
  try {
    const x = new URL(u || "/my", self.location.origin)
    return x.origin === self.location.origin ? x.pathname + x.search + x.hash : "/my"
  } catch {
    return "/my"
  }
}

self.addEventListener("notificationclick", (e) => {
  e.notification.close()
  const url = sameOrigin(e.notification.data && e.notification.data.url)
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const c = list.find((w) => "focus" in w && w.url.startsWith(self.location.origin))
      if (!c) return self.clients.openWindow(url)
      // 이 서비스 워커가 맡지 않은 창이면 navigate가 실패하므로 그때는 새 창으로
      return c
        .navigate(url)
        .then((w) => (w || c).focus())
        .catch(() => self.clients.openWindow(url))
    }),
  )
})

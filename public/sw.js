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

// 교체 시기 알림 (서버가 매일 아침 보냄). 누르면 정비 화면으로
self.addEventListener("push", (e) => {
  let d = {}
  try {
    d = e.data ? e.data.json() : {}
  } catch {}
  const title = d.title || "정비핵"
  const body = d.body || ""
  const url = sameOrigin(d.url)
  e.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body,
        icon: "/icon-192.png",
        // 안드로이드 상태줄 작은 아이콘: 흰색·투명 배경이어야 함 (컬러 아이콘은 흰 사각형으로 보임)
        badge: "/badge-96.png",
        tag: "mh-due",
        data: { url },
      }),
      // 알림을 지워도 알림함(/inbox)에서 다시 볼 수 있게 이 폰에 저장. 실패해도 알림 표시는 그대로
      saveInbox({ title, body, url, at: Date.now() })
        .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
        .then((list) => list.forEach((c) => c.postMessage({ type: "mh-inbox" })))
        .catch(() => {}),
    ]),
  )
})

// 알림함 보관: 최근 50개, 90일. lib/inbox-core.ts 의 INBOX_MAX·INBOX_DAYS 와 같이 바꿀 것 (sw.js는 TS를 못 불러옴)
const INBOX_MAX = 50
const INBOX_DAYS = 90

/** 알림함 저장 (제목·내용·주소·받은 시각만). 넣은 뒤 같은 트랜잭션에서 오래된 것 정리 */
function saveInbox(item) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("mh-inbox", 1)
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore("items", { keyPath: "id", autoIncrement: true })
      s.createIndex("at", "at")
    }
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error("blocked"))
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction("items", "readwrite")
      const store = tx.objectStore("items")
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = tx.onabort = () => {
        db.close()
        reject(tx.error)
      }
      store.add(item)
      // 90일 지난 것 지움
      const min = item.at - INBOX_DAYS * 24 * 60 * 60 * 1000
      store.index("at").openCursor(IDBKeyRange.upperBound(min, true)).onsuccess = (ev) => {
        const cur = ev.target.result
        if (cur) {
          cur.delete()
          cur.continue()
          return
        }
        // 그래도 50개가 넘으면 오래된 것부터 지움
        store.count().onsuccess = (c) => {
          let extra = c.target.result - INBOX_MAX
          if (extra <= 0) return
          store.index("at").openCursor().onsuccess = (ev2) => {
            const cur2 = ev2.target.result
            if (!cur2 || extra <= 0) return
            cur2.delete()
            extra--
            cur2.continue()
          }
        }
      }
    }
  })
}

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

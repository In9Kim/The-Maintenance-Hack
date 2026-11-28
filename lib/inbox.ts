import { prune, type InboxItem } from "./inbox-core"

/** 서비스 워커(public/sw.js)가 쌓는 저장소 이름. 바꾸면 sw.js 도 같이 */
const DB = "mh-inbox"
const STORE = "items"
const SEEN = "mh_inbox_seen"

/** 이 폰에 쌓인 알림 (최신순, 90일·50개). 저장소가 없거나 막혔으면 [] */
export function readInbox(): Promise<InboxItem[]> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve([])
      const req = indexedDB.open(DB, 1)
      // 아직 알림을 한 번도 안 받았으면 sw.js 와 같은 모양으로 만들어 둠 (빈 저장소)
      req.onupgradeneeded = () => {
        const s = req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true })
        s.createIndex("at", "at")
      }
      req.onerror = () => resolve([])
      req.onblocked = () => resolve([])
      req.onsuccess = () => {
        const db = req.result
        try {
          const all = db.transaction(STORE, "readonly").objectStore(STORE).getAll()
          all.onsuccess = () => {
            db.close()
            const rows = (all.result as InboxItem[]).filter((x) => x && typeof x.title === "string")
            resolve(prune(rows, Date.now()))
          }
          all.onerror = () => {
            db.close()
            resolve([])
          }
        } catch {
          db.close()
          resolve([])
        }
      }
    } catch {
      resolve([])
    }
  })
}

/** 마지막으로 알림함을 본 시각 (없으면 0) */
export function seenAt(): number {
  try {
    return Number(localStorage.getItem(SEEN)) || 0
  } catch {
    return 0
  }
}

/** 알림함을 열면 모두 읽음. 종 아이콘이 바로 점을 지우게 'mh-inbox' 이벤트 */
export function markAllRead(): void {
  try {
    localStorage.setItem(SEEN, String(Date.now()))
  } catch {}
  try {
    window.dispatchEvent(new Event("mh-inbox"))
  } catch {}
}

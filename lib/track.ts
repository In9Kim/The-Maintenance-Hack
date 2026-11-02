/**
 * 브라우저에서 방문자 행동을 기록합니다 (구글시트 events 탭).
 * 페이지를 떠나는 클릭도 놓치지 않도록 sendBeacon을 우선 사용합니다.
 */
export interface ClientEvent {
  type: "outbound" | "car_view" | "calc_use" | "report" | "landing" | "nav"
  target?: "coupang" | "naver" | "gongim" | "recall_center" | "other"
  carId?: string
  partId?: string
  meta?: Record<string, unknown>
}

/**
 * 유입 꼬리표: 블로그 글 링크에 ?from=recall-tucson-2611 처럼 붙이면
 * 이 방문 동안의 모든 기록(meta.from)에 남아서 "어느 글에서 와서 몇 번 구매 사이트로 갔는지" 셀 수 있다.
 */
const FROM_KEY = "mh_from"
const FROM_RE = /^[a-z0-9][a-z0-9_-]{0,59}$/i

export function getVisitFrom(): string | null {
  try {
    return sessionStorage.getItem(FROM_KEY)
  } catch {
    return null
  }
}

/** 주소의 ?from= 값을 이번 방문 동안 기억. 새로 기억했으면 그 값을 돌려준다 */
export function captureVisitFrom(): string | null {
  if (typeof window === "undefined") return null
  const from = new URLSearchParams(window.location.search).get("from")
  if (!from || !FROM_RE.test(from)) return null
  try {
    if (sessionStorage.getItem(FROM_KEY) === from) return null
    sessionStorage.setItem(FROM_KEY, from)
  } catch {
    /* 저장이 막힌 브라우저면 이번 기록에만 남김 */
  }
  return from
}

export function track(event: ClientEvent): void {
  if (typeof window === "undefined") return
  const from = getVisitFrom()
  const body = JSON.stringify({
    ...event,
    meta: from ? { ...(event.meta ?? {}), from } : event.meta,
    path: window.location.pathname,
    referrer: document.referrer,
  })
  try {
    if (navigator.sendBeacon?.(("/api/stats/track"), new Blob([body], { type: "application/json" }))) return
  } catch {
    /* sendBeacon 실패 시 fetch로 */
  }
  fetch("/api/stats/track", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(
    () => {}
  )
}

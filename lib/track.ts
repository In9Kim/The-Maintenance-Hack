/**
 * 브라우저에서 방문자 행동을 기록합니다 (구글시트 events 탭).
 * 페이지를 떠나는 클릭도 놓치지 않도록 sendBeacon을 우선 사용합니다.
 */
export interface ClientEvent {
  type: "outbound" | "car_view" | "calc_use" | "report"
  target?: "coupang" | "naver" | "gongim" | "other"
  carId?: string
  partId?: string
  meta?: Record<string, unknown>
}

export function track(event: ClientEvent): void {
  if (typeof window === "undefined") return
  const body = JSON.stringify({
    ...event,
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

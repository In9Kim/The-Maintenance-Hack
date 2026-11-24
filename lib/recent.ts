/**
 * 최근 본 차·부품 — 이 기기(localStorage)에만 저장. 서버로 보내지 않는다.
 */
export const RECENT_KEY = "mh_recent"
export const RECENT_MAX = 8

export interface RecentItem {
  href: string
  /** "쏘렌토 MQ4" */
  title: string
  /** "엔진오일" (부품 페이지일 때) */
  sub?: string
  img?: string
  t: number
}

/** 같은 주소는 맨 앞으로 옮기고, 최대 개수만 남긴다 */
export function pushRecent(list: RecentItem[], item: RecentItem, max = RECENT_MAX): RecentItem[] {
  return [item, ...list.filter((x) => x.href !== item.href)].slice(0, max)
}

export function loadRecent(): RecentItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")
    return Array.isArray(v) ? v.filter((x) => x && typeof x.href === "string" && x.href.startsWith("/")) : []
  } catch {
    return []
  }
}

export function saveRecent(item: Omit<RecentItem, "t">) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(pushRecent(loadRecent(), { ...item, t: Date.now() })))
  } catch {
    /* 저장 못 해도 화면은 동작 */
  }
}

/**
 * 알림함 순수 함수 (브라우저 API 없음 → node 테스트 가능).
 * 저장은 public/sw.js(푸시 받을 때), 읽기는 lib/inbox.ts.
 */

/** 최근 몇 개까지 / 며칠까지 보관. public/sw.js 의 INBOX_MAX·INBOX_DAYS 와 같이 바꿀 것 */
export const INBOX_MAX = 50
export const INBOX_DAYS = 90

const DAY = 24 * 60 * 60 * 1000

export type InboxItem = {
  id?: number
  title: string
  body: string
  /** 이 사이트 안 주소 (sw.js sameOrigin 처리됨) */
  url: string
  /** 받은 시각 (ms) */
  at: number
}

/** 90일 지난 것 빼고, 최신순으로 50개까지 */
export function prune<T extends { at: number }>(items: T[], now: number): T[] {
  const min = now - INBOX_DAYS * DAY
  return items
    .filter((x) => typeof x.at === "number" && x.at >= min)
    .sort((a, b) => b.at - a.at)
    .slice(0, INBOX_MAX)
}

/** 마지막으로 알림함을 본 뒤에 받은 게 있으면 true */
export function hasUnread(items: { at: number }[], seenAt: number): boolean {
  return items.some((x) => x.at > seenAt)
}

/** '방금' / 'n분 전' / 'n시간 전' / 'n일 전' / 'M월 D일' (30일 넘으면 날짜) */
export function ago(at: number, now: number): string {
  const d = Math.max(0, now - at)
  const min = Math.floor(d / 60000)
  if (min < 1) return "방금"
  if (min < 60) return `${min}분 전`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}시간 전`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days}일 전`
  // 한국 시간 기준 날짜
  const k = new Date(at + 9 * 60 * 60 * 1000)
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`
}

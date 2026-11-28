// 아래 탭(BottomNav)과 컴퓨터 위 메뉴(Header)가 같이 쓰는 '지금 주소는 어느 탭인가' 판정.
// 실행: npm test (nav-match.test.ts)

/** 내 차 리콜 화면 /cars/{차}/recalls: 내 차 화면이라 '정비' 탭 */
export const isCarRecalls = (p: string) => /^\/cars\/[^/]+\/recalls\/?$/.test(p)

/** 홈: / 와 차종 페이지(/cars…, 차 리콜 제외), 알림함 */
export const matchHome = (p: string) => p === "/" || (p.startsWith("/cars") && !isCarRecalls(p)) || p === "/inbox"

/** 정비: 내 차 정비(/my)와 내 차 리콜 */
export const matchCare = (p: string) => p.startsWith("/my") || isCarRecalls(p)

export const matchQuote = (p: string) => p === "/quote"

export const matchNear = (p: string) => p.startsWith("/near")

/** 더보기: /more 와 그 안에서 들어가는 안내·도구 화면 (전체 리콜 /recalls… 포함) */
export const matchMore = (p: string) =>
  p === "/more" ||
  p.startsWith("/info") ||
  p === "/privacy" ||
  p === "/check" ||
  p.startsWith("/recalls") ||
  p === "/calculator" ||
  p === "/shop-card"

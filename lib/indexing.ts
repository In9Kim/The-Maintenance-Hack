/**
 * 검색 노출(사이트맵·noindex) 규칙. 데이터 파일을 읽지 않는 순수 함수만 둔다 (npm test로 검사).
 */

/** 리콜이 이보다 적은 제작사 페이지는 내용이 얇아서 사이트맵에서 빼고 noindex */
export const MIN_INDEXABLE_RECALLS = 5

/**
 * 제작사 리콜 페이지를 검색에 내보낼지.
 * 리콜이 충분하고, 이름 붙은 주소(lib/recalls/display.ts의 MAKERS)가 있는 제작사만.
 * 해시 주소(maker-xxxxxx)는 리콜이 늘어도 이름을 붙이기 전까지 noindex로 둔다.
 */
export function isIndexableMaker(maker: { slug: string; count: number }): boolean {
  return maker.count >= MIN_INDEXABLE_RECALLS && !maker.slug.startsWith("maker-")
}

/** 한국시간 오늘 (YYYY-MM-DD) */
export const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

/**
 * 날짜(YYYY-MM-DD) 중 가장 최근. 빈 값과 오늘 이후 날짜는 뺀다.
 * 사이트맵 lastmod는 "내용이 실제로 바뀐 날"이어야 하므로 없으면 undefined (lastmod 생략).
 */
export function latestDate(dates: (string | null | undefined)[], today = todayKst()): string | undefined {
  let best: string | undefined
  for (const d of dates) {
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d) || d > today) continue
    if (!best || d > best) best = d
  }
  return best
}

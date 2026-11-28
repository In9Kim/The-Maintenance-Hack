/**
 * 정비비 계산기 부품 목록 순서: 위에 먼저 보여 줄 부품(top)과 '다른 부품 N개 더 보기'로 접을 부품(rest).
 * - 주소 ?part= 로 미리 체크된 부품(pinIds)과, 내 차가 있으면 갈 때 된 부품(dueIds)이 있으면 그 부품들(그 순서)
 * - 아니면 많이 찾는 부품 4개 (엔진오일·에어컨 필터·에어클리너·와이퍼 중 데이터에 있는 것)
 */

interface PartLike {
  id: string
  name: string
}

/** 많이 찾는 부품: 이름에 이 글자가 있으면 해당 (앞에 있을수록 먼저) */
export const POPULAR_PART_KEYWORDS: RegExp[] = [/엔진오일/, /에어컨\s*필터|캐빈/, /에어클리너/, /와이퍼/]

export function splitChecklistParts<T extends PartLike>(
  parts: T[],
  opts: { dueIds?: string[]; hasMyCar?: boolean; pinIds?: string[] } = {}
): { top: T[]; rest: T[] } {
  let top: T[] = []
  // 주소 ?part= 로 미리 체크된 부품(견적서·부품 확인에서 넘어옴)은 맨 위, 갈 때 된 부품은 그다음
  const ids = [...(opts.pinIds ?? []), ...(opts.hasMyCar ? opts.dueIds ?? [] : [])]
  if (ids.length) {
    for (const id of ids) {
      const p = parts.find((x) => x.id === id)
      if (p && !top.includes(p)) top.push(p)
    }
  }
  if (!top.length) {
    top = []
    for (const re of POPULAR_PART_KEYWORDS) {
      const p = parts.find((x) => re.test(x.name) && !top.includes(x))
      if (p) top.push(p)
    }
  }
  const rest = parts.filter((p) => !top.includes(p))
  return { top, rest }
}

/** 카드 한 줄 교체 주기: "15,000km 또는 12개월" → "15,000km·12개월마다" */
export function cardIntervalText(interval: string | null): string | null {
  return interval ? `${interval.replace(/ 또는 /g, "·")}마다` : null
}

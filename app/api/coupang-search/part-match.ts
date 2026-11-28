/**
 * 쿠팡 검색 결과에서 부품 종류가 다른 상품 거르기 (엔진오일 칸에 오일필터만, 에어클리너 칸에 엔진오일·워셔액이 나오던 문제).
 * 많이 찾는 부품(엔진오일·에어클리너·에어컨 필터·와이퍼)만 종류를 알아보고, 나머지 부품은 null (기존 거르기 그대로).
 * 맞는 상품이 없으면 빈 목록 → 화면은 검색 링크로 대신 보여 줌 (엉뚱한 상품으로 채우지 않음).
 */

/** 현대·기아 세대 코드 (상품명에 다른 세대 코드만 있으면 그 세대용) */
export const GEN_CODES = /\b(BL|XM|UM|MQ4|TD|HD|MD|AD|CN7|YD|BD|JF|DL3|LF|YF|NF|DN8|HG|IG|GN7|TL|NX4|QL|NQ5|SL|KA4|YP|VQ|DM|TM|MX5|SP2|JA|TAM|SG2|DE|GL3|YG|TF)\b/g

export type PartKind = "engine-oil" | "air-filter" | "cabin-filter" | "wiper"

export function partKind(partName: string): PartKind | null {
  if (/엔진\s*오일/.test(partName)) return "engine-oil"
  if (/에어컨\s*필터|캐빈/.test(partName)) return "cabin-filter"
  if (/에어\s*[클크]리너/.test(partName)) return "air-filter"
  if (/와이퍼/.test(partName)) return "wiper"
  return null
}

/** 오일이 실제로 든 상품 (점도·용량·합성유·'엔진오일 세트'·'3종') */
const OIL_STRONG = /\d{1,2}\s*W\s*-?\s*\d{2}|합성유|\d+(\.\d+)?\s*L\b|엔진\s*오일\s*세트|\d종/i

const KIND_TEST: Record<PartKind, (name: string) => boolean> = {
  // 필터만 든 상품(오일필터·필터 셋트)은 빼고, 오일이나 오일 세트만
  "engine-oil": (n) => /엔진\s*오일|합성유|\d{1,2}\s*W\s*-?\s*\d{2}/i.test(n) && (!/필터/.test(n) || OIL_STRONG.test(n)),
  // 에어클리너 단품만 (오일 세트·에어컨 필터 제외)
  "air-filter": (n) => /에어\s*[클크]리너|에어\s*필터/.test(n) && !/오일|합성유|에어컨|활성탄|캐빈/.test(n),
  "cabin-filter": (n) => /에어컨|캐빈|활성탄/.test(n) && !/엔진\s*오일|오일\s*필터|에어\s*[클크]리너/.test(n),
  wiper: (n) => /와이퍼/.test(n),
}

/**
 * 부품 종류가 맞고 다른 세대용이 아닌 상품만, 이 차 세대 코드·차 이름이 적힌 상품을 앞으로.
 * @param model 차 이름 (예: "K3", "쏘렌토")  @param genCode 세대 코드 (예: "BD", 없으면 "")
 */
export function matchPartKind<T extends { name: string }>(items: T[], kind: PartKind, model: string, genCode: string): T[] {
  const m = model.replace(/\s/g, "")
  const g = genCode.toUpperCase()
  const score = (x: T) => {
    const n = x.name.replace(/\s/g, "")
    return (g && x.name.toUpperCase().match(GEN_CODES)?.includes(g) ? 2 : 0) + (m && n.includes(m) ? 1 : 0)
  }
  return items
    .filter((x) => {
      if (!KIND_TEST[kind](x.name)) return false
      if (g) {
        const codes: string[] = x.name.toUpperCase().match(GEN_CODES) ?? []
        if (codes.length && !codes.includes(g)) return false
      }
      return true
    })
    .map((x, i) => ({ x, i, s: score(x) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ x }) => x)
}

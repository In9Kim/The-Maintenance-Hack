/**
 * 소모품 규격 옆 "이 규격 제품 보기" 쿠팡 파트너스 링크 (data/coupang-links.json)
 *
 * 원칙: 차종·연식·엔진 규격이 정확히 맞는 상품만. 애매하면 넣지 않는다.
 *  - 링크는 주인이 쿠팡 파트너스에서 직접 만들어 넣는다 (link.coupang.com 단축 링크)
 *  - matches: 이 상품이 맞는 근거. 순정 품번(예: "26300-2J000") 또는 규격 문구(예: "0W-30")
 *    → 차종 데이터의 partNumber/spec에 그 값이 그대로 있어야 한다 (lib/coupang-links.test.ts가 확인)
 */
import raw from "@/data/coupang-links.json"
import searchRaw from "@/data/coupang-search-links.json"
import type { CarModel, MaintenancePart } from "@/types"

import type { CoupangSpecLink } from "./coupang-check"
export type { CoupangSpecLink }

const LINKS = ((raw as { links?: Record<string, CoupangSpecLink[]> }).links ?? {}) as Record<string, CoupangSpecLink[]>

export function allCoupangSpecLinks(): Record<string, CoupangSpecLink[]> {
  return LINKS
}

export function coupangLinksFor(part: MaintenancePart): CoupangSpecLink[] {
  return LINKS[part.id] ?? []
}

/** 이 차종 페이지에 쿠팡 링크가 하나라도 있는지 (고지 문구 표시용) */
export function carHasCoupangLinks(car: CarModel): boolean {
  return car.parts.some((p) => coupangChoicesFor(p).length > 0)
}

/**
 * 소모품별 쿠팡 파트너스 검색 링크 (data/coupang-search-links.json, scripts/build-coupang-search-links.mjs가 만듦)
 *  - spec: 규격(점도·등급)만 맞으면 되는 소모품 → 검색 결과가 모두 그 규격
 *  - car:  차종 전용 부품 → 화면에 "구매 전 순정 품번 확인" 안내
 */
export interface CoupangSearchLink {
  kind: "spec" | "car"
  query: string
  url: string
}
const SEARCH = ((searchRaw as { links?: Record<string, CoupangSearchLink> }).links ?? {}) as Record<string, CoupangSearchLink>

export function coupangSearchFor(part: MaintenancePart): CoupangSearchLink | undefined {
  return SEARCH[part.id]
}

/** 화면에 보여 줄 쿠팡 링크: 규격 확인 상품(있으면) → 검색 링크 */
export interface CoupangChoice {
  url: string
  kind: "product" | "spec" | "car"
  title: string
  sub: string
}

export function coupangChoicesFor(part: MaintenancePart): CoupangChoice[] {
  const out: CoupangChoice[] = coupangLinksFor(part).map((l) => ({
    url: l.url,
    kind: "product",
    title: "규격 맞는 상품 보기 (쿠팡)",
    sub: l.product,
  }))
  const s = coupangSearchFor(part)
  if (s) {
    out.push(
      s.kind === "spec"
        ? { url: s.url, kind: "spec", title: "이 규격 상품 찾기 (쿠팡)", sub: `“${s.query}” 검색` }
        : { url: s.url, kind: "car", title: "쿠팡에서 찾기", sub: "구매 전 순정 품번·규격을 꼭 확인하세요" }
    )
  }
  return out
}

export { checkCoupangLink } from "./coupang-check"

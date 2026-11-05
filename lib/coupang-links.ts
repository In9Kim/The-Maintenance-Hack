/**
 * 소모품 규격 옆 "이 규격 제품 보기" 쿠팡 파트너스 링크 (data/coupang-links.json)
 *
 * 원칙: 차종·연식·엔진 규격이 정확히 맞는 상품만. 애매하면 넣지 않는다.
 *  - 링크는 주인이 쿠팡 파트너스에서 직접 만들어 넣는다 (link.coupang.com 단축 링크)
 *  - matches: 이 상품이 맞는 근거. 순정 품번(예: "26300-2J000") 또는 규격 문구(예: "0W-30")
 *    → 차종 데이터의 partNumber/spec에 그 값이 그대로 있어야 한다 (lib/coupang-links.test.ts가 확인)
 */
import raw from "@/data/coupang-links.json"
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

/** 이 차종 페이지에 쿠팡 규격 링크가 하나라도 있는지 (고지 문구 표시용) */
export function carHasCoupangLinks(car: CarModel): boolean {
  return car.parts.some((p) => coupangLinksFor(p).length > 0)
}

export { checkCoupangLink } from "./coupang-check"

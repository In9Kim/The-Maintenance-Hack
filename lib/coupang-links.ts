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
import picksRaw from "@/data/coupang-picks.json"
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
  kind: "pick" | "product" | "spec" | "car"
  title: string
  sub: string
  /** pick 전용: 가격·이미지·안내 */
  price?: number
  priceDate?: string
  image?: string
  note?: string
}

/**
 * 엔진오일 "이거 사면 돼요" 상품 (data/coupang-picks.json, scripts/pick-coupang-oil.mjs가 쿠팡 검색 API로 고름)
 *  - set: 그 차·엔진 전용 오일+오일필터 세트
 *  - oil: 같은 점도·등급의 오일 단품 (필요량을 따로 안내)
 */
export interface CoupangPick {
  kind: "set" | "oil"
  name: string
  price: number
  url: string
  image?: string
  rocket?: boolean
  query: string
  checkedAt: string
}
const PICKS = ((picksRaw as { picks?: Record<string, CoupangPick> }).picks ?? {}) as Record<string, CoupangPick>

export function coupangPickFor(part: MaintenancePart): CoupangPick | undefined {
  return PICKS[part.id]
}

/** 규격에서 필요한 오일 양 (예: "5.8L") */
export function oilAmount(part: MaintenancePart): string | null {
  return part.spec.match(/(\d+(?:\.\d)?)\s*L/)?.[1] ?? null
}

export function coupangChoicesFor(part: MaintenancePart): CoupangChoice[] {
  const out: CoupangChoice[] = []
  const pick = coupangPickFor(part)
  if (pick) {
    const need = oilAmount(part)
    out.push({
      url: pick.url,
      kind: "pick",
      title: pick.kind === "set" ? "이 세트 사면 돼요 (쿠팡)" : "이 오일 사면 돼요 (쿠팡)",
      sub: pick.name,
      price: pick.price,
      priceDate: pick.checkedAt,
      image: pick.image,
      note:
        pick.kind === "set"
          ? "엔진오일 + 오일필터가 함께 든 차종 전용 세트예요. 상품명의 연식·엔진이 내 차와 같은지 한 번 더 보세요."
          : `규격(점도·등급)이 맞는 오일이에요.${need ? ` 필요량은 ${need}L라 용량이 모자라면 1L를 더 사세요.` : ""} 오일필터는 따로 필요해요.`,
    })
  }
  out.push(
    ...coupangLinksFor(part).map<CoupangChoice>((l) => ({
      url: l.url,
      kind: "product",
      title: "규격 맞는 상품 보기 (쿠팡)",
      sub: l.product,
    }))
  )
  const s = coupangSearchFor(part)
  if (s) {
    out.push(
      s.kind === "spec"
        ? { url: s.url, kind: "spec", title: pick ? "다른 상품 더 보기 (쿠팡)" : "이 규격 상품 찾기 (쿠팡)", sub: `“${s.query}” 검색` }
        : { url: s.url, kind: "car", title: "쿠팡에서 찾기", sub: "구매 전 순정 품번·규격을 꼭 확인하세요" }
    )
  }
  return out
}

/**
 * 네이버쇼핑 검색 링크 (가격 비교용). 네이버는 쇼핑 검색 API를 새로 내주지 않아서 가격을 가져오지 못하고,
 * 같은 검색어로 네이버쇼핑 결과를 열어 사용자가 직접 비교하게 한다. 제휴 링크가 아니라 수수료는 없다.
 */
export function naverShoppingFor(part: MaintenancePart): { url: string; query: string } | undefined {
  const query = coupangPickFor(part)?.query.replace(/엔진오일 필터 세트/, "엔진오일세트") ?? coupangSearchFor(part)?.query ?? part.coupangKeyword
  if (!query) return undefined
  return { url: `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(query)}`, query }
}

export { checkCoupangLink } from "./coupang-check"

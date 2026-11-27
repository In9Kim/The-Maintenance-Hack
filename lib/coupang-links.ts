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
import batteryRaw from "@/data/battery-fitment.json"
import padRaw from "@/data/brake-pad-fitment.json"
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
 * "이거 사면 돼요" 상품 (data/coupang-picks.json). 고르기는 scripts/pick-coupang-oil.mjs·pick-coupang-parts.mjs,
 * 가격은 scripts/refresh-coupang-prices.mjs가 매일 갱신 (checkedAt 날짜 기준)
 *  - set: 그 차·엔진 전용 오일+오일필터 세트 / oil: 같은 점도·등급의 오일 단품 (필요량을 따로 안내)
 *  - wiper: 운전석·조수석 길이가 규격과 같은 세트 / cabin·air: 상품명에 이 차종(또는 순정 품번)이 적힌 필터
 */
export interface CoupangPick {
  kind: "set" | "oil" | "wiper" | "cabin" | "air" | "battery" | "pad"
  productId?: number | string
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
  if (part.category === "battery") {
    // 배터리는 규격 단위로 골라 둠: 이 차종 적합표에서 절반 넘게 쓰는 규격이 있을 때만 그 상품
    const main = batteryOptionsFor(part)[0]
    return main && main.share >= 0.5 ? main.pick : undefined
  }
  const pads = padOptionsFor(part)
  // 패드: 품번이 하나뿐인 차종만 대표 상품 (휠 크기·EPB로 갈리면 화면의 품번 목록에서 고르게)
  if (pads.length) return pads.length === 1 ? pads[0].pick : undefined
  return PICKS[part.id]
}

/** 브레이크 패드 상신 품번별 상품 (data/brake-pad-fitment.json: 상신 공용차종표, scripts/pick-coupang-brake.mjs가 품번마다 상품을 고름).
 *  내 차 이름이 적힌 같은 품번 상품이 있으면 그걸(pad:부품id:품번), 없으면 품번 대표 상품(pad:품번) */
export interface PadOption {
  sp: string
  /** 그 품번이 맞는 조건 (휠 크기·엔진·EPB). 빈 문자열이면 전 차량 */
  label: string
  pick?: CoupangPick
}
const PADS = ((padRaw as { parts?: Record<string, { sp: string; label: string }[]> }).parts ?? {})

export function padOptionsFor(part: MaintenancePart): PadOption[] {
  return (PADS[part.id] ?? []).map((o) => ({ ...o, pick: PICKS[`pad:${part.id}:${o.sp}`] ?? PICKS[`pad:${o.sp}`] }))
}

/**
 * 배터리 규격별 상품 (data/battery-fitment.json: 아트라스BX 적합표, scripts/pick-coupang-battery.mjs가 규격마다 상품을 고름).
 * 같은 차종도 트림마다 규격이 달라서 "라벨이 이 규격이면 → 이 상품"으로 보여 준다.
 */
export interface BatteryOption {
  code: string
  name: string
  type: string
  ah: number
  /** 적합표의 연식·세부모델 조합 중 비율 (판매 비율 아님) */
  share: number
  pick?: CoupangPick
}
const BATTERY = ((batteryRaw as { cars?: Record<string, { options: Omit<BatteryOption, "pick">[] }> }).cars ?? {})

export function batteryOptionsFor(part: MaintenancePart): BatteryOption[] {
  if (part.category !== "battery" || /보조|LFP/.test(part.name)) return []
  const carId = Object.keys(BATTERY).find((id) => part.id.startsWith(id + "-"))
  if (!carId) return []
  return BATTERY[carId].options.map((o) => ({ ...o, pick: PICKS[`battery:${o.code}`] }))
}

/** 규격에서 필요한 오일 양 (예: "5.8L") */
export function oilAmount(part: MaintenancePart): string | null {
  return part.spec.match(/(\d+(?:\.\d)?)\s*L\b/)?.[1] ?? null
}

export function coupangChoicesFor(part: MaintenancePart): CoupangChoice[] {
  const out: CoupangChoice[] = []
  const pick = coupangPickFor(part)
  if (pick) {
    const need = oilAmount(part)
    out.push({
      url: pick.url,
      kind: "pick",
      title: pick.kind === "pad" ? "이 패드 사면 돼요 (쿠팡)" : pick.kind === "battery" ? "가장 흔한 규격 배터리 (쿠팡)" : pick.kind === "set" ? "이 세트 사면 돼요 (쿠팡)" : pick.kind === "oil" ? "이 오일 사면 돼요 (쿠팡)" : pick.kind === "wiper" ? "이 와이퍼 사면 돼요 (쿠팡)" : "이 필터 사면 돼요 (쿠팡)",
      sub: pick.name,
      price: pick.price,
      priceDate: pick.checkedAt,
      image: pick.image,
      note:
        pick.kind === "pad"
          ? `상신브레이크 공용차종표에서 이 차에 맞는 품번(${padOptionsFor(part)[0]?.sp})이 상품명에 있는 상신 정품이에요. 같은 품번을 여러 차가 같이 써서 상품명에 다른 차 이름이 있을 수 있어요.`
          : pick.kind === "battery"
          ? `이 차종 적합표에서 가장 많은 ${batteryOptionsFor(part)[0]?.name} 규격이에요. 트림마다 규격이 달라서 지금 달린 배터리 라벨과 같은지 꼭 보세요. 폐배터리 반납 조건이 붙은 상품이 많아요.`
          : pick.kind === "set"
          ? "엔진오일 + 오일필터가 함께 든 차종 전용 세트예요. 상품명의 연식·엔진이 내 차와 같은지 한 번 더 보세요."
          : pick.kind === "oil"
            ? `규격(점도·등급)이 맞는 오일이에요.${need ? ` 필요량은 ${need}L라 용량이 모자라면 1L를 더 사세요.` : ""} 오일필터는 따로 필요해요.`
            : pick.kind === "wiper"
              ? "운전석·조수석 길이가 이 차 규격과 같은 세트예요. 사기 전에 지금 달린 블레이드 길이와 한 번 비교하세요."
              : "상품명에 이 차종(또는 순정 품번)이 적힌 필터예요. 연식·엔진이 내 차와 같은지 상품명에서 한 번 더 보세요.",
    })
  }
  out.push(
    ...coupangLinksFor(part).map<CoupangChoice>((l) => ({
      url: l.url,
      kind: "product",
      title: "쿠팡에서 가격 보기",
      sub: l.product,
    }))
  )
  const s = coupangSearchFor(part)
  if (s) {
    out.push(
      s.kind === "spec"
        ? { url: s.url, kind: "spec", title: pick ? "다른 상품 더 보기 (쿠팡)" : "쿠팡에서 이 규격 가격 보기", sub: `“${s.query}” 검색` }
        : { url: s.url, kind: "car", title: "쿠팡에서 가격 보기", sub: "이 차종에 맞는 상품 검색 결과" }
    )
  }
  return out
}

/**
 * 같은 규격 엔진오일 3가지 (data/coupang-oil-tiers.json, scripts/pick-coupang-oil-tiers.mjs가 만듦)
 * 규격(점도 + 가솔린/디젤)별로 고른 상품을 이 차의 필요량과 맞춰 "규격 체크"와 함께 보여 준다.
 */
export interface OilTierItem {
  name: string
  price: number
  liters: number
  gradeShown: boolean
  url: string
  image?: string
  rocket?: boolean
}
// 주의: JSON을 점(.)으로 깊게 읽으면 빌드(webpack)가 안쪽 키 이름을 줄여 버려 값이 사라진다 → 통째로 복사해서 읽기
type TierInfo = { key: string; visc: string | null; diesel: boolean; need: number | null }
const OIL_TIERS = (JSON.parse(JSON.stringify(picksRaw)) as {
  oilTiers?: { tiers?: Record<string, Record<string, OilTierItem | null>>; byPart?: Record<string, TierInfo>; checkedAt?: string }
}).oilTiers
const TIERS = OIL_TIERS?.tiers ?? {}
const BY_PART = OIL_TIERS?.byPart ?? {}
export const OIL_TIERS_DATE = OIL_TIERS?.checkedAt ?? ""

export interface OilTierRow {
  tier: "oem" | "value" | "premium"
  label: string
  item: OilTierItem
  /** 필요량을 채우려면 몇 개 사야 하는지 */
  count: number
  checks: { label: string; ok: boolean | null; text: string }[]
}

const TIER_LABEL = { oem: "순정", value: "가성비", premium: "프리미엄" } as const

export function oilTiersFor(part: MaintenancePart): OilTierRow[] {
  const info = BY_PART[part.id]
  const t = info && TIERS[info.key]
  if (!info || !t) return []
  const { visc, diesel, need } = info
  return (["oem", "value", "premium"] as const).flatMap((tier) => {
    const item = t[tier]
    if (!item) return []
    const count = need ? Math.max(1, Math.ceil(need / item.liters - 0.001)) : 1
    const checks = [
      { label: "점도", ok: visc ? true : null, text: visc ?? "설명서 점도표 확인" },
      {
        label: "등급",
        ok: item.gradeShown ? true : null,
        text: item.gradeShown ? (diesel ? "ACEA C 등급" : "API SP급") : "상품 상세에서 확인",
      },
      {
        label: "용량",
        ok: need ? item.liters * count >= need : null,
        text: need ? (count > 1 ? `${item.liters}L × ${count}개 (필요 ${need}L)` : `${item.liters}L (필요 ${need}L)`) : `${item.liters}L`,
      },
    ]
    return [{ tier, label: TIER_LABEL[tier], item, count, checks }]
  })
}

/**
 * 네이버쇼핑 검색 링크 (가격 비교용). 네이버는 쇼핑 검색 API를 새로 내주지 않아서 가격을 가져오지 못하고,
 * 같은 검색어로 네이버쇼핑 결과를 열어 사용자가 직접 비교하게 한다. 제휴 링크가 아니라 수수료는 없다.
 */
export function naverShoppingFor(part: MaintenancePart): { url: string; query: string } | undefined {
  const pick = coupangPickFor(part)
  const query = pick ? naverQueryOf(pick.name) : coupangSearchFor(part)?.query ?? part.coupangKeyword
  if (!query) return undefined
  return { url: naverSearchUrl(query), query }
}

/** 쿠팡 상품명을 네이버 검색어로: 옵션(쉼표 뒤)·괄호 꼬리표를 떼고 앞부분만 → 같은 상품의 다른 판매처 가격이 나온다 */
export function naverQueryOf(name: string): string {
  return name.split(",")[0].replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60)
}
export const naverSearchUrl = (q: string) => `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(q)}`

export { checkCoupangLink } from "./coupang-check"

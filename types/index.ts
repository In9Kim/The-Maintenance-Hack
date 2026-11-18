export type PartCategory =
  | "oil"
  | "filter"
  | "brake"
  | "wiper"
  | "spark"
  | "battery"
  | "belt"
  | "fluid"

export const CATEGORY_LABELS: Record<PartCategory, string> = {
  oil: "오일류",
  filter: "필터류",
  brake: "브레이크",
  wiper: "와이퍼",
  spark: "점화플러그",
  battery: "배터리",
  belt: "벨트/체인",
  fluid: "유체류",
}

export const CATEGORY_COLORS: Record<PartCategory, string> = {
  oil: "bg-amber-50 text-amber-700 border border-amber-200",
  filter: "bg-blue-50 text-blue-700 border border-blue-200",
  brake: "bg-red-50 text-red-700 border border-red-200",
  wiper: "bg-sky-50 text-sky-700 border border-sky-200",
  spark: "bg-purple-50 text-purple-700 border border-purple-200",
  battery: "bg-emerald-50 text-primary border border-emerald-200",
  belt: "bg-orange-50 text-orange-700 border border-orange-200",
  fluid: "bg-cyan-50 text-cyan-700 border border-cyan-200",
}

export interface MaintenancePart {
  id: string
  name: string
  category: PartCategory
  spec: string
  partNumber?: string
  /** 쿠팡 예상 부품가 (Phase 2: API 연동 후 실시간으로 교체) */
  coupangPrice: number
  /** 공임나라 기준 공임 */
  laborCost: number
  /** 공식 서비스 센터 부품가 (딜러 마진 포함) */
  dealerPartPrice: number
  /** 공식 서비스 센터 공임 */
  dealerLaborCost: number
  intervalKm?: number
  intervalMonths?: number
  coupangKeyword: string
  /** 엔진마다 규격이 다른 소모품이면 해당 엔진 (CarModel.engineTypes 중 하나). 없으면 모든 엔진 공통 */
  engine?: string
  /** 규격 출처 (제조사 공식 자료) */
  source?: string
}

export interface CarModel {
  id: string
  brand: "기아" | "현대" | "제네시스" | "테슬라" | string
  model: string
  generation: string
  yearRange: string
  /**
   * 이 차종의 데이터(규격·가격·쿠팡 링크)를 마지막으로 고친 날 (YYYY-MM-DD).
   * 사이트맵 lastmod로 쓰이므로 차종·소모품·쿠팡 링크를 고치면 함께 바꾼다.
   */
  updatedAt?: string
  engineTypes: string[]
  parts: MaintenancePart[]
  /** undefined = 기존 검증 차종(true 취급), false = AI 생성 후 미검증 */
  is_verified?: boolean
}

export interface VehicleStats {
  carViews: Record<string, number>
  partClicks: Record<string, number>
  gongimClicks: Record<string, number>
}

export interface DuplicateGroup {
  cars: CarModel[]
  reason: string
}

export interface CostItem {
  part: MaintenancePart
  coupangSubtotal: number
  dealerSubtotal: number
}

export interface CostSummary {
  coupangPartsTotal: number
  coupangLaborTotal: number
  coupangTotal: number
  dealerPartsTotal: number
  dealerLaborTotal: number
  dealerTotal: number
  savings: number
  savingsPercent: number
  items: CostItem[]
}

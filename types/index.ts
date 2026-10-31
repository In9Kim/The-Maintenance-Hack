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
  oil: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  filter: "bg-blue-500/15 text-blue-400 border border-blue-500/25",
  brake: "bg-red-500/15 text-red-400 border border-red-500/25",
  wiper: "bg-sky-500/15 text-sky-400 border border-sky-500/25",
  spark: "bg-purple-500/15 text-purple-400 border border-purple-500/25",
  battery: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
  belt: "bg-orange-500/15 text-orange-400 border border-orange-500/25",
  fluid: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25",
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
}

export interface CarModel {
  id: string
  brand: "기아" | "현대" | "제네시스" | "테슬라" | string
  model: string
  generation: string
  yearRange: string
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

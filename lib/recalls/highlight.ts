/**
 * /recalls 첫 화면의 "주요 리콜" 고르기·묶기. 데이터 파일을 읽지 않는 순수 함수만 둔다 (npm test로 검사).
 *
 * 주요 리콜 = 많이 타는 브랜드 + (중대리콜 표시 | 대상 1,000대 이상 | 화재·제동·조향 같은 안전 직결 결함)
 * 이륜차·트레일러·소형 수입사 리콜은 첫 화면에서 빼고 제작사별 페이지에서만 보여 준다.
 */
import type { Recall } from "./types"

/** 국내에서 많이 타는 승용·SUV 브랜드 (lib/recalls/display.ts의 주소 이름) */
export const MAJOR_MAKERS = new Set([
  "hyundai", "kia", "genesis", "kg-mobility", "gm-korea", "renault-korea", "ssangyong",
  "tesla", "bmw", "mini", "mercedes-benz", "volkswagen", "audi", "porsche", "volvo", "toyota", "honda",
  "nissan", "ford", "lincoln", "stellantis", "jaguar-land-rover", "fl-auto", "byd", "polestar", "cadillac",
])

export const MIN_MAJOR_COUNT = 1000
/** 안전 결함이라도 대상이 이보다 적으면(대수를 알 때) 이슈로 보지 않음. 예: 1대·4대 리콜 */
export const MIN_SAFETY_COUNT = 100

/** 결함 장치·사유에 이 말이 있으면 안전 직결 결함으로 본다 */
const SAFETY =
  /화재|발화|과열|소화|에어백|브레이크|제동|조향|스티어링|휠.{0,8}(이탈|풀림)|바퀴.{0,8}이탈|(주행|운행) ?중.{0,12}(정지|꺼짐|멈춤|동력)|시동.{0,4}꺼짐|동력 ?(상실|차단)|연료.{0,8}(누유|누설|새)|급가속|가속.{0,6}불량|안전벨트|좌석.{0,6}고정/

export function isSafetyCritical(r: Pick<Recall, "part" | "reason">): boolean {
  return SAFETY.test(`${r.part ?? ""} ${r.reason}`)
}

export function isMajorRecall(r: Recall): boolean {
  if (!MAJOR_MAKERS.has(r.makerSlug)) return false
  if (r.serious || (r.count ?? 0) >= MIN_MAJOR_COUNT) return true
  return isSafetyCritical(r) && (r.count == null || r.count >= MIN_SAFETY_COUNT)
}

/** 같은 날 같은 제작사 리콜 묶음 (한 줄로 보여 줌) */
export interface RecallGroup {
  key: string
  makerSlug: string
  makerName: string
  startDate: string
  /** 대상 대수 많은 순 */
  recalls: Recall[]
  /** 대수를 아는 리콜의 합 (하나도 모르면 null) */
  count: number | null
  serious: boolean
}

export function groupRecalls(recalls: Recall[]): RecallGroup[] {
  const map = new Map<string, RecallGroup>()
  for (const r of recalls) {
    const key = `${r.makerSlug}|${r.startDate}`
    let g = map.get(key)
    if (!g) {
      g = { key, makerSlug: r.makerSlug, makerName: r.makerName, startDate: r.startDate, recalls: [], count: null, serious: false }
      map.set(key, g)
    }
    g.recalls.push(r)
    if (r.count != null) g.count = (g.count ?? 0) + r.count
    g.serious ||= !!r.serious
  }
  const groups = [...map.values()]
  for (const g of groups) g.recalls.sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
  return groups.sort((a, b) => b.startDate.localeCompare(a.startDate) || (b.count ?? 0) - (a.count ?? 0))
}

/** "2026-11-18"에서 days일 전 날짜 */
export function daysBefore(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** 최근 days일 안에 이미 시작한(시작 예정 제외) 주요 리콜 묶음, 최신순 limit개 */
export function majorRecallGroups(
  all: Recall[],
  today: string,
  { days = 90, limit = 15 }: { days?: number; limit?: number } = {}
): { groups: RecallGroup[]; total: number } {
  const since = daysBefore(today, days)
  const major = all.filter((r) => r.startDate <= today && r.startDate >= since && isMajorRecall(r))
  const groups = groupRecalls(major)
  return { groups: groups.slice(0, limit), total: major.length }
}

/**
 * 첫 화면 "꼭 확인할 리콜": 주요 리콜 중 화재·제동·조향·에어백처럼 사고로 이어지는 결함만.
 * 나머지 주요 리콜(소프트웨어·표시등·라벨 등)은 접어서 보여 준다.
 */
export function splitCritical(groups: RecallGroup[]): { critical: RecallGroup[]; other: RecallGroup[] } {
  const critical: RecallGroup[] = []
  const other: RecallGroup[] = []
  for (const g of groups) (g.recalls.some(isSafetyCritical) ? critical : other).push(g)
  return { critical, other }
}

/** 차명 요약: "아반떼(CN7) 외 1개 차명" */
export function recallCars(r: Pick<Recall, "items">): string {
  const names = [...new Set(r.items.map((i) => i.name))]
  return names.length ? names[0] + (names.length > 1 ? ` 외 ${names.length - 1}개 차명` : "") : ""
}

/** 결함 장치 분류를 짧게: "원동기(동력발생장치) 기타" → "원동기" */
export function partLabel(part: string | null | undefined): string {
  return (part ?? "").replace(/\s*\(.*?\)/g, "").replace(/\s*기타$/, "").trim()
}

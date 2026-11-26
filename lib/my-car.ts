/**
 * "내 차" — 가입 없이 이 기기(localStorage)에만 저장하는 내 차 정보와 교체 시기 계산.
 * 서버에는 아무것도 보내지 않는다.
 */

export const MY_CAR_KEY = "mh_my_car"

export interface MyPartInfo {
  slug: string
  name: string
  intervalKm?: number
  intervalMonths?: number
  /** 규격 한 줄 (등록 직후 '맞는 부품' 목록용) */
  spec?: string
  /** 부품 직접 구매+공임나라 예상 금액 */
  self?: number
}

export interface MyCarSnapshot {
  id: string
  name: string
  photo?: string
  /** 사진 저작자·라이선스 한 줄 (CC BY-SA 표기) */
  credit?: string
  parts: MyPartInfo[]
}

export interface ChangeRecord {
  /** YYYY-MM-DD */
  date: string
  km?: number
}

export interface MyCar {
  car: MyCarSnapshot
  engine?: string
  /** 연식 (등록 때 고름. 예전 기록에는 없음) */
  year?: number
  km: number
  /** 주행거리를 적은 날 YYYY-MM-DD */
  kmDate: string
  records: Record<string, ChangeRecord>
}

export type DueState = "over" | "soon" | "ok" | "unknown"

export interface PartDue {
  part: MyPartInfo
  state: DueState
  /** 0~1+ : 주기 대비 얼마나 지났는지 (km·개월 중 큰 쪽) */
  ratio: number
  /** "3,200km 남음" / "1,500km 지남" / "2개월 남음" */
  text: string
  record?: ChangeRecord
}

export const today = (now = new Date()) => {
  const d = new Date(now.getTime() + 9 * 3600_000) // 한국 시간
  return d.toISOString().slice(0, 10)
}

function monthsBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / (86_400_000 * 30.44)
}

export function partDue(part: MyPartInfo, my: Pick<MyCar, "km" | "records">, now = today()): PartDue {
  const record = my.records[part.slug]
  if (!record) return { part, state: "unknown", ratio: -1, text: "마지막 교체 기록 없음" }

  let ratio = 0
  let text = ""
  let kmLeft: number | null = null
  let monLeft: number | null = null
  if (part.intervalKm && record.km != null) {
    const used = Math.max(0, my.km - record.km)
    ratio = Math.max(ratio, used / part.intervalKm)
    kmLeft = part.intervalKm - used
  }
  if (part.intervalMonths) {
    const used = Math.max(0, monthsBetween(record.date, now))
    ratio = Math.max(ratio, used / part.intervalMonths)
    monLeft = part.intervalMonths - used
  }
  if (kmLeft == null && monLeft == null) return { part, state: "unknown", ratio: -1, text: "교체 주기 정보 없음", record }

  // 더 급한 쪽 기준으로 문구
  const kmRatio = kmLeft != null && part.intervalKm ? 1 - kmLeft / part.intervalKm : -1
  const monRatio = monLeft != null && part.intervalMonths ? 1 - monLeft / part.intervalMonths : -1
  if (kmRatio >= monRatio && kmLeft != null) {
    text = kmLeft >= 0 ? `${Math.round(kmLeft).toLocaleString("ko-KR")}km 남음` : `${Math.round(-kmLeft).toLocaleString("ko-KR")}km 지남`
  } else if (monLeft != null) {
    const m = Math.round(Math.abs(monLeft))
    text = monLeft >= 0 ? (m < 1 ? "이번 달" : `${m}개월 남음`) : `${Math.max(1, m)}개월 지남`
  }
  const state: DueState = ratio >= 1 ? "over" : ratio >= 0.8 ? "soon" : "ok"
  return { part, state, ratio, text, record }
}

const ORDER: Record<DueState, number> = { over: 0, soon: 1, ok: 2, unknown: 3 }

export function dueList(my: MyCar, now = today()): PartDue[] {
  return my.car.parts.map((p) => partDue(p, my, now)).sort((a, b) => ORDER[a.state] - ORDER[b.state] || b.ratio - a.ratio)
}

export function loadMyCar(): MyCar | null {
  try {
    const v = JSON.parse(localStorage.getItem(MY_CAR_KEY) ?? "null") as MyCar | null
    return v && v.car?.id ? v : null
  } catch {
    return null
  }
}

export function saveMyCar(v: MyCar | null) {
  try {
    if (v) localStorage.setItem(MY_CAR_KEY, JSON.stringify(v))
    else localStorage.removeItem(MY_CAR_KEY)
    window.dispatchEvent(new Event("mh-my-car"))
  } catch {
    /* 사생활 보호 모드 등: 저장 못 해도 화면은 동작 */
  }
}

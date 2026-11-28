/**
 * "내 차" — 차 정보와 교체 시기 계산. 비로그인은 이 기기(localStorage)에만,
 * 로그인하면 lib/cloud-garage.ts가 계정에도 같이 저장한다.
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
  /** 부품값 예상 (쿠팡 시세 기준 추정) */
  price?: number
  /** 쿠팡에서 고른 맞는 상품의 실제 가격 (date 기준) */
  shop?: { price: number; date: string; url: string }
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
  /** 차 한 대의 고유 id (uuid). 계정 저장 때 그대로 키로 씀 */
  id?: string
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

/** 기록에 쓸 만한 주행거리가 있는지 (0은 '모름'으로 저장된 예전 값) */
export const hasKm = (r: ChangeRecord) => typeof r.km === "number" && r.km > 0

/** 교체 기록 하나 만들기: 주행거리 0(모름)은 넣지 않고, 미래 날짜는 오늘로 맞춤 */
export function makeRecord(date: string, km?: number, now = today()): ChangeRecord {
  const d = date > now ? now : date
  return km != null && km > 0 ? { date: d, km } : { date: d }
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
  let kmGuess = false
  // km:0 기록(예전 '오늘 교체했어요'가 주행거리 없이 0으로 저장)이나 지금 주행거리 모름은 '모름'으로 본다
  if (part.intervalKm && hasKm(record) && my.km > 0) {
    const used = Math.max(0, my.km - record.km!)
    ratio = Math.max(ratio, used / part.intervalKm)
    kmLeft = part.intervalKm - used
  } else if (part.intervalKm && !part.intervalMonths) {
    // km 주기만 있는 부품인데 주행거리를 모르면 한 달 평균(KM_PER_MONTH)으로 대략 계산
    const used = Math.max(0, monthsBetween(record.date, now)) * KM_PER_MONTH
    ratio = Math.max(ratio, used / part.intervalKm)
    kmLeft = part.intervalKm - used
    kmGuess = true
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
    const n = kmGuess ? Math.round(Math.abs(kmLeft) / 1000) * 1000 : Math.round(Math.abs(kmLeft))
    text = `${kmGuess ? "약 " : ""}${n.toLocaleString("ko-KR")}km ${kmLeft >= 0 ? "남음" : "지남"}`
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

// ── 차고: 차 여러 대. 비로그인은 이 기기에만, 로그인하면 계정(Supabase)에도 ──

export const GARAGE_KEY = "mh_garage"

export interface Garage {
  cars: MyCar[]
  /** 지금 보고 있는 차 id */
  active: string
}

export const newCarId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
      })

/** 저장된 값 → 차고. 예전 한 대짜리(mh_my_car)도 받아 준다 */
export function parseGarage(rawGarage: string | null, rawOld: string | null, makeId = newCarId): Garage {
  try {
    const g = JSON.parse(rawGarage ?? "null") as Garage | null
    if (g && Array.isArray(g.cars)) {
      const cars = g.cars.filter((c) => c?.car?.id).map((c) => (c.id ? c : { ...c, id: makeId() }))
      return { cars, active: cars.some((c) => c.id === g.active) ? g.active : cars[0]?.id ?? "" }
    }
  } catch {}
  try {
    const old = JSON.parse(rawOld ?? "null") as MyCar | null
    if (old?.car?.id) {
      const c = { ...old, id: old.id ?? makeId() }
      return { cars: [c], active: c.id! }
    }
  } catch {}
  return { cars: [], active: "" }
}

export function loadGarage(): Garage {
  try {
    const raw = localStorage.getItem(GARAGE_KEY)
    const old = localStorage.getItem(MY_CAR_KEY)
    const g = parseGarage(raw, old)
    // 예전 키만 있으면 바로 새 키로 옮겨서 id를 고정 (안 그러면 열 때마다 새 id → '모르겠어요'가 풀림)
    if (raw == null && old != null && g.cars.length) {
      try {
        localStorage.setItem(GARAGE_KEY, JSON.stringify(g))
        localStorage.removeItem(MY_CAR_KEY)
      } catch {}
    }
    return g
  } catch {
    return { cars: [], active: "" }
  }
}

export function saveGarage(g: Garage) {
  try {
    if (g.cars.length) localStorage.setItem(GARAGE_KEY, JSON.stringify(g))
    else localStorage.removeItem(GARAGE_KEY)
    localStorage.removeItem(MY_CAR_KEY) // 예전 키는 옮긴 뒤 지움
    window.dispatchEvent(new Event("mh-my-car"))
  } catch {
    /* 사생활 보호 모드 등: 저장 못 해도 화면은 동작 */
  }
}

/** 지금 보고 있는 차 (홈 카드·리콜 띠용) */
export function loadMyCar(): MyCar | null {
  const g = loadGarage()
  return g.cars.find((c) => c.id === g.active) ?? null
}

/** 차 한 대 넣기/고치기 (id 기준). 넣은 차가 지금 차가 된다 */
export function upsertCar(g: Garage, car: MyCar): Garage {
  const c = car.id ? car : { ...car, id: newCarId() }
  const has = g.cars.some((x) => x.id === c.id)
  return { cars: has ? g.cars.map((x) => (x.id === c.id ? c : x)) : [...g.cars, c], active: c.id! }
}

export function removeCar(g: Garage, id: string): Garage {
  const cars = g.cars.filter((c) => c.id !== id)
  return { cars, active: g.active === id ? cars[0]?.id ?? "" : g.active }
}

// ── 다음 할 일: 홈·정비소 화면이 같은 기준으로 "지금 챙길 부품" 하나를 고른다 ──

export type NextAction =
  | { type: "buy"; due: PartDue; urgent: PartDue[] } // 교체 시기 지남·곧 → 바로 사기
  | { type: "ask"; due: PartDue; left: number } // 기록 없는 부품 → 마지막 교체 시기를 한 번에 물음
  | { type: "ok"; due?: PartDue } // 다 기록했고 급한 것 없음 (due = 다음으로 가까운 것)
  | { type: "none" } // 부품 정보가 없는 차

/** skipped: '모름'을 누른 부품 slug (다시 묻지 않음) */
export function nextAction(my: MyCar, skipped: string[] = [], now = today()): NextAction {
  const list = dueList(my, now)
  if (!list.length) return { type: "none" }
  const urgent = list.filter((d) => d.state === "over" || d.state === "soon")
  if (urgent.length) return { type: "buy", due: urgent[0], urgent }
  // 자주 가는 부품(주기가 짧은 것)부터 묻는다
  const ask = list
    .filter((d) => d.state === "unknown" && !d.record && !skipped.includes(d.part.slug))
    .sort((a, b) => cycleKm(a.part) - cycleKm(b.part))
  if (ask.length) return { type: "ask", due: ask[0], left: ask.length }
  return { type: "ok", due: list.find((d) => d.state === "ok") }
}

const cycleKm = (p: MyPartInfo) => p.intervalKm ?? (p.intervalMonths ? p.intervalMonths * KM_PER_MONTH : 1e9)

/** 한 달 평균 주행거리 추정 (연 1만5천km). 교체 때 주행거리를 모를 때만 씀 */
export const KM_PER_MONTH = 1250

/** "6개월쯤 전에 갈았어요" 같은 대략 답 → 교체 기록. 지금 주행거리를 알면 그때 주행거리도 추정 */
export function quickRecord(my: Pick<MyCar, "km">, monthsAgo: number, now = today()): ChangeRecord {
  const d = new Date(`${now}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() - monthsAgo) // 달력 기준 N개월 전
  const date = d.toISOString().slice(0, 10)
  const km = my.km > 0 ? Math.round((my.km - monthsAgo * KM_PER_MONTH) / 100) * 100 : undefined
  return km != null && km > 0 ? { date, km } : { date }
}

/** 교체 기록 하나 지우기 (잘못 누른 기록 되돌리기) */
export function removeRecord<T extends Pick<MyCar, "records">>(my: T, slug: string): T {
  const records = { ...my.records }
  delete records[slug]
  return { ...my, records }
}

/** '모름'으로 넘긴 부품 (이 기기에만, 차마다) */
const SKIP_KEY = "mh_skip"
export function loadSkipped(carId: string): string[] {
  try {
    return (JSON.parse(localStorage.getItem(SKIP_KEY) || "{}") as Record<string, string[]>)[carId] ?? []
  } catch {
    return []
  }
}
export function saveSkipped(carId: string, slugs: string[]) {
  try {
    const all = JSON.parse(localStorage.getItem(SKIP_KEY) || "{}") as Record<string, string[]>
    all[carId] = slugs
    localStorage.setItem(SKIP_KEY, JSON.stringify(all))
  } catch {
    /* 저장이 막힌 브라우저 */
  }
}

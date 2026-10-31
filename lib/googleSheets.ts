import type { CompatibilityResult } from "./gemini"
import type { CarModel } from "@/types"

// Gemini 2.5 Flash 비용 추정: 호출당 ~2500 input + ~600 output tokens
// Input: $0.075/1M, Output: $0.30/1M → $0.00037/call ≈ 0.5원 (KRW 1350 기준)
export const GEMINI_COST_PER_CALL_KRW = 0.5

// VIN 앞 11자리 = WMI(3) + VDS(5) + Check digit(1) + Model year(1) + Plant(1)
// 동일 차종·연식·공장 범위를 커버하는 최소 식별 구간
export function makeVinPrefix(vin: string): string {
  return vin.slice(0, 11).toUpperCase()
}

function normalizePartName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function getScriptUrl(): string {
  const url = process.env.APPS_SCRIPT_URL
  if (!url) throw new Error("APPS_SCRIPT_URL 환경변수가 없습니다.")
  return url
}

export function sheetsEnabled(): boolean {
  return !!process.env.APPS_SCRIPT_URL
}

function withSecret(payload: Record<string, string>): string {
  const secret = process.env.APPS_SCRIPT_SECRET
  return new URLSearchParams(secret ? { ...payload, secret } : payload).toString()
}

// URLSearchParams → application/x-www-form-urlencoded → GAS e.parameter로 수신
async function callGas<T>(payload: Record<string, string>): Promise<T> {
  const res = await fetch(getScriptUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: withSecret(payload),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`GAS HTTP 오류: ${res.status}`)
  const data = await res.json()
  // GAS doPost는 내부 오류도 HTTP 200으로 반환 → body.error 별도 확인
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(`GAS 처리 오류: ${(data as Record<string, unknown>).error}`)
  }
  return data as T
}

// 저장 전용: 실패해도 예외를 던지지 않음
async function sendGas(payload: Record<string, string>): Promise<void> {
  try {
    await callGas(payload)
  } catch (err) {
    console.error(`[gas:${payload.action}]`, err)
  }
}

/**
 * 캐시 조회: GAS에 action:"lookup"으로 vinMasked + inputPart 키를 보내 검색
 * 네트워크/GAS 오류 시 null 반환 → Gemini API 호출로 자동 폴백
 */
export async function lookupCache(
  vinPrefix: string,
  inputPart: string,
): Promise<CompatibilityResult | null> {
  try {
    const res = await callGas<{ found: boolean; data?: CompatibilityResult }>({
      action: "lookup",
      vinMasked: vinPrefix + "******",
      inputPart: normalizePartName(inputPart),
    })
    return res.found && res.data ? res.data : null
  } catch (err) {
    console.error("[gas:lookup]", err)
    return null
  }
}

/**
 * 캐시 저장: Gemini 결과를 action:"save"로 GAS에 전송 → 시트에 행 추가
 * 실패해도 예외를 던지지 않음 (캐시 쓰기는 비크리티컬)
 *
 * GAS 시트 컬럼 매핑:
 *   A: vinMasked  B: inputPart  C: specs  D: resultJson  E: created_at
 */
export async function writeCache(
  vinPrefix: string,
  inputPart: string,
  result: CompatibilityResult,
): Promise<void> {
  const specs = [
    result.vehicle_spec?.manufacturer_model,
    result.vehicle_spec?.production_year,
    result.vehicle_spec?.engine_spec,
  ]
    .filter(Boolean)
    .join(" / ")

  await sendGas({
    action: "save",
    vinMasked: vinPrefix + "******",
    inputPart: normalizePartName(inputPart),
    specs,
    resultJson: JSON.stringify(result), // 객체를 미리 직렬화 — GAS가 문자열로 받아 시트에 기록
  })
}

/**
 * 캐시 행 수 조회: 어드민 통계용
 */
export async function getCacheRowCount(): Promise<number> {
  try {
    const res = await callGas<{ count: number }>({ action: "count" })
    return res.count ?? 0
  } catch {
    return 0
  }
}

// ── 행동 기록 (events 탭) ───────────────────────────────────────────────────

export interface TrackEvent {
  type: string
  target?: string
  carId?: string
  partId?: string
  path?: string
  referrer?: string
  meta?: Record<string, unknown>
}

export async function logEvent(e: TrackEvent): Promise<void> {
  if (!sheetsEnabled()) return
  await sendGas({
    action: "event",
    type: e.type,
    target: e.target ?? "",
    carId: e.carId ?? "",
    partId: e.partId ?? "",
    path: e.path ?? "",
    referrer: e.referrer ?? "",
    meta: e.meta ? JSON.stringify(e.meta) : "",
  })
}

export interface EventStats {
  total: number
  byType: Record<string, number>
  outbound: Record<string, number>
  carViews: Record<string, number>
  partClicks: Record<string, number>
  gongimClicks: Record<string, number>
  verify: { hits: number; misses: number }
  byDay: Record<string, { events: number; outbound: number }>
  topPaths: Record<string, number>
}

export const EMPTY_STATS: EventStats = {
  total: 0,
  byType: {},
  outbound: {},
  carViews: {},
  partClicks: {},
  gongimClicks: {},
  verify: { hits: 0, misses: 0 },
  byDay: {},
  topPaths: {},
}

export async function getEventStats(days?: number): Promise<EventStats> {
  if (!sheetsEnabled()) return EMPTY_STATS
  try {
    return await callGas<EventStats>({ action: "stats", days: days ? String(days) : "" })
  } catch (err) {
    console.error("[gas:stats]", err)
    return EMPTY_STATS
  }
}

// ── AI 생성 차종 (generated_cars 탭) ────────────────────────────────────────

export async function listGeneratedCars(): Promise<CarModel[]> {
  if (!sheetsEnabled()) return []
  try {
    const res = await callGas<{ cars: CarModel[] }>({ action: "car_list" })
    return res.cars ?? []
  } catch (err) {
    console.error("[gas:car_list]", err)
    return []
  }
}

export async function saveGeneratedCar(car: CarModel): Promise<void> {
  if (!sheetsEnabled()) return
  const { is_verified: _ignored, ...rest } = car
  await sendGas({ action: "car_save", carJson: JSON.stringify(rest) })
}

export async function updateGeneratedCar(id: string, patch: Partial<CarModel>): Promise<CarModel | null> {
  try {
    const res = await callGas<{ car: CarModel }>({ action: "car_update", id, patchJson: JSON.stringify(patch) })
    return res.car
  } catch (err) {
    console.error("[gas:car_update]", err)
    return null
  }
}

export async function deleteGeneratedCars(ids: string[]): Promise<number> {
  try {
    const res = await callGas<{ removed: number }>({ action: "car_delete", idsJson: JSON.stringify(ids) })
    return res.removed ?? 0
  } catch (err) {
    console.error("[gas:car_delete]", err)
    return 0
  }
}

import type { CompatibilityResult } from "./gemini"

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

// ── 조회/집계 전용 ── 응답 본문을 읽어야 하므로 일반 mode
// URLSearchParams → application/x-www-form-urlencoded → GAS e.parameter로 수신
async function callGas<T>(payload: Record<string, string>): Promise<T> {
  const res = await fetch(getScriptUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload).toString(),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`GAS HTTP 오류: ${res.status}`)
  const data = await res.json()
  // GAS doPost는 내부 오류도 HTTP 200으로 반환 → body.error 별도 확인
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(`GAS 처리 오류: ${(data as Record<string, unknown>).error}`)
  }
  return data as T
}

// ── 저장 전용 fire-and-forget ──
// application/x-www-form-urlencoded 은 CORS-safelisted content type
// → no-cors 모드와 호환, preflight OPTIONS 없이 전송
// → 응답은 opaque(status=0, body=null)이므로 읽지 않음
async function sendGas(payload: Record<string, string>): Promise<void> {
  console.log("[gas:send] 전송 데이터:", Object.fromEntries(
    Object.entries(payload).map(([k, v]) => [k, k === "resultJson" ? `(${v.length}자)` : v])
  ))
  await fetch(getScriptUrl(), {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload).toString(),
    signal: AbortSignal.timeout(10_000),
  })
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

  try {
    await sendGas({
      action: "save",
      vinMasked: vinPrefix + "******",
      inputPart: normalizePartName(inputPart),
      specs,
      resultJson: JSON.stringify(result),   // 객체를 미리 직렬화 — GAS가 문자열로 받아 시트에 기록
    })
  } catch (err) {
    console.error("[gas:save]", err)
  }
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

/**
 * 견적서 분석·부품 확인 화면 도우미 (React 없이 테스트할 수 있게 분리).
 *  - 마지막 견적서 결과를 이 기기에 잠깐 저장 (다른 화면에 갔다 와도 다시 보이게). 사진은 저장하지 않음.
 *  - 휴대폰 너비에서 차종 이름이 잘리지 않게 짧게.
 *  - 등록한 차 여러 대 중 분석할 수 있는 차만 골라 칩으로.
 */

export const QUOTE_SAVED_KEY = "mh_quote_last"
/** 이 시간이 지난 결과는 다시 보여 주지 않음 (가격·상품이 바뀌므로) */
export const QUOTE_SAVED_TTL = 6 * 3600_000

export interface SavedQuote<R> {
  at: number
  carId: string
  year: string
  engine: string
  result: R
}

/** 저장할 문자열. 사진(data: URL)처럼 큰 값이 섞이면 저장하지 않음 */
export function serializeQuote<R>(v: Omit<SavedQuote<R>, "at">, now = Date.now()): string | null {
  const s = JSON.stringify({ ...v, at: now })
  if (s.includes("data:image/") || s.length > 200_000) return null
  return s
}

/** 저장된 문자열 → 결과. 오래됐거나 모양이 다르거나 지금 목록에 없는 차면 null */
export function parseSavedQuote<R>(raw: string | null, carIds: string[], now = Date.now()): SavedQuote<R> | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<SavedQuote<R>> | null
    if (!v || typeof v !== "object" || typeof v.at !== "number" || typeof v.carId !== "string") return null
    if (now - v.at > QUOTE_SAVED_TTL || v.at > now + 60_000) return null
    if (!carIds.includes(v.carId)) return null
    const r = v.result as { items?: unknown } | undefined
    if (!r || typeof r !== "object" || !Array.isArray(r.items)) return null
    return { at: v.at, carId: v.carId, year: typeof v.year === "string" ? v.year : "", engine: typeof v.engine === "string" ? v.engine : "", result: v.result as R }
  } catch {
    return null
  }
}

/** "쏘렌토 MQ4 · 2020~현재" → "쏘렌토 MQ4 · 20~", "· 2020~2023" → "· 20~23" (390px에서 안 잘리게) */
export function shortCarLabel(label: string): string {
  return label
    .replace(/(\d{4})~현재$/, (_, a: string) => `${a.slice(2)}~`)
    .replace(/(\d{4})~(\d{4})$/, (_, a: string, b: string) => `${a.slice(2)}~${b.slice(2)}`)
}

/** 등록한 차 한 대 (lib/my-car의 MyCar 중 필요한 것만) */
export interface GarageCarLike {
  id?: string
  car: { id: string; name: string }
  year?: number
  engine?: string
}

export interface GarageChip {
  /** 등록한 차의 고유 id */
  key: string
  carId: string
  name: string
  year: string
  engine: string
}

/** 등록한 차 중 이 화면 목록(catalog)에 있는 차만, 같은 차·연식·엔진은 한 번만 */
export function garageChips(cars: GarageCarLike[], catalog: string[]): GarageChip[] {
  const seen = new Set<string>()
  const out: GarageChip[] = []
  for (const c of cars) {
    if (!catalog.includes(c.car.id)) continue
    const year = c.year ? String(c.year) : ""
    const engine = c.engine ?? ""
    const sig = `${c.car.id}|${year}|${engine}`
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push({ key: c.id ?? sig, carId: c.car.id, name: c.car.name, year, engine })
  }
  return out
}

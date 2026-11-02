/**
 * 차대번호(VIN)에서 "규칙상 확실한" 정보만 코드로 읽어냅니다. AI에 맡기지 않는 부분.
 *
 *  - 1~3번째(WMI): 제조사 — 아래 표에 있는 코드만 확정, 없으면 null (AI가 판단)
 *  - 10번째: 연식 — 국제 표준(ISO 3779 / 미국 49 CFR 565) 30년 주기 코드
 *
 * 차종·엔진(4~8번째, VDS)은 제조사 내부 코드라 여기서 해석하지 않습니다.
 */

export const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i

/** 제조사 식별 코드(WMI) → 브랜드. 확실한 것만 넣는다. */
const WMI_BRANDS: Record<string, string> = {
  // 기아
  KNA: "기아",
  KNB: "기아",
  KNC: "기아",
  KND: "기아",
  // 현대
  KMH: "현대",
  KMF: "현대",
  KMJ: "현대",
  // 제네시스
  KMT: "제네시스",
  // 르노코리아(구 르노삼성)
  KNM: "르노코리아",
  // KG모빌리티(구 쌍용)
  KPT: "KG모빌리티",
  // 테슬라 (미국 프리몬트, 상하이, 베를린)
  "5YJ": "테슬라",
  "7SA": "테슬라",
  LRW: "테슬라",
  XP7: "테슬라",
  // 독일
  WBA: "BMW",
  WBS: "BMW",
  WBY: "BMW",
  WDD: "메르세데스-벤츠",
  W1K: "메르세데스-벤츠",
  W1N: "메르세데스-벤츠",
  WAU: "아우디",
  WVW: "폭스바겐",
  WVG: "폭스바겐",
  WP0: "포르쉐",
  WP1: "포르쉐",
  // 기타
  YV1: "볼보",
  JTD: "토요타",
  JTH: "렉서스",
}

/** 10번째 자리 코드 순서 (I, O, Q, U, Z, 0 은 쓰지 않음) — 1980(A)부터 30년 주기 */
const YEAR_CODES = "ABCDEFGHJKLMNPRSTVWXY123456789"

/**
 * 10번째 자리 → 연식. 30년마다 같은 글자가 반복되므로
 * "올해+1년" 이하인 가장 최근 연도를 고른다. (예: K → 2019, 1989가 아니라)
 */
export function vinModelYear(vin: string, now = new Date()): number | null {
  if (!VIN_REGEX.test(vin)) return null
  const idx = YEAR_CODES.indexOf(vin[9].toUpperCase())
  if (idx < 0) return null
  const maxYear = now.getFullYear() + 1
  let year = 1980 + idx
  while (year + 30 <= maxYear) year += 30
  return year
}

export function vinBrand(vin: string): string | null {
  if (!VIN_REGEX.test(vin)) return null
  return WMI_BRANDS[vin.slice(0, 3).toUpperCase()] ?? null
}

export interface VinFacts {
  /** 확정된 브랜드 (표에 없으면 null) */
  brand: string | null
  /** 확정된 연식 */
  modelYear: number | null
}

export function vinFacts(vin: string, now = new Date()): VinFacts {
  return { brand: vinBrand(vin), modelYear: vinModelYear(vin, now) }
}

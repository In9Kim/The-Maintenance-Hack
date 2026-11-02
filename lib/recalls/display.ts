/**
 * 리콜 데이터 "표시용" 정규화. 원본(data/*.json의 maker·name)은 그대로 두고 화면·매칭에서만 바꿔 쓴다.
 *
 *  - 제작사: "(주)볼보자동차코리아" / "㈜볼보자동차코리아" / "볼보자동차코리아(주)" → "볼보" 하나로
 *  - 차명:   "펠리세이드" → "팰리세이드", "그랜져" → "그랜저" 같은 표기 흔들림
 */

/** 회사 형태 표기 제거: (주) ㈜ 주식회사 유한회사 (유) 등, 앞뒤 어디에 붙어도 */
export function cleanMakerName(raw: string): string {
  return raw
    .replace(/\(주\)|㈜|\(유\)|주식회사|유한책임회사|유한회사/g, " ")
    .replace(/\(([A-Za-z][^)]*)\)/g, " ") // (KG Mobility Corp.) 같은 영문 병기
    .replace(/\s+/g, " ")
    .trim()
}

/** 정리된 제작사명 앞부분 → [주소용 slug, 표시명]. 위에서부터 먼저 맞는 것 */
const MAKERS: [RegExp, string, string][] = [
  [/^현대자동차/, "hyundai", "현대자동차"],
  [/^기아/, "kia", "기아"],
  [/^제네시스/, "genesis", "제네시스"],
  [/^테슬라/, "tesla", "테슬라"],
  [/^비엠더블유|^BMW/i, "bmw", "BMW"],
  [/^메르세데스|^벤츠/, "mercedes-benz", "메르세데스-벤츠"],
  [/^한국지엠|^한국GM|^지엠/i, "gm-korea", "한국GM"],
  [/^르노/, "renault-korea", "르노코리아"],
  [/^케이지모빌리티|^KG/i, "kg-mobility", "KG모빌리티"],
  [/^쌍용/, "ssangyong", "쌍용자동차"],
  [/^폭스바겐/, "volkswagen", "폭스바겐"],
  [/^아우디/, "audi", "아우디"],
  [/^볼보(트럭|그룹)/, "volvo-trucks", "볼보트럭"],
  [/^볼보/, "volvo", "볼보"],
  [/^포르쉐/, "porsche", "포르쉐"],
  [/^한국토요타|^토요타/, "toyota", "토요타·렉서스"],
  [/^혼다/, "honda", "혼다"],
  [/^한국닛산|^닛산/, "nissan", "닛산"],
  [/^스텔란티스|^FCA/i, "stellantis", "스텔란티스(지프·푸조 등)"],
  [/^재규어|^JLR/i, "jaguar-land-rover", "재규어·랜드로버"],
  [/^포드/, "ford", "포드"],
  [/^링컨/, "lincoln", "링컨"],
  [/^GS글로벌|^지에스글로벌/i, "gs-global", "GS글로벌"],
  [/^비와이디|^BYD/i, "byd", "BYD"],
  [/^스카니아/, "scania", "스카니아"],
  [/^만트럭/, "man-truck", "만트럭버스"],
  [/^다임러트럭/, "daimler-truck", "다임러트럭"],
  [/^할리데이비슨/, "harley-davidson", "할리데이비슨"],
  [/^폴스타/, "polestar", "폴스타"],
  [/^캐딜락/, "cadillac", "캐딜락"],
  [/^에프엘오토/, "fl-auto", "에프엘오토코리아"],
]

function hash6(s: string): string {
  // FNV-1a — 같은 이름이면 항상 같은 주소
  let h = 0x811c9dc5
  for (const ch of s) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0").slice(0, 6)
}

/** 원문 제작자명 → 표시명·주소. 회사 형태 표기만 다른 이름은 같은 결과가 나온다 */
export function displayMaker(raw: string): { makerName: string; makerSlug: string } {
  const clean = cleanMakerName(raw) || raw
  for (const [re, slug, name] of MAKERS) if (re.test(clean)) return { makerSlug: slug, makerName: name }
  return { makerSlug: `maker-${hash6(clean)}`, makerName: clean }
}

/** 차명 표기 흔들림 (원문 → 표준). 매칭에도 쓰이므로 확실한 오타만 넣는다 */
const CAR_NAME_FIXES: [RegExp, string][] = [
  [/펠리세이드/g, "팰리세이드"],
  [/그랜져/g, "그랜저"],
  [/싼타 페|산타페/g, "싼타페"],
  [/소렌토/g, "쏘렌토"],
  [/아반테/g, "아반떼"],
  [/투산(?!업)/g, "투싼"],
]

export function displayCarName(raw: string): string {
  let s = raw
  for (const [re, to] of CAR_NAME_FIXES) s = s.replace(re, to)
  return s
}

/**
 * 부품 호환 확인: AI(Gemini)에게 넘기는 내용을 여기서 만든다. 화면(/check)에 "AI에게 이렇게 물어봐요"로 그대로 공개.
 *
 * 약속 (입력 → AI → 출력)
 *  - 차량: 사용자가 고른 차종(브랜드·모델·세대)·연식·엔진. 차대번호는 받지 않는다.
 *  - 상품: 쿠팡 '공유하기'로 복사한 글(상품명 + 링크), 상품 링크, 또는 상품명·품번 중 하나.
 *          글에서 링크를 떼고 남은 상품명을 쓰고, 상품명이 없으면 링크의 페이지 제목을 읽는다.
 *  - 근거: 정비핵 데이터(제조사 취급설명서 기준 규격·순정 품번)를 함께 넘겨 이 값과 대조하게 한다.
 *  - 출력: 맞음(YES)·안 맞음(NO)·확인 필요(UNCERTAIN) + 근거(규격·품번) + 결론. 단정 표현은 금지.
 * 데이터 파일을 읽지 않는 순수 함수만 둔다 (node --test).
 */

export interface CompatCar {
  id: string
  brand: string
  model: string
  generation: string
  yearRange: string
  engineTypes: string[]
  parts: { name: string; spec: string; engine?: string; partNumber?: string }[]
}

export interface CompatVehicle {
  manufacturer_model: string
  production_year: string
  engine_spec: string
}

const URL_RE = /https?:\/\/[^\s<>"']+/gi

/** 붙여 넣은 글 → 링크와 상품명. 쿠팡 공유 글("[쿠팡] 상품명 https://link.coupang.com/a/xxx") 등 */
export function parseProductInput(text: string): { url?: string; name?: string } {
  const t = String(text ?? "").slice(0, 2000)
  const urls = t.match(URL_RE) ?? []
  const name = t
    .replace(URL_RE, " ")
    .replace(/\[(쿠팡|coupang|네이버|11번가|G마켓)\]/gi, " ")
    .replace(/쿠팡(에서|을 통해)?\s*(확인|보기|구매)하?세요[.!]?/g, " ")
    .replace(/(지금|바로)?\s*(구매|확인)하러\s*가기/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return { url: urls[0]?.replace(/[)\].,]+$/, ""), name: name.length >= 4 ? name.slice(0, 300) : undefined }
}

/** 고른 차 → AI에 넘길 확정 차량 정보 + 정비핵 규격(근거) + 캐시 키 */
export function buildCompatRequest(car: CompatCar, year?: number, engine?: string) {
  const eng = engine && car.engineTypes.includes(engine) ? engine : undefined
  const vehicle: CompatVehicle = {
    manufacturer_model: `${car.brand} ${car.model} ${car.generation}`.trim(),
    production_year: year ? `${year}년형` : `${car.yearRange} (연식 미선택)`,
    engine_spec: eng ?? (car.engineTypes.length === 1 ? car.engineTypes[0] : `${car.engineTypes.join(" / ")} 중 하나 (엔진 미선택)`),
  }
  const reference = car.parts
    .filter((p) => !p.engine || !eng || p.engine === eng)
    .map((p) => `- ${p.name}: ${p.spec}${p.partNumber ? ` (순정 품번 ${p.partNumber})` : ""}`)
    .join("\n")
  return { vehicle, reference, cacheKey: `car:${car.id}|${year ?? ""}|${eng ?? ""}` }
}

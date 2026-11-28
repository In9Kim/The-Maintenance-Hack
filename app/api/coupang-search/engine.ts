/**
 * 쿠팡 검색 결과에서 엔진이 다른 상품 거르기 (디젤 쏘렌토에 하이브리드·가솔린 오일 세트가 먼저 나오던 문제).
 * 상품명에 엔진 낱말이 적혀 있는데 우리 엔진 낱말이 하나도 없으면 다른 엔진용으로 본다. 엔진 낱말이 없는 상품은 그대로 둔다.
 */
export type EngineKind = "diesel" | "gasoline" | "hybrid" | "lpg" | "ev"

const PATTERNS: [EngineKind, RegExp][] = [
  ["hybrid", /하이브리드|hybrid|\bP?HEV\b/i],
  ["diesel", /디젤|diesel|CRDi|\bVGT\b|\bD\d\.\d/i],
  ["lpg", /LPG|LPi|엘피지/i],
  ["ev", /전기차|\bEV\b|일렉트릭/i],
  ["gasoline", /가솔린|휘발유|gasoline|T-?GDi|\bGDi\b|\bMPi\b|\bG\d\.\d/i],
]

/** 글에 적힌 엔진 종류들 (하이브리드는 가솔린 낱말(T-GDi)이 같이 있어도 하이브리드로만) */
export function enginesIn(text: string): EngineKind[] {
  const found = PATTERNS.filter(([, re]) => re.test(text)).map(([k]) => k)
  return found.includes("hybrid") ? found.filter((k) => k !== "gasoline") : found
}

/** 부품 이름의 괄호 '(디젤)' 또는 등록한 엔진 이름('D2.2 디젤')에서 우리 엔진 하나. 모르면 null */
export function ourEngine(partName: string, engine?: string | null): EngineKind | null {
  const paren = partName.match(/\(([^)]*)\)/g)?.join(" ") ?? ""
  const fromPart = enginesIn(paren)
  if (fromPart.length === 1) return fromPart[0]
  const fromEngine = engine ? enginesIn(engine) : []
  return fromEngine.length === 1 ? fromEngine[0] : null
}

/** 다른 엔진용 상품을 뺀다. 다 빠지면 원래 목록을 그대로 (빈 화면보다 낫게) */
export function filterByEngine<T extends { name: string }>(items: T[], ours: EngineKind | null): T[] {
  if (!ours) return items
  const kept = items.filter((x) => {
    const e = enginesIn(x.name)
    return !e.length || e.includes(ours)
  })
  return kept.length ? kept : items
}

/** 검색어에 붙일 엔진 낱말 */
export const ENGINE_WORD: Record<EngineKind, string> = { diesel: "디젤", gasoline: "가솔린", hybrid: "하이브리드", lpg: "LPG", ev: "전기차" }

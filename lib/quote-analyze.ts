/**
 * 견적서·점검내역 사진 분석 (Claude, 이미지 입력 + JSON 형식 고정 출력).
 * 사진은 저장하지 않는다. 이름·전화·차량번호 같은 개인정보는 읽어도 출력하지 말라고 지시한다.
 *
 * 약속 (입력 → AI → 출력)
 *  - 입력: 사진 1장 + 사용자가 고른 차종·연식·엔진 + 정비핵의 이 차 소모품 데이터(id·이름·규격·부품값·공임)
 *  - 출력: 항목마다 이름·분류·적힌 부품값/공임·이미 한 작업인지 권고인지·판정(공임나라 / 센터 / 물어보기)·이유,
 *          정비핵 소모품과 같은 항목이면 그 id
 */
import type { CompatCar } from "@/lib/compat-request"

export type QuoteVerdict = "gongim" | "center" | "ask"

export interface QuoteItem {
  name: string
  kind: "done" | "recommended" | "inspection"
  /** 사거나 바꾸는 부품(오일·액 포함)이 있는 항목인가. false(점검·클리닝·탈부착만)면 화면에서 뺀다 */
  has_part: boolean
  parts_price: number | null
  labor_price: number | null
  verdict: QuoteVerdict
  reason: string
  match_part_id: string | null
}

export interface QuoteResult {
  readable: boolean
  shop: string
  items: QuoteItem[]
  summary: string
}

export interface QuoteCarPart {
  id: string
  name: string
  spec: string
  engine?: string
  coupangPrice: number
  laborCost: number
  dealerPartPrice: number
  dealerLaborCost: number
}

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    kind: { type: "string", enum: ["done", "recommended", "inspection"] },
    has_part: { type: "boolean" },
    parts_price: { type: ["integer", "null"] },
    labor_price: { type: ["integer", "null"] },
    verdict: { type: "string", enum: ["gongim", "center", "ask"] },
    reason: { type: "string" },
    match_part_id: { type: ["string", "null"] },
  },
  required: ["name", "kind", "has_part", "parts_price", "labor_price", "verdict", "reason", "match_part_id"],
  additionalProperties: false,
}

export const QUOTE_SCHEMA = {
  type: "object",
  properties: {
    readable: { type: "boolean" },
    shop: { type: "string" },
    items: { type: "array", items: ITEM_SCHEMA },
    summary: { type: "string" },
  },
  required: ["readable", "shop", "items", "summary"],
  additionalProperties: false,
}

const ACTION = /(교환|교체|점검|수리|작업|추천|권고|권장|필요|요망|정비|탈부착|탈착|보충|조정|진단)$/
const STOP = new Set(["및", "좌", "우", "좌우", "좌/우", "앞", "뒤", "전", "후", "LH", "RH", "1EA", "2EA", "세트", "SET", "부품", "공임"])

/** 견적서에 쓰는 이름 → 쿠팡 상품명에 흔한 이름 (쿠팡은 '쇽업소버'보다 '쇼바'로 찾아야 나옴) */
const MARKET: Record<string, string> = { 쇽업소버: "쇼바", 속업소버: "쇼바", 쇼크업소버: "쇼바", 쇼버: "쇼바", 하부암: "로어암", 로워암: "로어암", 엔진브라켓: "엔진미미", 엔진마운트: "엔진미미", 미션마운트: "미션미미" }

/** 견적서 항목 이름 → 쿠팡 검색어 ("프론트하부암어셈블리 교환" → "로어암") */
export function quoteSearchWord(name: string): string {
  const words = name
    .split(/[,·]/)[0]
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .split(/[\s,·/]+/)
    .map((w) => {
      let x = w.replace(ACTION, "").replace(ACTION, "").trim()
      x = x.replace(/\d+(EA|개)$/i, "")
      for (let k = 0; k < 2; k++) x = x.replace(/(어셈블리|어셈|ASSY|SET|세트|KIT)$/i, "")
      x = x.replace(/^(프론트|리어|프런트)(?=.{2,})/, "")
      return MARKET[x] ?? x
    })
    .filter((w) => w.length >= 1 && !STOP.has(w) && !STOP.has(w.toUpperCase()) && !/^\d+(EA|개|L)?$/i.test(w) && !/^(프론트|리어|프런트)$/.test(w))
  return words.slice(0, 3).join(" ").slice(0, 30)
}

/** 미션오일처럼 차마다 규격이 달라 잘못 사면 위험한 것 (쿠팡 상품을 보여 주지 않음) */
export function needsSpecCheck(name: string): boolean {
  return /미션\s*오일|ATF|CVT|변속기\s*오일|디퍼런셜/i.test(name)
}

/** AI에 넘길 지시문 (화면의 'AI에게 이렇게 물어봐요'와 같은 내용) */
export function buildQuotePrompt(car: CompatCar, parts: QuoteCarPart[], year?: number, engine?: string): string {
  const eng = engine && car.engineTypes.includes(engine) ? engine : undefined
  const ref = parts
    .filter((p) => !p.engine || !eng || p.engine === eng)
    .map((p) => `- id=${p.id} | ${p.name} | 규격: ${p.spec} | 직접 구매 부품값 약 ${p.coupangPrice}원 + 공임나라 공임 약 ${p.laborCost}원`)
    .join("\n")
  return `너는 20년 경력 자동차 정비사다. 사진은 정비소(공식센터·일반 정비소)의 견적서·점검내역·작업명세서다.
차량(사용자가 고름): ${car.brand} ${car.model} ${car.generation} · ${year ? `${year}년형` : "연식 미선택"} · ${eng ?? car.engineTypes.join(" / ")}

할 일
1. 사진의 정비 항목을 빠짐없이 읽는다. 표의 작업 내용뿐 아니라 '기술자 소견'·'권고'처럼 다음에 하라고 적힌 항목도 각각 하나의 항목으로 나눈다.
   점검 결과 줄(예: '배터리 점검 — 불량')과 권고·견적 줄(예: '배터리 교체 — 부품 165,000원')은 같은 부품이라도 합치지 말고 따로 쓴다. 이름은 사진에 적힌 대로(교체·교환 같은 말 포함).
2. kind: 이미 한 작업은 done, 앞으로 하라고 권한 항목은 recommended, 점검만 한 항목은 inspection.
   has_part: 사거나 바꾸는 부품(오일·액·필터 포함)이 있는 항목이면 true. 점검·안심점검·진단·클리닝·세척·탈부착·정조립·조정·공임만 있는 항목은 false (예: '7년차 안심점검' false, '연료펌프어셈블리 및 세척' true).
3. parts_price·labor_price: 그 항목 줄에 적힌 금액만 정수로. 적혀 있지 않거나 0이면 null. 금액을 지어내지 않는다.
4. verdict
   - gongim: 부품을 직접 사서 공임나라 같은 일반 정비소에 교체만 맡기기 쉬운 소모품·정비 (엔진오일·필터·와이퍼·배터리·브레이크 패드/디스크/액·점화플러그·냉각수·미션오일·벨트·쇼크업소버·하부 암 같은 볼트 체결 부품 등)
   - center: 리콜·무상수리·보증수리, 소프트웨어 업데이트, 고장 진단, 에어백·전자제어 장치, 변속기·엔진 내부 분해, 판금·도장·범퍼 교체처럼 공식센터나 전문점이 나은 것
   - ask: 위 둘로 확실히 나누기 어렵거나 지점마다 다른 것 (클리닝·첨가제류, 연료펌프·인젝터 같은 고가 부품 등)
5. reason: 판정 이유를 한 문장으로. 부품을 사서 가져가면 되는지, 왜 센터가 나은지. 단정 대신 가능성으로 말한다.
6. match_part_id: 아래 정비핵 소모품 목록과 같은 항목이면 그 id, 아니면 null.
7. shop: 정비소 종류(예: 기아 오토큐, 블루핸즈, 일반 정비소, 알 수 없음).
8. summary: 사용자에게 줄 결론 1~2문장 (공임나라로 돌릴 만한 항목이 몇 개인지 등).
9. 사진이 견적서·점검내역이 아니거나 글자를 읽을 수 없으면 readable=false, items는 빈 배열.

개인정보: 고객 이름·전화번호·차량번호·주소는 읽었더라도 어떤 칸에도 쓰지 않는다.

[정비핵 소모품 목록 — 이 차 기준]
${ref}`
}

/** 견적서 분석 모델. 기본 Haiku 5.5 (Opus보다 약 40배 쌈, 2026-11-27 사용자 결정). QUOTE_MODEL로 바꿀 수 있음 */
export const QUOTE_MODEL = process.env.QUOTE_MODEL || "claude-haiku-5-5"

/** 생각하는 양. "low"가 첫 항목이 빨리 나옴 (medium은 첫 글자까지 약 6초, 2026-11-27 운영 측정). QUOTE_EFFORT로 바꿀 수 있음 */
export const QUOTE_EFFORT = process.env.QUOTE_EFFORT || "low"

/** Claude 호출 (서버 전용). 키가 없으면 에러. lean: 모델이 effort·fallbacks 옵션을 거부하면 빼고 다시 보낼 때 */
export async function analyzeQuoteImage(base64: string, mediaType: string, prompt: string, lean = false): Promise<QuoteResult> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error("NO_KEY")
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      // 안전 분류기가 거절하면 서버에서 다른 모델로 다시 시도
      ...(lean ? {} : { "anthropic-beta": "server-side-fallback-2026-07-01" }),
    },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: QUOTE_MODEL,
      max_tokens: 16000,
      ...(lean ? {} : { fallbacks: "default" }),
      output_config: { ...(lean ? {} : { effort: QUOTE_EFFORT }), format: { type: "json_schema", schema: QUOTE_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    // 이 모델이 받지 않는 옵션(effort·fallbacks)이면 빼고 한 번 더
    if (!lean && res.status === 400 && /effort|fallback|beta/i.test(body)) return analyzeQuoteImage(base64, mediaType, prompt, true)
    throw new Error(`HTTP ${res.status} ${body.slice(0, 300)}`)
  }
  const data = (await res.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] }
  if (data.stop_reason === "refusal") throw new Error("REFUSAL")
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("")
  return JSON.parse(text) as QuoteResult
}

/**
 * analyzeQuoteImage와 같지만 받는 대로(스트리밍): 항목이 하나 완성될 때마다 onItem, 끝나면 전체 결과.
 * 화면이 10초 동안 멈춰 있지 않고 첫 항목이 몇 초 만에 보이게 하려고 (lib/quote-stream.ts).
 */
export async function streamQuoteImage(
  base64: string,
  mediaType: string,
  prompt: string,
  onItem: (item: QuoteItem) => void,
  lean = false,
): Promise<QuoteResult> {
  const { ItemExtractor, parseSse } = await import("@/lib/quote-stream")
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error("NO_KEY")
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      ...(lean ? {} : { "anthropic-beta": "server-side-fallback-2026-07-01" }),
    },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: QUOTE_MODEL,
      max_tokens: 16000,
      stream: true,
      ...(lean ? {} : { fallbacks: "default" }),
      output_config: { ...(lean ? {} : { effort: QUOTE_EFFORT }), format: { type: "json_schema", schema: QUOTE_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  })
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "")
    if (!lean && res.status === 400 && /effort|fallback|beta/i.test(body)) return streamQuoteImage(base64, mediaType, prompt, onItem, true)
    throw new Error(`HTTP ${res.status} ${body.slice(0, 300)}`)
  }
  const ex = new ItemExtractor<QuoteItem>()
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  let stop: string | undefined
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const r = parseSse(buf + dec.decode(value, { stream: true }))
    buf = r.rest
    if (r.stop) stop = r.stop
    for (const t of r.texts) for (const it of ex.push(t)) onItem(it)
  }
  if (stop === "refusal") throw new Error("REFUSAL")
  if (stop === "error") throw new Error("STREAM_ERROR")
  return JSON.parse(ex.full) as QuoteResult
}

/** 상품명이 내 엔진과 안 맞으면 false (터보 아닌 차에 "1.6 터보" 상품, 터보 차에 "터보X" 상품). 엔진을 모르면 true */
export function fitsEngine(productName: string, engine?: string): boolean {
  if (!engine) return true
  const turboCar = /터보|T-?GDI/i.test(engine)
  const noTurbo = /터보\s*X|non-?turbo|NA/i.test(productName)
  const turbo = /터보|T-?GDI/i.test(productName) && !noTurbo
  return turboCar ? !noTurbo : !turbo
}

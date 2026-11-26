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
    parts_price: { type: ["integer", "null"] },
    labor_price: { type: ["integer", "null"] },
    verdict: { type: "string", enum: ["gongim", "center", "ask"] },
    reason: { type: "string" },
    match_part_id: { type: ["string", "null"] },
  },
  required: ["name", "kind", "parts_price", "labor_price", "verdict", "reason", "match_part_id"],
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
2. kind: 이미 한 작업은 done, 앞으로 하라고 권한 항목은 recommended, 점검만 한 항목은 inspection.
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

/** Claude 호출 (서버 전용). 키가 없으면 에러 */
export async function analyzeQuoteImage(base64: string, mediaType: string, prompt: string): Promise<QuoteResult> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error("NO_KEY")
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      // 안전 분류기가 거절하면 서버에서 다른 모델로 다시 시도
      "anthropic-beta": "server-side-fallback-2026-07-01",
    },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: process.env.QUOTE_MODEL || "claude-opus-5-5",
      max_tokens: 16000,
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: QUOTE_SCHEMA } },
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
    throw new Error(`HTTP ${res.status} ${body.slice(0, 300)}`)
  }
  const data = (await res.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] }
  if (data.stop_reason === "refusal") throw new Error("REFUSAL")
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("")
  return JSON.parse(text) as QuoteResult
}

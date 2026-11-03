import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai"

/**
 * 사용할 Gemini 모델 (앞에서부터 시도).
 * 무료 등급은 새 모델에 사람이 몰리면 503("high demand")이나 지연이 잦아서,
 * 실패하면 다음 모델로 넘어갑니다. 모두 무료 등급에서 쓸 수 있는 모델입니다.
 *   - 환경변수 GEMINI_MODEL 을 넣으면 그 모델을 맨 앞에 시도
 *   - 환경변수 GEMINI_MODELS="a,b,c" 로 전체 순서를 바꿀 수 있음
 * gemini-2.5-flash는 신규 키에서 404("no longer available to new users")라 제외.
 */
const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"]
export const GEMINI_MODELS: string[] = (() => {
  const list = process.env.GEMINI_MODELS
    ? process.env.GEMINI_MODELS.split(",").map((m) => m.trim()).filter(Boolean)
    : DEFAULT_MODELS
  const first = process.env.GEMINI_MODEL?.trim()
  return first ? [first, ...list.filter((m) => m !== first)] : list
})()
export const GEMINI_MODEL = GEMINI_MODELS[0]

/**
 * Gemini 3.x는 기본으로 "생각(thinking)"을 medium 수준으로 해서 응답이 크게 늦어질 수 있음.
 * 부품 호환 판정·차종 JSON 생성은 짧은 작업이라 low로 충분 (환경변수 GEMINI_THINKING_LEVEL: low | medium | high)
 */
const GEMINI_THINKING_LEVEL = process.env.GEMINI_THINKING_LEVEL || "low"
/** 모델 하나당 기다리는 시간. 넘으면 다음 모델로 */
const GEMINI_TIMEOUT_MS = 20_000

/** 키가 잘못된 경우처럼 다른 모델로 바꿔도 소용없는 에러 */
function isFatal(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /\b(401|403)\b|API key not valid|PERMISSION_DENIED|credit balance/i.test(msg)
}

// ── Claude (기본) ────────────────────────────────────────────────────────────
/**
 * Max 플랜 월 API 크레딧으로 Claude를 먼저 쓰고, 키가 없거나 실패하면 Gemini로 넘어간다.
 *   - 환경변수 ANTHROPIC_API_KEY 가 없으면 Claude는 건너뜀
 *   - 환경변수 CLAUDE_MODELS="a,b" 로 모델 순서를 바꿀 수 있음 (기본: 가볍고 저렴한 Haiku)
 * 크레딧이 떨어지면 API가 멈추므로(플랜 요금으로 청구되지 않음) 그때는 자동으로 Gemini가 받는다.
 */
export const CLAUDE_MODELS: string[] = (process.env.CLAUDE_MODELS || "claude-haiku-5-5")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean)
const CLAUDE_TIMEOUT_MS = 25_000
const CLAUDE_MAX_TOKENS = 4096

/** Gemini SDK의 result.response.text() 모양에 맞춰 돌려준다 (호출부 코드를 그대로 두기 위해) */
type AiResult = { response: { text(): string } }

async function claudeGenerate(model: string, prompt: string): Promise<AiResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    signal: AbortSignal.timeout(CLAUDE_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      max_tokens: CLAUDE_MAX_TOKENS,
      // 최신 Claude 모델은 temperature를 받지 않음(400 "temperature is deprecated") → 보내지 않는다.
      // 같은 차량 판정 일관성은 고정 차량 정보(lib/vehicle-spec.ts)와 결과 캐시로 지킨다.
      system: "요청한 JSON 객체 하나만 출력한다. 코드블록·설명 문장은 쓰지 않는다.",
      messages: [{ role: "user", content: prompt }],
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`[claude ${model}] HTTP ${res.status} ${body.slice(0, 300)}`)
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] }
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("")
  if (!text.trim()) throw new Error(`[claude ${model}] 빈 응답`)
  return { response: { text: () => text } }
}

/** Claude·Gemini 키 중 하나라도 있어야 AI 기능을 쓸 수 있음 */
function requireAiKey() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
    throw new Error("AI 키(ANTHROPIC_API_KEY 또는 GEMINI_API_KEY)가 설정되지 않았습니다.")
  }
}

/**
 * Claude 모델 → Gemini 모델 순서로 시도하는 generateContent.
 * 기존 코드의 `model.generateContent(prompt)` → `result.response.text()` 사용법을 그대로 유지합니다.
 */
function getModel(generationConfig: GenerationConfig) {
  requireAiKey()
  const geminiKey = process.env.GEMINI_API_KEY
  const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null
  const modelFor = (name: string) =>
    genAI!.getGenerativeModel(
      {
        model: name,
        // SDK 타입에 아직 thinkingConfig가 없어 캐스팅 (요청 본문에는 그대로 전달됨)
        generationConfig: {
          ...generationConfig,
          thinkingConfig: { thinkingLevel: GEMINI_THINKING_LEVEL },
        } as GenerationConfig,
      },
      { timeout: GEMINI_TIMEOUT_MS }
    )

  return {
    async generateContent(prompt: string): Promise<AiResult> {
      let lastErr: unknown
      if (process.env.ANTHROPIC_API_KEY) {
        for (const name of CLAUDE_MODELS) {
          try {
            return await claudeGenerate(name, prompt)
          } catch (err) {
            lastErr = err
            console.warn(`[claude] ${name} 실패 → 다음 모델 시도:`, err instanceof Error ? err.message : err)
            if (isFatal(err)) break
          }
        }
      }
      if (genAI) {
        for (const name of GEMINI_MODELS) {
          try {
            return await modelFor(name).generateContent(prompt)
          } catch (err) {
            lastErr = err
            console.warn(`[gemini] ${name} 실패 → 다음 모델 시도:`, err instanceof Error ? err.message : err)
            if (isFatal(err)) break
          }
        }
      }
      throw lastErr
    },
  }
}

/** 방문자에게 보여줄 에러 문구 (구글 원문 에러는 서버 로그에만 남김) */
export function friendlyAiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/GEMINI_API_KEY|ANTHROPIC_API_KEY/.test(msg)) return "AI 기능 설정이 아직 끝나지 않았습니다. 잠시 후 다시 시도해 주세요."
  if (/\b(402|429)\b|quota|exhausted|depleted|rate.?limit/i.test(msg))
    return "AI 검증 사용량이 많아 잠시 쉬고 있어요. 몇 분 뒤 다시 시도해 주세요."
  if (/\b(5\d\d)\b|timeout|timed out|abort/i.test(msg))
    return "AI 응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요."
  return "AI 분석 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요."
}
import type { CarModel } from "@/types"

export interface GenerateCarInput {
  brand: string
  model: string
  generation?: string
  yearRange?: string
  engineType: string
  vin?: string
}

export interface VinDecodeResult {
  brand: string | null
  model: string | null
  generation: string | null
  yearRange: string | null
  engineType: string | null
  country: string | null
}

// 공임나라 기준 공임표 (Gemini 프롬프트에 삽입)
const GONGIM_LABOR_REFERENCE = `
공임나라(www.gongim.com) 표준 공임 기준 (국산차 / 수입차):
- 엔진오일+오일필터: 국산 13,000~18,000원 / 수입 18,000~28,000원
- 에어클리너 필터: 5,000~8,000원
- 에어컨(캐빈) 필터: 5,000~8,000원
- 브레이크패드 전륜: 국산 28,000~40,000원 / 수입 45,000~65,000원
- 브레이크패드 후륜: 국산 32,000~45,000원 / 수입 50,000~70,000원
- 와이퍼 블레이드: 0~5,000원 (대부분 셀프 교체 가능)
- 점화플러그(4개): 국산 18,000~28,000원 / 수입 28,000~45,000원
- 배터리 교환: 13,000~18,000원
- 브레이크 오일: 15,000~22,000원
`

export async function generateCarMaintenanceData(input: GenerateCarInput): Promise<CarModel> {
  const model = getModel({
    responseMimeType: "application/json",
    temperature: 0.1,
  })

  const isKorean = ["현대", "기아", "제네시스"].includes(input.brand)
  const isTesla = input.brand === "테슬라"
  const isEV = isTesla || input.engineType.toLowerCase().includes("전기") || input.engineType.toLowerCase().includes("ev")
  const laborType = isKorean ? "국산차" : "수입차"

  const baseId = [input.brand, input.model, input.generation]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^\w가-힣\s]/g, "")
    .replace(/\s+/g, "-")

  const prompt = `
당신은 자동차 정비 데이터 전문가입니다. 아래 차량의 소모품 정비 데이터를 JSON으로 생성하세요.

[중요: 모델명 표준화 규칙]
- model 필드와 generation 필드는 반드시 공식 한국 시장 표준 명칭을 사용하세요.
- 입력값이 비표준이더라도 응답은 항상 표준화된 명칭으로 반환해야 합니다.
- 예: "올뉴K3", "K3 ALL NEW", "케이쓰리 올뉴" → model: "K3", generation: "올뉴 (2세대)"
- 예: "쏘나타 dn8", "DN8 쏘나타" → model: "쏘나타", generation: "DN8 (8세대)"
- 예: "그랜저 ig", "IG 그랜저" → model: "그랜저", generation: "IG (6세대)"
- 기아 표준 모델명: K3, K5, K7, K8, K9, 쏘렌토, 스포티지, 카니발, 스팅어, EV6, EV9
- 현대 표준 모델명: 아반떼, 쏘나타, 그랜저, 투싼, 싼타페, 팰리세이드, 아이오닉5, 아이오닉6

[차량 정보]
- 브랜드: ${input.brand}
- 모델 (입력값, 표준화 필요): ${input.model}
- 세대/트림: ${input.generation ?? "최신형"}
- 연식: ${input.yearRange ?? "2020~현재"}
- 엔진: ${input.engineType}

[공임나라 기준 공임표]
${GONGIM_LABOR_REFERENCE}

[가격 산출 기준]
- coupangPrice: 쿠팡 마켓의 호환품 기준 합리적 시세 (KRW 단위 정수)
- laborCost: 위 공임나라 기준표의 ${laborType} 공임 (중간값 적용)
- dealerPartPrice: coupangPrice의 ${isKorean ? "1.6~2.5배" : "2~3배"} (공식 딜러 마진 포함)
- dealerLaborCost: laborCost의 2~3배 (공식 서비스 센터 공임)
${isEV ? `
[전기차 특이사항]
- 엔진오일, 점화플러그, 에어클리너 필터 항목 제외
- 포함 필수 항목: HEPA+캐빈필터(category: filter), 브레이크패드 전(category: brake), 브레이크패드 후(category: brake), 와이퍼(category: wiper), 12V 보조배터리(category: battery), 브레이크 오일(category: fluid)` : `
[내연기관 포함 필수 항목]
엔진오일+오일필터(oil), 에어클리너(filter), 에어컨필터(filter), 브레이크패드 전(brake), 브레이크패드 후(brake), 와이퍼(wiper), 점화플러그-해당 없으면 생략(spark), 배터리(battery)`}

[반환 형식] - 아래 TypeScript 타입에 정확히 맞는 JSON만 반환:
{
  "id": "${baseId}",
  "brand": "${input.brand}",
  "model": "${input.model}",
  "generation": "${input.generation ?? ""}",
  "yearRange": "${input.yearRange ?? "2020~현재"}",
  "engineTypes": ["${input.engineType}"],
  "parts": [
    {
      "id": "${baseId}-[영문부품명]",
      "name": "한국어 부품명",
      "category": "oil|filter|brake|wiper|spark|battery|belt|fluid",
      "spec": "한국어 규격 (용량, 크기, 규격번호 등)",
      "partNumber": "OEM 호환 번호 (선택)",
      "coupangPrice": 0,
      "laborCost": 0,
      "dealerPartPrice": 0,
      "dealerLaborCost": 0,
      "intervalKm": 0,
      "intervalMonths": 0,
      "coupangKeyword": "쿠팡 검색어 한국어"
    }
  ]
}

intervalKm, intervalMonths, partNumber 필드는 해당 없으면 포함하지 마세요.
JSON만 반환하고 설명 텍스트는 일절 포함하지 마세요.
`

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()

  // JSON 파싱 (응답에 마크다운 코드블록이 포함된 경우 대비)
  const parsed = (() => {
    try {
      return JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) return JSON.parse(match[0])
      throw new Error("Gemini 응답을 JSON으로 파싱할 수 없습니다.")
    }
  })()

  return parsed as CarModel
}

export interface VehicleSpec {
  manufacturer_model: string
  production_year: string
  engine_spec: string
}

export interface PartAnalysis {
  part_name: string
  oemNumber: string
  verdict: "YES" | "NO" | "UNCERTAIN"
  reason: string
}

export interface CompatibilityResult {
  compatibility: "YES" | "NO" | "UNCERTAIN"
  vehicle_spec: VehicleSpec
  parts_analysis: PartAnalysis[]
  expert_tips: string[]
  conclusion: string
}

/**
 * 차량 정보만 먼저 해석 (부품 판정과 분리).
 * 코드로 확정한 브랜드·연식(lib/vin.ts)은 AI가 바꾸지 못하게 프롬프트에 박고, 결과에도 덮어쓴다.
 * 이 결과는 구글시트에 저장해서 같은 차량은 항상 같은 정보로 판정한다 (lib/vehicle-spec.ts).
 */
export async function decodeVehicleSpec(
  vin: string,
  facts: { brand: string | null; modelYear: number | null }
): Promise<VehicleSpec> {
  const model = getModel({ responseMimeType: "application/json", temperature: 0 })

  const fixedLines = [
    facts.brand ? `- 제조사: ${facts.brand} (차대번호 1~3번째 자리로 확정 — 변경 금지)` : null,
    facts.modelYear ? `- 연식: ${facts.modelYear}년식 (차대번호 10번째 자리로 확정 — 변경 금지)` : null,
  ].filter(Boolean)

  const prompt = `
너는 자동차 제원 전문가다. 아래 차대번호(VIN)의 차량 정보만 JSON으로 답하라. 부품 이야기는 하지 마라.

차대번호: ${vin}
${fixedLines.length ? `[이미 확정된 값]\n${fixedLines.join("\n")}` : ""}

[규칙]
- 4~8번째 자리(VDS)로 모델·세대·엔진을 판단한다.
- 엔진은 그 연식·국내 판매 사양 기준으로 가장 대표적인 것을 적되, 연식 안에 여러 엔진이 있어 VIN만으로 확정이 어려우면
  "1.6 가솔린 (세부 엔진 형식 확인 필요)"처럼 확실한 부분까지만 적어라. 모르는 내용을 지어내지 마라.
- 모델을 판단할 수 없으면 manufacturer_model에 "확인 필요"라고 적어라.

[출력 — JSON만]
{
  "manufacturer_model": "브랜드 + 모델명 + 세대 코드 (예: 기아 올 뉴 K3 BD 3세대)",
  "production_year": "예: 2019년식",
  "engine_spec": "엔진 형식 + 배기량 + 연료 + 구동방식 (예: 1.6 가솔린, 전륜구동(FF))"
}
`
  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()
  let spec: VehicleSpec
  try {
    spec = JSON.parse(text) as VehicleSpec
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("차량 정보 해석 결과를 파싱할 수 없습니다.")
    spec = JSON.parse(match[0]) as VehicleSpec
  }
  // 코드로 확정한 값은 AI 답과 상관없이 덮어쓴다
  if (facts.modelYear) spec.production_year = `${facts.modelYear}년식`
  if (facts.brand && spec.manufacturer_model && !spec.manufacturer_model.startsWith(facts.brand)) {
    spec.manufacturer_model = `${facts.brand} ${spec.manufacturer_model.replace(/^(기아|현대|제네시스|테슬라)\s*/, "")}`
  }
  return spec
}

export async function verifyCompatibility(
  vin: string,
  productInfo: string,
  category?: string,
  /** 확정된 차량 정보. 있으면 AI가 차량을 다시 해석하지 않고 이 정보로만 판정 */
  fixedSpec?: VehicleSpec
): Promise<CompatibilityResult> {
  // temperature=0: 창의성 배제, 동일 입력에 항상 동일한 사실 기반 판정 출력
  const model = getModel({ responseMimeType: "application/json", temperature: 0 })

  const categoryLine = category
    ? `사용자 지정 카테고리: [${category}] ← 반드시 이 카테고리의 부품으로만 분석할 것. 다른 카테고리로 절대 오분류 금지.`
    : `카테고리: 상품 정보에서 자동 추론`

  const prompt = `
[시스템 페르소나]
너는 20년 경력의 베테랑 자동차 정비사이자 부품 전문가야. 기술적으로 정확하고, 치수·규격·순정번호 등 근거가 되는 수치를 명시한다.
다만 차대번호와 상품 정보만으로는 실제 장착 여부를 100% 확정할 수 없으므로, 판정은 "가능성"으로 표현한다.

[표현 규칙 — 절대 준수]
- 금지 표현: "확정 호환", "완벽히/완벽하게", "100%", "안심하고 구매", "틀림없이", "무조건".
- YES 판정은 "호환 가능성이 높습니다", NO 판정은 "맞지 않을 가능성이 높습니다"처럼 가능성으로 말한다.
- conclusion(결론)의 마지막 문장은 반드시 "구매 전 차량 설명서·품번으로 확인하세요."로 끝낸다.

[판정 일관성 원칙 — 절대 준수]
1. 판정은 항상 일관되어야 한다. 동일한 입력에 서로 다른 판정을 내리는 것은 심각한 오류다.
2. 확실한 근거(순정 품번 직접 매칭, 제조사 공식 스펙)가 없으면 반드시 UNCERTAIN으로 일관되게 응답한다. "어떨 때는 YES, 어떨 때는 NO"는 절대 금지.
3. 사용자가 카테고리를 명시적으로 지정한 경우, 그 카테고리 범위 안에서만 분석한다. 다른 카테고리로 재분류하지 않는다.
4. [부품 품번 사전 지식 — 오분류 방지]
   - HP4098 = 상신브레이크(Sangsin) 하드론 시리즈 브레이크패드 품번 → 절대 오일필터·에어필터 등으로 분류하지 마라.
   - 26300-XXXXX 계열 = 기아/현대 순정 오일필터
   - 58101-XXXXX / 58302-XXXXX 계열 = 기아/현대 순정 브레이크패드 (전/후)
   - 16546-XXXXX / 28113-XXXXX 계열 = 에어클리너 필터

[VIN 자릿수 해석 규칙]
- 1~3번째(WMI): 제조국·제조사 코드. KNA/KNB/KMH/KMJ = 한국 기아·현대, WBA = BMW 독일, 1HG = Honda 미국
- 4~8번째(VDS): 차종·바디·엔진 코드 (제조사별 상이)
- 9번째: 검증 자리 (Check digit)
- 10번째(연식): A=1980, B=1981 … Y=2000, 1=2001 … 9=2009, A=2010, B=2011, C=2012, D=2013, E=2014, F=2015, G=2016, H=2017, J=2018, K=2019, L=2020, M=2021, N=2022, P=2023, R=2024, S=2025
- 11번째: 생산 공장 코드
- 12~17번째(VIS): 생산 일련번호

[VIN 정확도 보정 — Few-Shot 예시]
VIN: KNAF241BEKA856318
→ WMI KNA = 기아 대한민국, 10번째 자리 K = 2019년식, VDS = 올 뉴 K3 BD 3세대 1.6 가솔린
→ 정답: 2019년형 기아 올 뉴 K3 (BD, 3세대)
(주의: KNA WMI를 쏘렌토·스포티지 등으로 잘못 분류하면 심각한 오류임)

[판정 기준]
- YES: OEM 품번 일치, 규격(직경·두께·용량 등) 완전 일치, 해당 차종 전용 제품임이 명확
- NO: 규격 불일치, 다른 차종 전용 부품, 엔진 형식 미지원
- UNCERTAIN: 범용(OE 호환) 제품으로 트림·연식별 추가 확인 필요, 정보 부족

[입력 데이터]
차대번호(VIN): ${vin}
${
  fixedSpec
    ? `[확정 차량 정보 — 차대번호를 다시 해석하지 말고 이 정보를 그대로 사용할 것. vehicle_spec에도 그대로 적을 것]
- 모델: ${fixedSpec.manufacturer_model}
- 연식: ${fixedSpec.production_year}
- 엔진: ${fixedSpec.engine_spec}`
    : ""
}
${categoryLine}
상품 정보: ${productInfo}

[출력 형식 — JSON만 반환, 설명 텍스트 절대 포함 금지]
{
  "compatibility": "YES" | "NO" | "UNCERTAIN",
  "vehicle_spec": {
    "manufacturer_model": "브랜드 + 풀 모델명 + 세대 코드 (예: 기아 올 뉴 K3 BD 3세대)",
    "production_year": "정밀 분석된 연식 (예: 2019년식)",
    "engine_spec": "엔진 형식 + 배기량 + 연료 + 구동방식 (예: 1.6 GDi 가솔린, 전륜구동(FF))"
  },
  "parts_analysis": [
    {
      "part_name": "부품명 (예: 전륜 브레이크패드)",
      "oemNumber": "추정 순정/OEM 품번 (예: 58101-H8A00) — 반드시 포함, 모를 경우 '확인 필요'",
      "verdict": "YES" | "NO" | "UNCERTAIN",
      "reason": "매칭 근거: 디스크 직경·두께·캘리퍼 타입 등 구체적 규격 수치 포함"
    }
  ],
  "expert_tips": [
    "팁 1: 교체 시 주의사항 (예: 전·후륜 동시 교체 권장)",
    "팁 2: 공임나라 기준 예상 공임 정보 (예: 전륜 브레이크패드 공임 28,000~40,000원)",
    "팁 3: 추가 확인 사항 또는 전문가 조언"
  ],
  "conclusion": "판정 요약 1~2문장 (가능성 표현) + 마지막 문장은 '구매 전 차량 설명서·품번으로 확인하세요.'"
}
`

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()

  let parsed: CompatibilityResult
  try {
    parsed = JSON.parse(text) as CompatibilityResult
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("호환성 분석 결과를 파싱할 수 없습니다.")
    parsed = JSON.parse(match[0]) as CompatibilityResult
  }
  if (fixedSpec) parsed.vehicle_spec = fixedSpec
  return parsed
}

export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  const model = getModel({ responseMimeType: "application/json", temperature: 0.1 })

  const prompt = `
차대번호(VIN)를 분석하여 정확한 차량 정보를 JSON으로 반환하세요.

VIN: ${vin}

VIN 해석 기준:
- WMI (1~3번째 자리): 제조국/제조사 코드
- VDS (4~9번째 자리): 차종, 모델, 엔진 코드
- VIS (10~17번째 자리): 연식(10번째), 공장, 일련번호

반환 형식 (JSON만, 설명 없이):
{
  "brand": "공식 한국어 브랜드명 (예: 기아, 현대, BMW, 벤츠)",
  "model": "공식 한국 시장 표준 모델명 (예: K3, 쏘렌토, 아반떼, 3시리즈)",
  "generation": "세대 코드 포함 명칭 (예: MQ4 (4세대), CE (1세대))",
  "yearRange": "해당 연식 범위 (예: 2021~2023)",
  "engineType": "엔진 형식 한국어 (예: 1.6 GDi 가솔린, 2.2 CRDi 디젤, 전기 (RWD))",
  "country": "제조국 (예: 대한민국, 독일, 미국)"
}

모델명은 반드시 공식 표준 명칭으로 표기하세요. 알 수 없는 필드는 null로 반환하세요.
`

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()

  try {
    return JSON.parse(text) as VinDecodeResult
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as VinDecodeResult
    throw new Error("VIN 분석 결과를 파싱할 수 없습니다.")
  }
}

import { GoogleGenerativeAI } from "@google/generative-ai"
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
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.")
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: "models/gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
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

export async function verifyCompatibility(
  vin: string,
  productInfo: string,
  category?: string
): Promise<CompatibilityResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: "models/gemini-2.5-flash",
    // temperature=0: 창의성 배제, 동일 입력에 항상 동일한 사실 기반 판정 출력
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  })

  const categoryLine = category
    ? `사용자 지정 카테고리: [${category}] ← 반드시 이 카테고리의 부품으로만 분석할 것. 다른 카테고리로 절대 오분류 금지.`
    : `카테고리: 상품 정보에서 자동 추론`

  const prompt = `
[시스템 페르소나]
너는 20년 경력의 베테랑 자동차 정비사이자 부품 전문가야. 국산차와 수입차를 아울러 수만 건의 정비 경험을 갖고 있으며, 차대번호(VIN) 한 줄로 차량의 모든 제원을 꿰뚫어 본다. 기술적으로 정확하고, 치수·규격·순정번호 등 구체적 수치를 명시하며, 고객이 안심하고 구매 결정을 내릴 수 있도록 명확하고 확신에 찬 어조로 답변한다. 모호한 표현("아마", "것 같습니다") 대신 단정적 판정을 제공하는 것이 너의 원칙이다.

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
→ WMI KNA = 기아 대한민국, 10번째 자리 K = 2019년식, VDS F241B = 올 뉴 K3 BD 3세대 1.6 GDi 가솔린
→ 정답: 2019년형 기아 올 뉴 K3 (BD, 3세대)
(주의: KNA WMI를 쏘렌토·스포티지 등으로 잘못 분류하면 심각한 오류임)

[판정 기준]
- YES: OEM 품번 일치, 규격(직경·두께·용량 등) 완전 일치, 해당 차종 전용 제품임이 명확
- NO: 규격 불일치, 다른 차종 전용 부품, 엔진 형식 미지원
- UNCERTAIN: 범용(OE 호환) 제품으로 트림·연식별 추가 확인 필요, 정보 부족

[입력 데이터]
차대번호(VIN): ${vin}
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
  "conclusion": "사용자에게 주는 최종 확답 — 구매를 확정지을 수 있는 안심 멘트 (1~2문장)"
}
`

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()

  try {
    return JSON.parse(text) as CompatibilityResult
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as CompatibilityResult
    throw new Error("호환성 분석 결과를 파싱할 수 없습니다.")
  }
}

export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: "models/gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
  })

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

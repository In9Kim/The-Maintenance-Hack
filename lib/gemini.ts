import { GoogleGenerativeAI } from "@google/generative-ai"
import type { CarModel } from "@/types"

export interface GenerateCarInput {
  brand: string
  model: string
  generation?: string
  yearRange?: string
  engineType: string
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

[차량 정보]
- 브랜드: ${input.brand}
- 모델: ${input.model}
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

import { NextRequest, NextResponse, after } from "next/server"
import { generateCarMaintenanceData, decodeVin, type GenerateCarInput } from "@/lib/gemini"
import type { CarModel } from "@/types"
import { getAllCars } from "@/lib/data/all-cars"
import { saveGeneratedCar } from "@/lib/googleSheets"

function normalizeForMatch(str: string): string {
  return str.toLowerCase().replace(/[\s\-_]/g, "").replace(/[^\w가-힣]/g, "")
}

function isSimilarCar(existing: CarModel, brand: string, model: string, generation?: string): boolean {
  if (normalizeForMatch(existing.brand) !== normalizeForMatch(brand)) return false

  const normExisting = normalizeForMatch(existing.model)
  const normInput = normalizeForMatch(model)
  const modelMatch =
    normExisting === normInput ||
    normExisting.includes(normInput) ||
    normInput.includes(normExisting)

  if (!modelMatch) return false

  if (generation && existing.generation) {
    const normExistingGen = normalizeForMatch(existing.generation)
    const normInputGen = normalizeForMatch(generation)
    return normExistingGen.includes(normInputGen) || normInputGen.includes(normExistingGen)
  }

  return true
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    let input = body as GenerateCarInput

    // VIN이 제공된 경우 먼저 디코딩하여 표준화된 차량 정보 획득
    const VIN_PLACEHOLDER = "_vin_"
    if (input.vin) {
      const vinInfo = await decodeVin(input.vin)
      input = {
        ...input,
        brand: vinInfo.brand ?? (input.brand !== VIN_PLACEHOLDER ? input.brand : ""),
        model: vinInfo.model ?? (input.model !== VIN_PLACEHOLDER ? input.model : ""),
        generation: vinInfo.generation ?? input.generation,
        yearRange: vinInfo.yearRange ?? input.yearRange,
        engineType: vinInfo.engineType ?? (input.engineType !== VIN_PLACEHOLDER ? input.engineType : ""),
      }
    }

    if (!input.brand || !input.model || !input.engineType) {
      return NextResponse.json(
        { error: "brand, model, engineType 필드는 필수입니다." },
        { status: 400 }
      )
    }

    // 1단계: Gemini 호출 전 DB 사전 중복 검사 (Fuzzy Matching) — 기본 차종 + 시트의 생성 차종
    const allCars = await getAllCars()
    try {
      const existing = allCars.find((c) =>
        isSimilarCar(c, input.brand, input.model, input.generation)
      )
      if (existing) {
        console.log(`[중복 감지] 사전 검사: ${existing.brand} ${existing.model} ${existing.generation}`)
        return NextResponse.json({ car: existing, duplicate: true })
      }
    } catch {
      // DB 읽기 실패는 무시하고 Gemini 호출 진행
    }

    // 2단계: Gemini로 정규화된 차종 데이터 생성
    const carData = await generateCarMaintenanceData(input)

    // 3단계: Gemini 응답의 표준화된 모델명으로 재중복 검사
    const existingAfterNorm = allCars.find((c) =>
      isSimilarCar(c, carData.brand, carData.model, carData.generation)
    )
    if (existingAfterNorm) {
      console.log(`[중복 감지] 정규화 후 검사: ${existingAfterNorm.brand} ${existingAfterNorm.model}`)
      return NextResponse.json({ car: existingAfterNorm, duplicate: true })
    }

    // 중복 없음 → 구글시트에 저장 (검증 대기 상태 — 관리자 검증 필요)
    if (!allCars.some((c) => c.id === carData.id)) {
      after(() => saveGeneratedCar(carData))
      console.log(`[신규 저장] ${carData.brand} ${carData.model} (${carData.id}) — 검증 대기`)
    }

    return NextResponse.json({ car: carData })
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
    console.error("[generate-car-data]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextRequest, NextResponse, after } from "next/server"
import { generateCarMaintenanceData, decodeVin, friendlyAiError, type GenerateCarInput } from "@/lib/gemini"
import type { CarModel } from "@/types"
import { getAllCars } from "@/lib/data/all-cars"
import { saveGeneratedCar } from "@/lib/googleSheets"
import { userIdFrom } from "@/lib/auth-user"
import { cleanGenInput, genStore, refundGenUser, takeGen } from "./limit"

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
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "요청을 읽지 못했어요." }, { status: 400 })
  }
  const cleaned = cleanGenInput(body)
  if (!cleaned) return NextResponse.json({ error: "요청을 읽지 못했어요." }, { status: 400 })

  // AI를 부르기 직전에 한 번만: 로그인 확인 + 계정 하루 한도 + 사이트 전체 하루 상한 (이미 있는 차종 찾기는 공짜)
  let uid: string | null = null
  const store = await genStore()
  const gate = async (): Promise<NextResponse | null> => {
    if (uid) return null
    const id = await userIdFrom(req)
    if (!id) return NextResponse.json({ error: "로그인하면 쓸 수 있어요.", login: true }, { status: 401 })
    const take = await takeGen(store, id)
    if (take === "user") return NextResponse.json({ error: "오늘은 여기까지예요. 내일 다시 해 주세요." }, { status: 429 })
    if (take === "global") return NextResponse.json({ error: "오늘 사용이 많아 잠시 멈췄어요. 내일 다시 해 주세요." }, { status: 429 })
    uid = id
    return null
  }

  try {
    let input: GenerateCarInput = cleaned

    // VIN이 제공된 경우 먼저 디코딩하여 표준화된 차량 정보 획득 (AI 호출이라 한도 확인 뒤)
    const VIN_PLACEHOLDER = "_vin_"
    if (input.vin) {
      const blocked = await gate()
      if (blocked) return blocked
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
    const blocked = await gate()
    if (blocked) return blocked
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
    console.error("[generate-car-data]", err instanceof Error ? err.message : err)
    // AI가 실패했으면 그 사람 몫 1번은 돌려준다 (전체 상한은 그대로)
    if (uid) await refundGenUser(store, uid).catch(() => {})
    return NextResponse.json({ error: friendlyAiError(err) }, { status: 500 })
  }
}

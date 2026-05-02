import { NextRequest, NextResponse } from "next/server"
import { generateCarMaintenanceData, type GenerateCarInput } from "@/lib/gemini"
import fs from "fs"
import path from "path"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = body as GenerateCarInput

    if (!input.brand || !input.model || !input.engineType) {
      return NextResponse.json(
        { error: "brand, model, engineType 필드는 필수입니다." },
        { status: 400 }
      )
    }

    const carData = await generateCarMaintenanceData(input)

    // 파일 캐싱: 개발 환경 또는 파일시스템이 writable한 경우
    // Vercel 배포 환경에서는 read-only이므로 catch 후 무시
    try {
      const dataPath = path.join(process.cwd(), "data", "vehicles.json")
      const raw = fs.readFileSync(dataPath, "utf-8")
      const current = JSON.parse(raw) as { cars: { id: string }[] }

      if (!current.cars.some((c) => c.id === carData.id)) {
        current.cars.push(carData)
        fs.writeFileSync(dataPath, JSON.stringify(current, null, 2), "utf-8")
        console.log(`[캐시] 새 차종 저장: ${carData.brand} ${carData.model} (${carData.id})`)
      }
    } catch (cacheErr) {
      // 파일 쓰기 실패는 비치명적 — 응답은 정상 반환
      console.warn("[캐시 건너뜀]", cacheErr instanceof Error ? cacheErr.message : cacheErr)
    }

    return NextResponse.json({ car: carData })
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
    console.error("[generate-car-data]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

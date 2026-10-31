import vehiclesData from "@/data/vehicles.json"
import type { CarModel } from "@/types"

/**
 * 차량 데이터는 data/vehicles.json에서 관리합니다.
 * 새 차종 추가 시 JSON 파일에 항목을 추가하면 됩니다.
 * 각 부품 항목의 필드 설명은 types/index.ts의 MaintenancePart 인터페이스를 참고하세요.
 */
// is_verified가 명시적으로 false인 항목만 제외 (undefined = 기존 차종, true로 취급)
export const CAR_DATA: CarModel[] = (vehiclesData.cars as CarModel[]).filter(
  (c) => c.is_verified !== false
)

export function getAllBrands(): string[] {
  return Array.from(new Set(CAR_DATA.map((c) => c.brand)))
}

export function getModelsByBrand(brand: string): CarModel[] {
  return CAR_DATA.filter((c) => c.brand === brand)
}

export function getCarById(id: string): CarModel | undefined {
  return CAR_DATA.find((c) => c.id === id)
}

export function findCarByModelName(query: string, year?: string): CarModel | undefined {
  if (!query) return undefined
  const q = query.toLowerCase()

  // "2019년식" → 2019, "2019" → 2019
  const yearNum = year ? parseInt(year) : NaN

  let best: CarModel | undefined
  let bestScore = 0

  for (const car of CAR_DATA) {
    const haystack = `${car.brand} ${car.model} ${car.generation}`.toLowerCase()
    const tokens = q.split(/\s+/).filter((t) => t.length >= 2)
    let score = tokens.filter((t) => haystack.includes(t)).length

    // yearRange("2016~2019", "2020~현재")에 연식이 포함되면 +1 보너스
    if (!isNaN(yearNum) && car.yearRange) {
      const m = car.yearRange.match(/(\d{4})~(\d{4}|현재)/)
      if (m) {
        const from = parseInt(m[1])
        const to = m[2] === "현재" ? new Date().getFullYear() : parseInt(m[2])
        if (yearNum >= from && yearNum <= to) score += 1
      }
    }

    if (score > bestScore) {
      bestScore = score
      best = car
    }
  }

  return bestScore >= 2 ? best : undefined
}

import vehiclesData from "@/data/vehicles.json"
import type { CarModel } from "@/types"

/**
 * 차량 데이터는 data/vehicles.json에서 관리합니다.
 * 새 차종 추가 시 JSON 파일에 항목을 추가하면 됩니다.
 * 각 부품 항목의 필드 설명은 types/index.ts의 MaintenancePart 인터페이스를 참고하세요.
 */
export const CAR_DATA: CarModel[] = vehiclesData.cars as CarModel[]

export function getAllBrands(): string[] {
  return Array.from(new Set(CAR_DATA.map((c) => c.brand)))
}

export function getModelsByBrand(brand: string): CarModel[] {
  return CAR_DATA.filter((c) => c.brand === brand)
}

export function getCarById(id: string): CarModel | undefined {
  return CAR_DATA.find((c) => c.id === id)
}

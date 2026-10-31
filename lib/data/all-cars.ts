import vehiclesData from "@/data/vehicles.json"
import type { CarModel } from "@/types"
import { listGeneratedCars } from "@/lib/googleSheets"

/**
 * 기본 차종: data/vehicles.json (코드와 함께 배포, 검색 페이지 생성에 사용)
 * 생성 차종: 사용자가 요청해 AI가 만든 차종 → 구글시트 generated_cars 탭에 저장
 *
 * Cloudflare Workers는 파일 쓰기가 불가능하므로 기본 차종은 읽기 전용입니다.
 * 검증된 생성 차종을 기본 차종으로 올리려면 data/vehicles.json에 옮겨 담아 배포합니다.
 */
export const BASE_CARS: CarModel[] = (vehiclesData as { cars: CarModel[] }).cars

const BASE_IDS = new Set(BASE_CARS.map((c) => c.id))

export function isBaseCar(id: string): boolean {
  return BASE_IDS.has(id)
}

export async function getAllCars(): Promise<CarModel[]> {
  const generated = (await listGeneratedCars()).filter((c) => !BASE_IDS.has(c.id))
  return [...BASE_CARS, ...generated]
}

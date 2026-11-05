import type { CarModel, MaintenancePart } from "@/types"

/**
 * 엔진별로 규격이 다른 소모품 (part.engine) 처리
 *  - part.engine 이 없는 소모품: 모든 엔진 공통
 *  - part.engine 이 있는 소모품: 그 엔진에만 해당
 * 엔진별 소모품이 하나도 없는 차종은 예전처럼 한 표로 보여준다.
 */

/** 엔진별 소모품이 있는 엔진 목록 (차종 engineTypes 순서) */
export function carEngines(car: CarModel): string[] {
  const used = new Set(car.parts.map((p) => p.engine).filter(Boolean) as string[])
  if (!used.size) return []
  const ordered = car.engineTypes.filter((e) => used.has(e))
  return [...ordered, ...[...used].filter((e) => !ordered.includes(e))]
}

/** 이 엔진 차량에 해당하는 소모품 (공통 + 해당 엔진) */
export function partsForEngine(car: CarModel, engine: string | null): MaintenancePart[] {
  if (!engine) return car.parts
  return car.parts.filter((p) => !p.engine || p.engine === engine)
}

/** 엔진별(또는 하나의) 소모품 묶음 */
export function engineGroups(car: CarModel): { engine: string | null; parts: MaintenancePart[] }[] {
  const engines = carEngines(car)
  return engines.length ? engines.map((engine) => ({ engine, parts: partsForEngine(car, engine) })) : [{ engine: null, parts: car.parts }]
}

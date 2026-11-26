import type { CarModel } from "@/types"
import type { DiagramPart } from "@/components/cars/CarDiagram"
import { carShortName, intervalText, partCost, partSlug } from "@/lib/seo"
import { coupangChoicesFor, naverShoppingFor } from "@/lib/coupang-links"
import { bodyTypeOf, isElectric, zoneLabel, zoneOf, type ZoneId } from "@/lib/car-diagram"

const ZONE_ORDER: ZoneId[] = ["engine", "front", "rear", "cabin", "wiper"]

/** 부품 위치 도면 데이터 (차종 페이지와 첫 화면 '내 차'가 같이 씀) */
export function diagramFor(car: CarModel) {
  const body = bodyTypeOf(car)
  const ev = isElectric(car)
  const parts: DiagramPart[] = car.parts.map((p) => {
    const c = partCost(p)
    return {
      id: p.id,
      name: p.name,
      spec: p.spec,
      engine: p.engine,
      href: `/cars/${car.id}/${partSlug(car, p)}`,
      interval: intervalText(p) ?? undefined,
      dealer: c.dealer,
      self: c.self,
      zone: zoneOf(p),
      cat: p.category,
      choices: coupangChoicesFor(p),
      naver: naverShoppingFor(p)?.url,
    }
  })
  const zones = ZONE_ORDER.filter((z) => parts.some((p) => p.zone === z)).map((z) => ({ id: z, ...zoneLabel(z, { ev, body }) }))
  return { carId: car.id, carName: carShortName(car), body, zones, parts }
}

export type DiagramData = ReturnType<typeof diagramFor>

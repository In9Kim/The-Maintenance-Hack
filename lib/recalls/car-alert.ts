import { seoCars, carShortName } from "@/lib/seo"
import { recallsForCar } from "@/lib/recalls/data"

import type { CarRecallAlert } from "./year"
export type { CarRecallAlert }

let cache: Record<string, CarRecallAlert> | null = null

/** 차종 id → 리콜 요약 (리콜이 있는 차종만). 데이터가 배포 때 고정이라 한 번만 계산 */
export function carRecallAlerts(): Record<string, CarRecallAlert> {
  if (cache) return cache
  const out: Record<string, CarRecallAlert> = {}
  for (const car of seoCars()) {
    const rs = recallsForCar(car.id)
    if (!rs.length) continue
    out[car.id] = {
      name: carShortName(car),
      r: rs
        .map((x): CarRecallAlert["r"][number] => {
          const froms = x.items.map((i) => i.from).filter(Boolean).sort()
          const tos = x.items.map((i) => i.to).filter(Boolean).sort()
          return [x.id, x.startDate, froms[0] ?? "", tos[tos.length - 1] ?? ""]
        })
        .sort((a, b) => b[1].localeCompare(a[1])),
    }
  }
  cache = out
  return out
}

import { seoCars, carShortName } from "@/lib/seo"
import { recallsForCar } from "@/lib/recalls/data"

/** 리콜 띠에 필요한 최소 정보: 차종별 리콜 건수와 가장 최근 리콜 */
export interface CarRecallAlert {
  count: number
  latestId: string
  latestDate: string
  name: string
}

let cache: Record<string, CarRecallAlert> | null = null

/** 차종 id → 리콜 요약 (리콜이 있는 차종만). 데이터가 배포 때 고정이라 한 번만 계산 */
export function carRecallAlerts(): Record<string, CarRecallAlert> {
  if (cache) return cache
  const out: Record<string, CarRecallAlert> = {}
  for (const car of seoCars()) {
    const rs = recallsForCar(car.id)
    if (!rs.length) continue
    const latest = rs.reduce((a, r) => (r.startDate > a.startDate ? r : a))
    out[car.id] = { count: rs.length, latestId: latest.id, latestDate: latest.startDate, name: carShortName(car) }
  }
  cache = out
  return out
}

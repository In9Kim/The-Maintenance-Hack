import type { Garage, MyCar } from "@/lib/my-car"
import { supabase } from "@/lib/supabase"

/** DB vehicles 한 줄. 차 사진·부품 목록은 저장하지 않고 화면에서 차종 id로 다시 만든다 */
export interface VehicleRow {
  id: string
  car_id: string
  engine: string | null
  year: number | null
  km: number
  km_date: string
  records: MyCar["records"]
}

export const toRow = (c: MyCar): VehicleRow => ({
  id: c.id!,
  car_id: c.car.id,
  engine: c.engine ?? null,
  year: c.year ?? null,
  km: c.km,
  km_date: c.kmDate,
  records: c.records ?? {},
})

/** rebuild: 차종 id·엔진 → 최신 사진·부품 목록 (없는 차종이면 null) */
export const fromRow = (r: VehicleRow, rebuild: (carId: string, engine?: string) => MyCar["car"] | null): MyCar | null => {
  const car = rebuild(r.car_id, r.engine ?? undefined)
  return car
    ? { id: r.id, car, engine: r.engine ?? undefined, year: r.year ?? undefined, km: r.km, kmDate: r.km_date, records: r.records ?? {} }
    : null
}

/** 로그인 직후: 이 기기에만 있던 차는 계정에 올리고, 계정의 차 목록으로 맞춘다 (같은 차는 계정 쪽이 우선) */
export function mergeGarage(local: Garage, remote: MyCar[]): { garage: Garage; upload: MyCar[] } {
  const ids = new Set(remote.map((c) => c.id))
  const upload = local.cars.filter((c) => !ids.has(c.id))
  const cars = [...remote, ...upload]
  const active = cars.some((c) => c.id === local.active) ? local.active : cars[0]?.id ?? ""
  return { garage: { cars, active }, upload }
}

export async function fetchCars(): Promise<VehicleRow[]> {
  const sb = await supabase()
  const { data, error } = await sb.from("vehicles").select("id,car_id,engine,year,km,km_date,records").order("created_at")
  if (error) throw error
  return (data ?? []) as VehicleRow[]
}

export async function pushCars(cars: MyCar[]) {
  if (!cars.length) return
  const sb = await supabase()
  const { error } = await sb.from("vehicles").upsert(cars.map(toRow))
  if (error) throw error
}

export async function deleteCloudCar(id: string) {
  const sb = await supabase()
  const { error } = await sb.from("vehicles").delete().eq("id", id)
  if (error) throw error
}

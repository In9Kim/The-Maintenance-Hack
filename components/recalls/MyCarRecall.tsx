"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { loadMyCar } from "@/lib/my-car"
import { isCustomCar } from "@/lib/car-catalog"
import { CarPicker, type PickerCar } from "@/components/home/CarPicker"
import { recallsForYear, type CarRecallAlert } from "@/lib/recalls/year"

/** 리콜 화면 맨 위: 등록한 차가 있으면 그 차 리콜 화면으로 바로 넘어감 (?all=1이면 전체 목록 그대로). 없으면 차종 고르기. 건수는 맨 위 빨간 띠와 같은 기준(연식) */
export function MyCarRecall({ cars, alerts }: { cars: PickerCar[]; alerts: Record<string, CarRecallAlert> }) {
  const [my, setMy] = useState<{ id: string; name: string; n: number; custom: boolean } | null | undefined>(undefined)
  const [pick, setPick] = useState(false)
  const router = useRouter()
  useEffect(() => {
    const m = loadMyCar()
    // 내 차가 있으면 다른 차 리콜은 볼 일이 적어서 내 차 리콜로 (전체 목록에서 온 경우 ?all=1)
    // 직접 적은 차('x:…')는 차종별 리콜 화면이 없어서(404) 넘기지 않음
    const custom = !!m && isCustomCar(m.car.id)
    // 리콜이 있는 차 목록에 없으면(리콜 0건·다른 세대 등) 넘기지 않고 이 화면에서 '최근 리콜 없음'
    const listed = !!m && cars.some((c) => c.id === m.car.id)
    if (m && !custom && listed && !new URLSearchParams(location.search).has("all")) return router.replace(`/cars/${m.car.id}/recalls`)
    const a = m && !custom ? alerts[m.car.id] : undefined
    setMy(m ? { id: m.car.id, name: m.car.name, n: a ? recallsForYear(a, m.year).length : 0, custom } : null)
  }, [alerts, cars, router])

  if (my === undefined) return <div className="h-[72px] animate-pulse rounded-2xl bg-muted" />
  if (my && !pick) {
    const n = my.n
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-bold">{my.name}</span>
          <span className={`block text-[13px] ${n ? "font-semibold text-[#B42318]" : "text-muted-foreground"}`}>
            {my.custom ? "이 차는 리콜 정보 준비 중이에요" : n ? `내 연식 리콜 ${n}건` : "최근 리콜 없음"}
          </span>
        </span>
        {n > 0 && !my.custom && (
          <Link href={`/cars/${my.id}/recalls`} className="flex min-h-[40px] shrink-0 items-center rounded-lg bg-foreground px-3 text-[13px] font-semibold text-background">
            리콜 보기
          </Link>
        )}
        <button type="button" onClick={() => setPick(true)} className="min-h-[40px] shrink-0 rounded-lg border border-border px-3 text-[13px] font-semibold">
          다른 차
        </button>
      </div>
    )
  }
  return <CarPicker cars={cars} path="/recalls" via="recalls_picker" cta="리콜 목록 보기" hint="차종을 고르면 리콜을 보여드려요" label="차종별 리콜" />
}

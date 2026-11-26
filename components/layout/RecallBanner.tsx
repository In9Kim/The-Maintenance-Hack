"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { loadMyCar } from "@/lib/my-car"
import type { CarRecallAlert } from "@/lib/recalls/car-alert"

const DISMISS_KEY = "mh_recall_dismissed"

/** 등록한 내 차에 리콜이 있으면 화면 맨 위 빨간 띠. 닫으면 새 리콜이 나올 때까지 숨김 */
export function RecallBanner({ alerts }: { alerts: Record<string, CarRecallAlert> }) {
  const pathname = usePathname()
  const [state, setState] = useState<{ carId: string; a: CarRecallAlert } | null>(null)

  useEffect(() => {
    const read = () => {
      const my = loadMyCar()
      const a = my ? alerts[my.car.id] : undefined
      let dismissed: string | null = null
      try {
        dismissed = localStorage.getItem(DISMISS_KEY)
      } catch {}
      setState(my && a && dismissed !== a.latestId ? { carId: my.car.id, a } : null)
    }
    read()
    window.addEventListener("mh-my-car", read)
    return () => window.removeEventListener("mh-my-car", read)
  }, [alerts])

  if (!state || pathname.startsWith("/admin") || pathname === `/cars/${state.carId}/recalls`) return null

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, state.a.latestId)
    } catch {}
    setState(null)
  }

  return (
    <div role="alert" className="bg-[#B42318] text-white">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-5">
        <Link href={`/cars/${state.carId}/recalls`} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-[14px] font-semibold">
          <span aria-hidden>⚠</span>
          <span className="truncate">내 차({state.a.name}) 리콜 {state.a.count}건 · 해당 여부 확인</span>
          <span aria-hidden className="ml-auto shrink-0">›</span>
        </Link>
        <button onClick={close} aria-label="리콜 알림 닫기" className="flex h-11 w-11 shrink-0 items-center justify-center text-[18px] text-white/80 hover:text-white">
          ×
        </button>
      </div>
    </div>
  )
}

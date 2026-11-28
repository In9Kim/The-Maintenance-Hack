"use client"

import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"
import { loadGarage } from "@/lib/my-car"

/**
 * 등록한 내 차를 다시 고르지 않게 하는 작은 조각들 (차종 목록·차종 페이지·근처 정비소).
 * 정적 페이지라 서버에서는 내 차를 모르므로, 화면에 뜬 뒤 이 폰에 저장된 차를 읽는다.
 */

interface MineInfo { id: string; name: string }

/** 등록한 차 가운데 차종 페이지가 있는 차 (지금 보는 차 먼저) */
function useMyCatalogCar(ids?: string[]): MineInfo | null {
  const [mine, setMine] = useState<MineInfo | null>(null)
  useEffect(() => {
    const read = () => {
      const g = loadGarage()
      const order = [...g.cars].sort((a, b) => Number(b.id === g.active) - Number(a.id === g.active))
      const hit = order.find((c) => !ids || ids.includes(c.car.id))
      setMine(hit ? { id: hit.car.id, name: hit.car.name } : null)
    }
    read()
    window.addEventListener("mh-my-car", read)
    return () => window.removeEventListener("mh-my-car", read)
  }, [ids])
  return mine
}

/** 차종 목록 맨 위: '내 차 · 기아 쏘렌토 MQ4 ›' (등록한 차가 없으면 숨김) */
export function MyCarShortcut({ ids }: { ids: string[] }) {
  const mine = useMyCatalogCar(ids)
  if (!mine) return null
  return (
    <Link
      href={`/cars/${mine.id}`}
      className="mt-5 flex min-h-[56px] items-center gap-3 rounded-[14px] border border-primary/40 bg-emerald-50 px-4 py-3 transition hover:brightness-95"
    >
      <span className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-bold text-primary-foreground">내 차</span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{mine.name}</span>
      <span aria-hidden className="shrink-0 text-muted-foreground">›</span>
    </Link>
  )
}

/** 차종 페이지 위 칩: 이미 등록한 차면 '내 차'(마이로), 아니면 '+ 내 차로 저장' */
export function SaveMyCarChip({ carId }: { carId: string }) {
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    const read = () => setSaved(loadGarage().cars.some((c) => c.car.id === carId))
    read()
    window.addEventListener("mh-my-car", read)
    return () => window.removeEventListener("mh-my-car", read)
  }, [carId])
  if (saved)
    return (
      <Link href="/my" className="inline-flex min-h-[36px] items-center rounded-full bg-emerald-50 px-3.5 text-[13px] font-semibold text-primary hover:brightness-95">
        ✓ 내 차
      </Link>
    )
  return (
    <Link
      href={`/my?add=${carId}`}
      className="inline-flex min-h-[36px] items-center rounded-full bg-foreground px-3.5 text-[13px] font-semibold text-background hover:brightness-110"
    >
      + 내 차로 저장
    </Link>
  )
}

/** 근처 정비소 아래 '내 차 정비 비용 보기': 등록한 차가 있으면 그 차 페이지로 바로 */
export function MyCarCostLink({ ids, className, children }: { ids: string[]; className?: string; children: ReactNode }) {
  const mine = useMyCatalogCar(ids)
  return (
    <Link href={mine ? `/cars/${mine.id}` : "/cars"} className={className}>
      {children}
    </Link>
  )
}

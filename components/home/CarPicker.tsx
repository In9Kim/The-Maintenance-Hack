"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { track } from "@/lib/track"

export interface PickerCar {
  id: string
  brand: string
  /** "쏘렌토 MQ4 (4세대) · 2020~현재" */
  label: string
}

const SELECT_CLS =
  "h-12 w-full appearance-none rounded-[10px] border border-input bg-card bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%234A5A72%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_14px_center] bg-no-repeat pl-3.5 pr-9 text-[16px] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:text-muted-foreground"

/** 브랜드 → 차종 고르고 바로 그 차 페이지로. 기본은 홈 첫 화면(정비 비용), path="/recalls"면 차종 리콜 페이지 */
export function CarPicker({
  cars,
  path = "",
  via = "home_picker",
  cta = "정비 비용 보기",
  hint = "차종을 고르면 비용을 보여드려요",
}: {
  cars: PickerCar[]
  path?: string
  via?: string
  cta?: string
  hint?: string
}) {
  const router = useRouter()
  const brands = useMemo(() => Array.from(new Set(cars.map((c) => c.brand))), [cars])
  const [brand, setBrand] = useState("")
  const [carId, setCarId] = useState("")
  const models = cars.filter((c) => c.brand === brand)

  const go = (e: React.FormEvent) => {
    e.preventDefault()
    if (!carId) return
    track({ type: "nav", carId, meta: { via } })
    router.push(`/cars/${carId}${path}`)
  }

  return (
    <form onSubmit={go} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="text-[13px] font-semibold text-muted-foreground">차종 찾기</p>
      <div className="mt-2 grid grid-cols-[0.8fr_1.2fr] gap-2">
        <label className="sr-only" htmlFor={via + "-brand"}>브랜드</label>
        <select
          id={via + "-brand"}
          className={SELECT_CLS}
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value)
            setCarId("")
          }}
        >
          <option value="">브랜드</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor={via + "-car"}>차종</label>
        <select
          id={via + "-car"}
          className={SELECT_CLS}
          value={carId}
          disabled={!brand}
          onChange={(e) => setCarId(e.target.value)}
        >
          <option value="">{brand ? "차종 선택" : "차종"}</option>
          {models.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={!carId}
        className="mt-3 h-12 w-full rounded-[10px] bg-primary text-[16px] font-bold text-primary-foreground transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:bg-[#9BB8AD]"
      >
        {carId ? cta : hint}
      </button>
    </form>
  )
}

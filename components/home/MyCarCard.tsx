"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { dueList, loadMyCar, type MyCar } from "@/lib/my-car"

/** 홈 맨 위: 등록한 내 차가 있으면 급한 소모품을, 없으면 등록 안내 한 줄 */
export function MyCarCard() {
  const [my, setMy] = useState<MyCar | null | undefined>(undefined)
  useEffect(() => {
    const read = () => setMy(loadMyCar())
    read()
    window.addEventListener("mh-my-car", read)
    return () => window.removeEventListener("mh-my-car", read)
  }, [])

  if (my === undefined) return null
  if (!my)
    return (
      <Link href="/my" className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-card px-4 py-3 transition hover:border-primary/40">
        <span>
          <b className="block text-[15px]">내 차를 등록해 두세요</b>
          <span className="text-[13px] text-muted-foreground">엔진오일·와이퍼 교체 시기를 계산해 드려요 (가입 없음)</span>
        </span>
        <span aria-hidden className="shrink-0 text-[14px] font-bold text-primary">등록</span>
      </Link>
    )

  const list = dueList(my)
  const top = list.find((d) => d.state === "over" || d.state === "soon")
  const unknown = list.every((d) => d.state === "unknown")
  return (
    <Link href="/my" className="flex items-center gap-4 overflow-hidden rounded-[14px] bg-[#14213D] p-4 text-white transition hover:brightness-110">
      {my.car.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={my.car.photo} alt="" width={96} height={60} className="h-[60px] w-[96px] shrink-0 rounded-md object-cover" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{my.car.name}</span>
        <span className="num block text-[13px] text-white/70">{my.km.toLocaleString("ko-KR")}km</span>
        <span className={`mt-1 block truncate text-[13px] font-semibold ${top ? (top.state === "over" ? "text-[#FDA29B]" : "text-[#FEC84B]") : "text-[#75E0A7]"}`}>
          {top ? `${top.part.name} ${top.text}` : unknown ? "마지막 교체 날짜를 넣어 주세요" : "당장 교체할 소모품 없음"}
        </span>
      </span>
      <span aria-hidden className="shrink-0 text-[20px] text-white/60">›</span>
    </Link>
  )
}

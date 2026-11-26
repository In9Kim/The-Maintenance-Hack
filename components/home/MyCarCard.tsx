"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { dueList, loadMyCar, type MyCar } from "@/lib/my-car"

/** 홈 맨 위: 등록한 내 차가 있으면 급한 소모품 (없으면 안 보임) */
export function MyCarCard() {
  const [my, setMy] = useState<MyCar | null | undefined>(undefined)
  useEffect(() => {
    const read = () => setMy(loadMyCar())
    read()
    window.addEventListener("mh-my-car", read)
    return () => window.removeEventListener("mh-my-car", read)
  }, [])

  if (my === undefined) return null
  if (!my) return null // 등록은 '마이'에서

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
        {my.km > 0 && <span className="num block text-[13px] text-white/70">{my.km.toLocaleString("ko-KR")}km</span>}
        <span className={`mt-1 block truncate text-[13px] font-semibold ${top ? (top.state === "over" ? "text-[#FDA29B]" : "text-[#FEC84B]") : "text-[#75E0A7]"}`}>
          {top ? `${top.part.name} ${top.text}` : unknown ? "마지막 교체 날짜를 넣어 주세요" : "당장 교체할 소모품 없음"}
        </span>
      </span>
      <span aria-hidden className="shrink-0 text-[20px] text-white/60">›</span>
    </Link>
  )
}

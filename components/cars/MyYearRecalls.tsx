"use client"

import { useEffect, useState } from "react"
import { loadGarage } from "@/lib/my-car"
import { recallsForYear, type CarRecallAlert } from "@/lib/recalls/year"

/**
 * 차 리콜 페이지 위: 이 차종을 연식과 함께 등록했으면 '내 차(2022년형) 해당 가능 3건'과 그 리콜로 가는 링크.
 * 맨 위 리콜 띠(연식 기준 건수)와 페이지 전체 건수가 달라 헷갈리지 않게. 등록 안 했거나 연식을 모르면 숨김.
 */
export function MyYearRecalls({ carId, alert }: { carId: string; alert?: CarRecallAlert }) {
  const [mine, setMine] = useState<{ year: number; ids: string[] } | null>(null)

  useEffect(() => {
    if (!alert) return
    const read = () => {
      const g = loadGarage()
      const my = g.cars.find((c) => c.id === g.active && c.car.id === carId) ?? g.cars.find((c) => c.car.id === carId && c.year)
      setMine(my?.year ? { year: my.year, ids: recallsForYear(alert, my.year).map(([id]) => id) } : null)
    }
    read()
    window.addEventListener("mh-my-car", read)
    return () => window.removeEventListener("mh-my-car", read)
  }, [carId, alert])

  if (!mine || !alert) return null
  const all = alert.r.length
  return (
    <div className="mt-4 rounded-[14px] border border-border bg-card px-4 py-3">
      <p className="text-[15px] font-bold">
        내 차({mine.year}년형) 해당 가능 <span className="num text-[#B42318]">{mine.ids.length}건</span>
        {mine.ids.length < all && <span className="ml-1 text-[13px] font-normal text-muted-foreground">/ 전체 {all}건</span>}
      </p>
      {mine.ids.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {alert.r
            .filter(([id]) => mine.ids.includes(id))
            .map(([id, date]) => (
              <li key={id}>
                <a href={`#${id}`} className="num inline-flex min-h-[36px] items-center rounded-full bg-[#FEF3F2] px-3 text-[13px] font-semibold text-[#B42318]">
                  {date.slice(0, 7).replace("-", ".")} 리콜 ›
                </a>
              </li>
            ))}
        </ul>
      ) : (
        <p className="mt-1 text-[13px] text-muted-foreground">생산 기간으로는 내 연식이 빠져 있어요. 정확한 건 차대번호로 조회하세요.</p>
      )}
    </div>
  )
}

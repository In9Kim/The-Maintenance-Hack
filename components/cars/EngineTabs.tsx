"use client"

import { Children, useEffect, useState, type ReactNode } from "react"
import { loadGarage } from "@/lib/my-car"

/**
 * 엔진별 소모품 표를 탭으로 하나씩 보여준다 (휴대폰에서 같은 표가 두세 번 이어지지 않게).
 * 모든 표는 HTML에 그대로 있어 검색엔진·자바스크립트 꺼진 환경에서도 읽힌다.
 * 주소의 #engine-… 으로 들어오면 그 엔진 탭을 연다.
 */
export function EngineTabs({ engines, ids, carId, children }: { engines: string[]; ids: string[]; /** 이 차종이 등록한 내 차면 내 엔진 탭을 먼저 연다 */ carId?: string; children: ReactNode }) {
  const panels = Children.toArray(children)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const fromHash = () => {
      const i = ids.indexOf(decodeURIComponent(location.hash.slice(1)))
      setActive(i >= 0 ? i : (a) => a ?? 0)
    }
    // 주소에 엔진(#engine-…)이 없으면 등록한 내 차의 엔진
    if (carId && !location.hash) {
      const g = loadGarage()
      const mine = g.cars.find((c) => c.id === g.active && c.car.id === carId) ?? g.cars.find((c) => c.car.id === carId)
      const i = mine?.engine ? engines.indexOf(mine.engine) : -1
      if (i >= 0) setActive(i)
    }
    fromHash()
    window.addEventListener("hashchange", fromHash)
    return () => window.removeEventListener("hashchange", fromHash)
  }, [ids, carId, engines])

  return (
    <div>
      <div role="tablist" aria-label="엔진 선택" className="flex gap-1 overflow-x-auto rounded-[12px] bg-muted p-1">
        {engines.map((e, i) => {
          const on = (active ?? 0) === i
          return (
            <button
              key={e}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={ids[i]}
              onClick={() => {
                setActive(i)
                history.replaceState(null, "", `#${ids[i]}`)
              }}
              className={`min-h-[44px] shrink-0 grow rounded-[9px] px-3 text-[14px] font-semibold transition ${
                on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {e}
            </button>
          )
        })}
      </div>
      {panels.map((p, i) => (
        <div key={ids[i]} role="tabpanel" id={ids[i]} className="scroll-mt-20" hidden={active !== null && active !== i}>
          {p}
        </div>
      ))}
    </div>
  )
}

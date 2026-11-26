"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { dueList, loadGarage, saveGarage, type DueState, type Garage } from "@/lib/my-car"
import { OutboundLink } from "@/components/seo/OutboundLink"
import { AFFILIATE_TEXT } from "@/lib/affiliate"

const BADGE: Record<DueState, { label: string; cls: string }> = {
  over: { label: "교체 시기 지남", cls: "bg-[#FEF3F2] text-[#B42318]" },
  soon: { label: "곧 교체", cls: "bg-[#FFF6ED] text-[#B54708]" },
  ok: { label: "여유", cls: "bg-[#ECFDF3] text-[#067647]" },
  unknown: { label: "기록 필요", cls: "bg-muted text-muted-foreground" },
}

/**
 * 첫 화면 '내 차' (등록한 사람만). 등록 여부는 layout의 작은 스크립트가 <html data-car>로 먼저 표시해서
 * 예시 화면이 잠깐 보였다 바뀌는 일이 없게 한다 (globals.css .home-guest / .home-mine).
 */
export function HomeMyCar() {
  const [g, setG] = useState<Garage | null>(null)

  useEffect(() => {
    const read = () => {
      const v = loadGarage()
      setG(v)
      if (v.cars.length) document.documentElement.dataset.car = "1"
      else delete document.documentElement.dataset.car
    }
    read()
    window.addEventListener("mh-my-car", read)
    return () => window.removeEventListener("mh-my-car", read)
  }, [])

  if (!g) return <div className="h-[420px] animate-pulse rounded-2xl bg-muted" />
  const my = g.cars.find((c) => c.id === g.active)
  if (!my) return null

  const list = dueList(my)
  const urgent = list.filter((d) => d.state === "over" || d.state === "soon").length
  const anyShop = list.some((d) => d.part.shop)

  return (
    <div>
      {g.cars.length > 1 && (
        <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1" role="tablist" aria-label="내 차 바꾸기">
          {g.cars.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={c.id === g.active}
              onClick={() => saveGarage({ ...g, active: c.id! })}
              className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold ${c.id === g.active ? "bg-foreground text-background" : "border border-border bg-card"}`}
            >
              {c.car.name}
            </button>
          ))}
        </div>
      )}

      <Link href="/my" className="flex items-center gap-4 overflow-hidden rounded-2xl bg-[#14213D] p-5 text-white">
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-white/60">내 차</span>
          <span className="mt-0.5 block text-[22px] font-extrabold leading-tight">{my.car.name}</span>
          <span className="mt-1 block text-[13px] text-white/70">
            {[my.year && `${my.year}년형`, my.engine, my.km > 0 && `${my.km.toLocaleString("ko-KR")}km`].filter(Boolean).join(" · ")}
          </span>
        </span>
        {my.car.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={my.car.photo} alt="" width={160} height={100} className="h-[76px] w-[120px] shrink-0 rounded-lg object-cover" />
        )}
      </Link>

      <p className="mt-5 text-[16px] font-bold">
        {urgent > 0 ? `지금 챙길 소모품 ${urgent}개` : list.every((d) => d.state === "unknown") ? "내 차 소모품 가격" : "당장 교체할 소모품은 없어요"}
      </p>
      <ul className="mt-2 divide-y divide-border rounded-[14px] border border-border bg-card">
        {list.map((d) => {
          const b = BADGE[d.state]
          return (
            <li key={d.part.slug} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <Link href={`/cars/${my.car.id}/${d.part.slug}`} className="block truncate text-[15px] font-semibold">
                  {d.part.name}
                </Link>
                {d.part.shop ? (
                  <OutboundLink href={d.part.shop.url} target="coupang" carId={my.car.id} partId={d.part.slug} sponsored className="num inline-flex min-h-[28px] items-center gap-1 text-[14px] font-bold text-primary">
                    쿠팡 {d.part.shop.price.toLocaleString("ko-KR")}원
                    <span className="text-[11px] font-normal text-muted-foreground">{d.part.shop.date.slice(5).replace("-", "/")} ›</span>
                  </OutboundLink>
                ) : d.part.price ? (
                  <span className="num block text-[13px] text-muted-foreground">부품 예상 {d.part.price.toLocaleString("ko-KR")}원</span>
                ) : null}
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${b.cls}`}>{d.state === "unknown" ? b.label : d.text}</span>
            </li>
          )
        })}
      </ul>
      {anyShop && <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">쿠팡 가격은 표시한 날 기준이라 바뀔 수 있어요. {AFFILIATE_TEXT}</p>}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href="/my" className="flex min-h-[48px] items-center justify-center rounded-[12px] border border-border bg-card text-[14px] font-semibold">
          교체 기록 관리
        </Link>
        <Link href="/near" className="flex min-h-[48px] items-center justify-center rounded-[12px] bg-foreground text-[14px] font-semibold text-background">
          근처 공임나라
        </Link>
      </div>
      <Link href="/cars" className="mt-3 inline-flex min-h-[44px] items-center text-[13px] text-muted-foreground underline underline-offset-4">
        다른 차종 둘러보기
      </Link>
    </div>
  )
}

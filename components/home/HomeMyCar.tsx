"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { loadGarage, loadSkipped, nextAction, quickRecord, saveGarage, saveSkipped, today, type Garage, type MyCar, type PartDue } from "@/lib/my-car"
import { pushIfSignedIn } from "@/lib/cloud-garage"
import { isCustomCar } from "@/lib/car-catalog"
import { OutboundLink } from "@/components/seo/OutboundLink"
import { AFFILIATE_TEXT } from "@/lib/affiliate"
import { track } from "@/lib/track"
import { PartIcon, partLook } from "@/components/PartIcon"

/**
 * 첫 화면 '내 차' (등록한 사람만) = 오늘 할 일 하나.
 * 교체 시기가 급한 부품이 있으면 그 부품을 바로 살 수 있게, 기록이 없으면 "언제 갈았어요?"를 버튼으로 하나씩 묻는다.
 * 차 관리(전체 목록·주행거리·기록)는 마이에서. 등록 여부는 layout의 작은 스크립트가 <html data-car>로 먼저 표시한다.
 */
export function HomeMyCar() {
  const [g, setG] = useState<Garage | null>(null)
  const [skipped, setSkipped] = useState<string[]>([])

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

  const my = g?.cars.find((c) => c.id === g.active)
  useEffect(() => {
    if (my?.id) setSkipped(loadSkipped(my.id))
  }, [my?.id])

  if (!g) return <div className="h-[300px] animate-pulse rounded-2xl bg-muted" />
  if (!my) return null

  const save = (car: MyCar) => {
    const next = { ...g, cars: g.cars.map((c) => (c.id === car.id ? car : c)) }
    saveGarage(next)
    pushIfSignedIn(car)
  }
  const skip = (slug: string) => {
    const s = [...skipped, slug]
    setSkipped(s)
    saveSkipped(my.id!, s)
  }

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

      {/* 차 이름은 한 줄로만 (큰 카드는 마이에서) */}
      <Link href="/my" className="flex items-center gap-3">
        {my.car.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={my.car.photo} alt="" width={160} height={100} className="h-10 w-16 shrink-0 rounded-md object-cover" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-extrabold">{my.car.name}</span>
          <span className="num block text-[12px] text-muted-foreground">
            {[my.year && `${my.year}년형`, my.km > 0 ? `${my.km.toLocaleString("ko-KR")}km` : "주행거리 미입력"].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="shrink-0 text-[13px] font-semibold text-muted-foreground">관리 ›</span>
      </Link>

      <NextCard my={my} skipped={skipped} onSave={save} onSkip={skip} />
    </div>
  )
}

const ASK = [
  { label: "3개월 안", months: 2 },
  { label: "6개월쯤 전", months: 6 },
  { label: "1년쯤 전", months: 12 },
  { label: "1년 넘음", months: 20 },
] as const

function NextCard({ my, skipped, onSave, onSkip }: { my: MyCar; skipped: string[]; onSave: (c: MyCar) => void; onSkip: (slug: string) => void }) {
  const a = nextAction(my, skipped)

  if (a.type === "none") {
    return (
      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-[16px] font-bold">{my.car.name} 부품 정보는 준비 중이에요</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          등록해 주신 차부터 부품 규격과 가격을 채우고 있어요. 그동안 견적서 분석과 근처 공임나라 찾기는 그대로 쓸 수 있어요.
        </p>
      </div>
    )
  }

  if (a.type === "ask") {
    const d = a.due
    return (
      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-[13px] text-muted-foreground">교체 시기 계산 · {a.left}개 남음</p>
        <div className="mt-2 flex items-start gap-3">
          <PartIcon name={d.part.name} size={44} />
          <div className="min-w-0">
            <p className="text-[18px] font-extrabold leading-snug">{d.part.name}, 마지막으로 언제 갈았어요?</p>
            {partLook(d.part.name).desc && <p className="mt-0.5 text-[13px] text-muted-foreground">{partLook(d.part.name).desc}</p>}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {ASK.map((o) => (
            <button
              key={o.label}
              onClick={() => {
                track({ type: "nav", carId: my.car.id, partId: d.part.slug, meta: { via: "home_ask", months: o.months } })
                onSave({ ...my, records: { ...my.records, [d.part.slug]: quickRecord(my, o.months) } })
              }}
              className="min-h-[48px] rounded-[12px] border border-border bg-background text-[15px] font-semibold active:bg-muted"
            >
              {o.label}
            </button>
          ))}
        </div>
        <button onClick={() => onSkip(d.part.slug)} className="mt-2 min-h-[44px] w-full text-[14px] font-semibold text-muted-foreground">
          모르겠어요 · 다음 부품
        </button>
      </div>
    )
  }

  // 지금 갈 부품이 없으면 카드를 안 보여 줌 (다음 교체 일정은 마이에서)
  if (a.type === "ok") return null

  // buy: 가장 급한 부품을 바로 살 수 있게
  return <BuyCard my={my} due={a.due} more={a.urgent.length - 1} onSave={onSave} />
}

function BuyCard({ my, due, more, onSave }: { my: MyCar; due: PartDue; more: number; onSave: (c: MyCar) => void }) {
  const p = due.part
  const custom = isCustomCar(my.car.id)
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#FEC84B] bg-card">
      <div className="bg-[#FFFAEB] px-4 py-3">
        <p className="text-[13px] font-semibold text-[#B54708]">{due.state === "over" ? "교체 시기가 지났어요" : "곧 갈 때예요"} · {due.text}</p>
        <div className="mt-1.5 flex items-center gap-3">
          <PartIcon name={p.name} />
          <div className="min-w-0">
            <p className="text-[19px] font-extrabold leading-snug">{p.name}</p>
            {partLook(p.name).desc && <p className="text-[13px] text-muted-foreground">{partLook(p.name).desc}</p>}
          </div>
        </div>
      </div>
      <div className="p-4">
        {p.shop ? (
          <OutboundLink
            href={p.shop.url}
            target="coupang"
            carId={my.car.id}
            partId={p.slug}
            sponsored
            className="num flex h-12 items-center justify-center rounded-[12px] bg-primary text-[16px] font-bold text-primary-foreground"
          >
            쿠팡에서 {p.shop.price.toLocaleString("ko-KR")}원에 사기
          </OutboundLink>
        ) : !custom ? (
          <Link href={`/cars/${my.car.id}/${p.slug}`} className="flex h-12 items-center justify-center rounded-[12px] bg-primary text-[16px] font-bold text-primary-foreground">
            맞는 부품·가격 보기
          </Link>
        ) : null}
        {p.self ? <p className="num mt-2 text-center text-[13px] text-muted-foreground">부품 사 가서 공임나라에 맡기면 약 {p.self.toLocaleString("ko-KR")}원 (추정)</p> : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => onSave({ ...my, records: { ...my.records, [p.slug]: { date: today(), km: my.km > 0 ? my.km : undefined } } })}
            className="min-h-[44px] rounded-[10px] border border-border text-[14px] font-semibold"
          >
            이미 갈았어요
          </button>
          <Link href="/near" className="flex min-h-[44px] items-center justify-center rounded-[10px] bg-foreground text-[14px] font-semibold text-background">
            근처 공임나라
          </Link>
        </div>
        {more > 0 && <Link href="/my" className="mt-3 inline-flex min-h-[40px] items-center text-[13px] font-semibold text-[#B54708]">갈 때 된 부품 {more}개 더 ›</Link>}
        {p.shop && <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{AFFILIATE_TEXT}</p>}
      </div>
    </div>
  )
}

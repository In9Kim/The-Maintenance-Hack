"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { dueList, loadGarage, loadSkipped, quickRecord, saveGarage, saveSkipped, today, type Garage, type MyCar, type PartDue } from "@/lib/my-car"
import { pushIfSignedIn } from "@/lib/cloud-garage"
import { isCustomCar } from "@/lib/car-catalog"
import { OutboundLink } from "@/components/seo/OutboundLink"
import { AFFILIATE_TEXT } from "@/lib/affiliate"
import { track } from "@/lib/track"
import { PartIcon, partLook } from "@/components/PartIcon"

/**
 * 첫 화면 '내 차' (등록한 사람만) = 한눈에 보는 칸 4개 + 할 일 목록.
 * 할 일: 교체 시기가 된 부품(누르면 바로 사기) → 기록 없는 부품(누르면 "언제 갈았어요?" 버튼).
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
            {[my.year && `${my.year}년형`, my.engine].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="shrink-0 text-[13px] font-semibold text-muted-foreground">관리 ›</span>
      </Link>

      <Tiles my={my} onSave={save} />
      <Todo my={my} skipped={skipped} onSave={save} onSkip={skip} />
    </div>
  )
}

const ASK = [
  { label: "3개월 안", months: 2 },
  { label: "6개월쯤 전", months: 6 },
  { label: "1년쯤 전", months: 12 },
  { label: "1년 넘음", months: 20 },
] as const

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`
const daysAgo = (d: string) => Math.floor((Date.parse(today()) - Date.parse(d)) / 86_400_000)
const partPrice = (p: PartDue["part"]) => p.shop?.price ?? p.price ?? 0

/** 한눈에 보는 칸 4개: 주행거리(바로 고침) · 교체 기록 · 갈 때 된 부품/다음 교체 · 지금 갈 부품값 */
function Tiles({ my, onSave }: { my: MyCar; onSave: (c: MyCar) => void }) {
  const [edit, setEdit] = useState(false)
  const [km, setKm] = useState("")
  const list = dueList(my)
  if (!list.length) return null
  const recorded = list.filter((d) => d.record).length
  const urgent = list.filter((d) => d.state === "over" || d.state === "soon")
  const next = list.find((d) => d.state === "ok")
  const old = my.km <= 0 || daysAgo(my.kmDate) > 30
  const num = (v: string) => Number(v.replace(/\D/g, "")) || 0
  const saveKm = () => {
    if (num(km) > 0) onSave({ ...my, km: num(km), kmDate: today() })
    setEdit(false)
  }
  const tile = "block min-h-[96px] rounded-2xl border border-border bg-card p-3.5 text-left"
  const label = "block text-[13px] text-muted-foreground"
  const big = "num mt-1 block text-[20px] font-extrabold leading-tight"
  return (
    <div className="mt-4 grid grid-cols-2 gap-2.5">
      {edit ? (
        <div className={tile}>
          <span className={label}>지금 주행거리</span>
          <div className="mt-1.5 flex gap-1.5">
            <input
              autoFocus
              inputMode="numeric"
              aria-label="지금 주행거리 km"
              className="num h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-right text-[16px]"
              value={km ? num(km).toLocaleString("ko-KR") : ""}
              placeholder="km"
              onChange={(e) => setKm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveKm()}
            />
            <button onClick={saveKm} className="h-10 shrink-0 rounded-lg bg-primary px-2.5 text-[14px] font-bold text-primary-foreground">
              저장
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setKm(my.km > 0 ? String(my.km) : "")
            setEdit(true)
          }}
          className={tile}
        >
          <span className={label}>주행거리</span>
          <span className={big}>{my.km > 0 ? `${my.km.toLocaleString("ko-KR")}km` : "입력하기"}</span>
          <span className={`mt-0.5 block text-[12px] ${old ? "font-semibold text-[#B42318]" : "text-muted-foreground"}`}>
            {old ? "눌러서 지금 거리로 고치기" : `${my.kmDate.slice(5).replace("-", "/")} 기준`}
          </span>
        </button>
      )}
      <Link href="/my" className={tile}>
        <span className={label}>교체 기록</span>
        <span className={big}>
          {recorded}
          <span className="text-[15px] font-semibold text-muted-foreground"> / {list.length}개</span>
        </span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round((recorded / list.length) * 100)}%` }} />
        </span>
      </Link>
      <Link href="/my" className={tile}>
        <span className={label}>{urgent.length ? "갈 때 된 부품" : "다음 교체"}</span>
        {urgent.length ? (
          <>
            <span className={`${big} text-[#B54708]`}>{urgent.length}개</span>
            <span className="num mt-0.5 block truncate text-[12px] text-muted-foreground">
              {urgent[0].part.name} {urgent[0].text}
            </span>
          </>
        ) : next ? (
          <>
            <span className="mt-1 block truncate text-[16px] font-bold">{next.part.name}</span>
            <span className="num mt-0.5 block text-[12px] text-muted-foreground">{next.text}</span>
          </>
        ) : (
          <span className="mt-1 block text-[15px] font-bold text-muted-foreground">기록을 남기면 계산돼요</span>
        )}
      </Link>
      {urgent.length ? (
        <Link href="/my" className={tile}>
          <span className={label}>지금 갈 부품값</span>
          <span className={big}>약 {won(urgent.reduce((s, d) => s + partPrice(d.part), 0))}</span>
          <span className="mt-0.5 block text-[12px] text-muted-foreground">쿠팡 기준 · 공임 별도</span>
        </Link>
      ) : (
        <Link href="/near" className={tile}>
          <span className={label}>근처 공임나라</span>
          <span className="mt-1 block text-[16px] font-bold">지도에서 찾기</span>
          <span className="mt-0.5 block text-[12px] text-muted-foreground">부품 사 가서 맡기는 곳</span>
        </Link>
      )}
    </div>
  )
}

const CHIP: Record<string, { text: string; cls: string }> = {
  over: { text: "지남", cls: "bg-[#FEF3F2] text-[#B42318]" },
  soon: { text: "곧", cls: "bg-[#FFFAEB] text-[#B54708]" },
  unknown: { text: "기록 필요", cls: "bg-muted text-muted-foreground" },
}

/** 할 일 목록: 갈 때 된 부품 → 기록 없는 부품. 한 줄씩, 누르면 그 자리에서 처리 */
function Todo({ my, skipped, onSave, onSkip }: { my: MyCar; skipped: string[]; onSave: (c: MyCar) => void; onSkip: (slug: string) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const list = dueList(my)
  if (!list.length) {
    return (
      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-[16px] font-bold">{my.car.name} 부품 정보는 준비 중이에요</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">그동안 견적서 분석과 근처 공임나라 찾기는 그대로 쓸 수 있어요.</p>
      </div>
    )
  }
  const urgent = list.filter((d) => d.state === "over" || d.state === "soon")
  const ask = list.filter((d) => d.state === "unknown" && !d.record && !skipped.includes(d.part.slug))
  const todo = [...urgent, ...ask]
  const shown = todo.slice(0, 4)
  return (
    <div className="mt-4 rounded-2xl border border-border bg-card px-4 pb-2 pt-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[17px] font-extrabold">
          {todo.length ? (
            <>
              할 일 <span className="text-primary">{todo.length}개</span>
            </>
          ) : (
            "지금 할 일은 없어요"
          )}
        </p>
        <Link href="/my" className="text-[13px] font-semibold text-muted-foreground">
          전체 ›
        </Link>
      </div>
      {!todo.length && <p className="pb-2 pt-1 text-[13px] text-muted-foreground">교체 시기가 되면 여기에 먼저 보여 드려요.</p>}
      <ul className="mt-1">
        {shown.map((d) => {
          const on = open === d.part.slug
          const chip = CHIP[d.state] ?? CHIP.unknown
          return (
            <li key={d.part.slug} className="border-b border-border last:border-0">
              <button onClick={() => setOpen(on ? null : d.part.slug)} aria-expanded={on} className="flex min-h-[60px] w-full items-center gap-3 py-2 text-left">
                <PartIcon name={d.part.name} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{d.part.name}</span>
                  <span className="num block truncate text-[12px] text-muted-foreground">{d.record ? d.text : "마지막으로 언제 갈았나요?"}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold ${chip.cls}`}>{chip.text}</span>
              </button>
              {on && (d.record ? <BuyPanel my={my} due={d} onSave={onSave} /> : <AskPanel my={my} due={d} onSave={onSave} onSkip={onSkip} />)}
            </li>
          )
        })}
      </ul>
      {todo.length > shown.length && (
        <Link href="/my" className="flex min-h-[44px] items-center justify-center text-[13px] font-semibold text-muted-foreground">
          {todo.length - shown.length}개 더 보기 ›
        </Link>
      )}
    </div>
  )
}

function AskPanel({ my, due, onSave, onSkip }: { my: MyCar; due: PartDue; onSave: (c: MyCar) => void; onSkip: (slug: string) => void }) {
  return (
    <div className="pb-3">
      <div className="grid grid-cols-2 gap-2">
        {ASK.map((o) => (
          <button
            key={o.label}
            onClick={() => {
              track({ type: "nav", carId: my.car.id, partId: due.part.slug, meta: { via: "home_ask", months: o.months } })
              onSave({ ...my, records: { ...my.records, [due.part.slug]: quickRecord(my, o.months) } })
            }}
            className="min-h-[44px] rounded-[10px] border border-border bg-background text-[14px] font-semibold active:bg-muted"
          >
            {o.label}
          </button>
        ))}
      </div>
      <button onClick={() => onSkip(due.part.slug)} className="mt-1 min-h-[40px] w-full text-[13px] font-semibold text-muted-foreground">
        모르겠어요
      </button>
    </div>
  )
}

function BuyPanel({ my, due, onSave }: { my: MyCar; due: PartDue; onSave: (c: MyCar) => void }) {
  const p = due.part
  const custom = isCustomCar(my.car.id)
  return (
    <div className="pb-3">
      {p.shop ? (
        <OutboundLink
          href={p.shop.url}
          target="coupang"
          carId={my.car.id}
          partId={p.slug}
          sponsored
          className="num flex h-11 items-center justify-center rounded-[10px] bg-primary text-[15px] font-bold text-primary-foreground"
        >
          쿠팡에서 {won(p.shop.price)}에 사기
        </OutboundLink>
      ) : !custom ? (
        <Link href={`/cars/${my.car.id}/${p.slug}`} className="flex h-11 items-center justify-center rounded-[10px] bg-primary text-[15px] font-bold text-primary-foreground">
          맞는 부품·가격 보기
        </Link>
      ) : null}
      {p.self ? <p className="num mt-1.5 text-center text-[12px] text-muted-foreground">부품 사 가서 공임나라에 맡기면 약 {won(p.self)} (추정)</p> : null}
      <div className="mt-2 grid grid-cols-2 gap-2">
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
      {p.shop && <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{AFFILIATE_TEXT}</p>}
    </div>
  )
}

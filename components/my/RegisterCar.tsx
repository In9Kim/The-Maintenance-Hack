"use client"

import { useMemo, useState } from "react"
import { newCarId, today, type MyCar, type MyCarSnapshot } from "@/lib/my-car"
import { CAR_CATALOG, customCarId, normName, sameModel } from "@/lib/car-catalog"
import { track } from "@/lib/track"

export interface MyCarOption {
  id: string
  brand: string
  model: string
  label: string
  name: string
  photo?: string
  credit?: string
  engines: string[]
  years: number[]
  parts: { slug: string; name: string; engine?: string; intervalKm?: number; intervalMonths?: number; spec?: string; self?: number; price?: number; shop?: { price: number; date: string; url: string } }[]
}

export const FIELD =
  "h-12 w-full rounded-[10px] border border-input bg-card px-3.5 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted"

export const num = (s: string) => {
  const n = Number(s.replace(/[^0-9]/g, ""))
  return Number.isFinite(n) ? n : 0
}

export function snapshot(o: MyCarOption, engine?: string): MyCarSnapshot {
  return {
    id: o.id,
    name: o.name,
    photo: o.photo,
    credit: o.credit,
    parts: o.parts
      .filter((p) => !p.engine || !engine || p.engine === engine)
      .map(({ slug, name, intervalKm, intervalMonths, spec, self, price, shop }) => ({ slug, name, intervalKm, intervalMonths, spec, self, price, shop })),
  }
}

/** 부품 정보가 없는 차: 이름만 (id = "x:브랜드 모델") */
export const customSnapshot = (id: string): MyCarSnapshot => ({ id, name: id.slice(2), parts: [] })

const NOW_YEAR = Number(today().slice(0, 4))
const ANY_YEARS = Array.from({ length: NOW_YEAR + 1 - 2000 }, (_, i) => NOW_YEAR + 1 - i)

type Pick = { brand: string; model: string }

/**
 * 내 차 추가: 검색창 + 브랜드 → 모델 (중고차 앱처럼). 정비핵에 정보가 있는 차는 세대를 고르고,
 * 없는 차도 등록할 수 있다 (부품 정보는 준비 중으로 표시).
 */
export function RegisterCar({
  options,
  initialCarId,
  first,
  onSave,
  onCancel,
}: {
  options: MyCarOption[]
  initialCarId: string
  first: boolean
  onSave: (v: MyCar) => void
  onCancel?: () => void
}) {
  const pre = options.find((o) => o.id === initialCarId)
  const [q, setQ] = useState("")
  const [brand, setBrand] = useState("")
  const [pick, setPick] = useState<Pick | null>(pre ? { brand: pre.brand, model: pre.model } : null)
  const [free, setFree] = useState(false)

  const gensOf = (p: Pick) => options.filter((o) => o.brand === p.brand && sameModel(o.model, p.model))
  const hasInfo = (b: string, m: string) => options.some((o) => o.brand === b && sameModel(o.model, m))

  const results = useMemo(() => {
    const n = normName(q)
    if (!n) return []
    const out: Pick[] = []
    for (const b of CAR_CATALOG) {
      const brandHit = [b.brand, ...(b.alias ?? [])].some((x) => normName(x).includes(n))
      for (const m of b.models) if (brandHit || normName(m).includes(n)) out.push({ brand: b.brand, model: m })
    }
    return out.slice(0, 40)
  }, [q])

  const heading = (
    <>
      <h1 className="text-[28px] font-extrabold leading-[1.3] sm:text-[34px]">{first ? "내 차 등록" : "내 차 추가"}</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">차종을 고르면 맞는 부품과 교체 시기를 알려 드려요</p>
    </>
  )

  if (free) return <FreeForm first={first} onSave={onSave} onBack={() => setFree(false)} />
  if (pick) return <Detail first={first} pick={pick} gens={gensOf(pick)} preId={pre?.id} onSave={onSave} onBack={() => setPick(null)} />

  const Row = ({ p, showBrand }: { p: Pick; showBrand?: boolean }) => (
    <li>
      <button onClick={() => setPick(p)} className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 text-left">
        <span className="text-[16px] font-semibold">{showBrand && <span className="text-muted-foreground">{p.brand} </span>}{p.model}</span>
        {hasInfo(p.brand, p.model) && <span className="shrink-0 rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[12px] font-semibold text-[#067647]">부품 정보 있음</span>}
      </button>
    </li>
  )

  return (
    <>
      {heading}
      <div className="sticky top-14 z-10 -mx-5 mt-5 bg-background px-5 py-2">
        <label className="relative block">
          <span className="sr-only">모델명이나 브랜드로 찾기</span>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="모델명 또는 브랜드 (예: 쏘렌토, 트랙스)"
            className="h-12 w-full rounded-full border border-input bg-card pl-11 pr-4 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </div>

      {q ? (
        results.length ? (
          <ul className="mt-2 divide-y divide-border rounded-[14px] border border-border bg-card">
            {results.map((p) => <Row key={p.brand + p.model} p={p} showBrand />)}
          </ul>
        ) : (
          <p className="mt-4 text-[14px] text-muted-foreground">찾는 차가 없어요.</p>
        )
      ) : brand ? (
        <>
          <button onClick={() => setBrand("")} className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-[14px] font-semibold text-muted-foreground">‹ 브랜드</button>
          <p className="text-[20px] font-extrabold">{brand}</p>
          <ul className="mt-3 divide-y divide-border rounded-[14px] border border-border bg-card">
            {CAR_CATALOG.find((b) => b.brand === brand)!.models.map((m) => <Row key={m} p={{ brand, model: m }} />)}
          </ul>
        </>
      ) : (
        [false, true].map((imported) => (
          <section key={String(imported)} className="mt-4">
            <p className="text-[13px] font-semibold text-muted-foreground">{imported ? "수입" : "국산"}</p>
            <ul className="mt-2 divide-y divide-border rounded-[14px] border border-border bg-card">
              {CAR_CATALOG.filter((b) => !!b.imported === imported).map((b) => {
                const info = b.models.filter((m) => hasInfo(b.brand, m)).length
                return (
                  <li key={b.brand}>
                    <button onClick={() => setBrand(b.brand)} className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 text-left">
                      <span className="text-[16px] font-semibold">{b.brand}</span>
                      <span className="text-[13px] text-muted-foreground">{info > 0 ? `부품 정보 ${info}종 · ` : ""}{b.models.length}종 ›</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}

      <button onClick={() => setFree(true)} className="mt-4 min-h-[48px] w-full rounded-[12px] border border-dashed border-border text-[14px] font-semibold text-muted-foreground">
        목록에 내 차가 없어요 · 직접 적기
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="mt-2 h-11 w-full text-[14px] font-semibold text-muted-foreground">취소</button>
      )}
    </>
  )
}

/** 모델을 고른 뒤: 세대(정보 있는 차) · 연식 · 엔진 · 주행거리 */
function Detail({ first, pick, gens, preId, onSave, onBack }: { first: boolean; pick: Pick; gens: MyCarOption[]; preId?: string; onSave: (v: MyCar) => void; onBack: () => void }) {
  // 세대: 정보 있는 세대 id, 또는 "custom"(다른 세대 · 정보 준비 중)
  const [gen, setGen] = useState(preId ?? (gens.length === 1 ? gens[0].id : gens.length ? "" : "custom"))
  const [engine, setEngine] = useState("")
  const [year, setYear] = useState("")
  const [km, setKm] = useState("")
  const car = gens.find((o) => o.id === gen)
  const needEngine = !!car && car.engines.length > 1
  const ok = gen === "custom" || (!!car && (!needEngine || !!engine) && (!car.years.length || !!year))
  const years = car ? car.years : ANY_YEARS

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ok) return
    const snap = car ? snapshot(car, engine || undefined) : customSnapshot(customCarId(pick.brand, pick.model))
    track({ type: "nav", carId: snap.id, meta: { via: car ? "my_register" : "my_register_custom" } })
    onSave({ id: newCarId(), car: snap, engine: engine || undefined, year: year ? Number(year) : undefined, km: num(km), kmDate: today(), records: {} })
  }

  return (
    <>
      <button onClick={onBack} className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-semibold text-muted-foreground">‹ 차종 다시 고르기</button>
      <h1 className="text-[26px] font-extrabold leading-[1.3]">{pick.brand} {pick.model}</h1>
      <form onSubmit={submit} className="mt-4 space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
        {gens.length > 0 && (
          <fieldset>
            <legend className="text-[14px] font-semibold">어떤 세대예요?</legend>
            <div className="mt-2 space-y-2">
              {[...gens.map((o) => ({ id: o.id, label: o.label })), { id: "custom", label: "다른 세대 (부품 정보 준비 중)" }].map((o) => (
                <label key={o.id} className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[10px] border px-3.5 ${gen === o.id ? "border-primary bg-primary/5" : "border-input"}`}>
                  <input type="radio" name="gen" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={gen === o.id} onChange={() => { setGen(o.id); setEngine(""); setYear("") }} />
                  <span className="text-[15px]">{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {gen === "custom" && (
          <p className="rounded-[10px] bg-muted px-3.5 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
            이 차는 아직 부품 규격·가격 정보가 없어요. 등록해 두시면 견적서 분석·근처 공임나라·리콜 알림은 바로 쓸 수 있고, 등록이 많은 차부터 정보를 채워요.
          </p>
        )}
        {gen && (
          <select aria-label="연식" className={FIELD} value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">연식{gen === "custom" ? " (선택)" : ""}</option>
            {years.map((y) => <option key={y} value={y}>{y}년형</option>)}
          </select>
        )}
        {needEngine && (
          <select aria-label="엔진" className={FIELD} value={engine} onChange={(e) => setEngine(e.target.value)}>
            <option value="">엔진 선택 (오일 규격이 달라요)</option>
            {car!.engines.map((x) => <option key={x}>{x}</option>)}
          </select>
        )}
        {gen && (
          <label className="block">
            <span className="text-[14px] font-semibold">지금 주행거리 <span className="font-normal text-muted-foreground">(선택, 교체 시기 계산에 써요)</span></span>
            <span className="relative mt-1.5 block">
              <input inputMode="numeric" className={FIELD + " pr-12"} placeholder="예: 63,000" value={km ? num(km).toLocaleString("ko-KR") : ""} onChange={(e) => setKm(e.target.value)} />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted-foreground">km</span>
            </span>
          </label>
        )}
        <button type="submit" disabled={!ok} className="h-12 w-full rounded-[10px] bg-primary text-[16px] font-bold text-primary-foreground transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:bg-[#9BB8AD]">
          {first ? "내 차 등록하기" : "이 차 추가하기"}
        </button>
      </form>
    </>
  )
}

/** 목록에 없는 차: 브랜드·모델을 직접 */
function FreeForm({ first, onSave, onBack }: { first: boolean; onSave: (v: MyCar) => void; onBack: () => void }) {
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [year, setYear] = useState("")
  const [km, setKm] = useState("")
  const ok = brand.trim().length > 0 && model.trim().length > 0
  return (
    <>
      <button onClick={onBack} className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-semibold text-muted-foreground">‹ 목록으로</button>
      <h1 className="text-[26px] font-extrabold leading-[1.3]">내 차 직접 적기</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!ok) return
          const id = customCarId(brand.trim().slice(0, 20), model.trim().slice(0, 40))
          track({ type: "nav", carId: id, meta: { via: "my_register_free" } })
          onSave({ id: newCarId(), car: customSnapshot(id), year: year ? Number(year) : undefined, km: num(km), kmDate: today(), records: {} })
        }}
        className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-6"
      >
        <input className={FIELD} placeholder="브랜드 (예: 쉐보레)" value={brand} maxLength={20} onChange={(e) => setBrand(e.target.value)} />
        <input className={FIELD} placeholder="모델 (예: 올란도)" value={model} maxLength={40} onChange={(e) => setModel(e.target.value)} />
        <select aria-label="연식" className={FIELD} value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">연식 (선택)</option>
          {ANY_YEARS.map((y) => <option key={y} value={y}>{y}년형</option>)}
        </select>
        <span className="relative block">
          <input inputMode="numeric" className={FIELD + " pr-12"} placeholder="지금 주행거리 (선택)" value={km ? num(km).toLocaleString("ko-KR") : ""} onChange={(e) => setKm(e.target.value)} />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted-foreground">km</span>
        </span>
        <button type="submit" disabled={!ok} className="h-12 w-full rounded-[10px] bg-primary text-[16px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:bg-[#9BB8AD]">
          {first ? "내 차 등록하기" : "이 차 추가하기"}
        </button>
      </form>
    </>
  )
}

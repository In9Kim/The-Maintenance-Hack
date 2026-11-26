"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { loadMyCar } from "@/lib/my-car"
import { parseProductInput } from "@/lib/compat-request"
import { OutboundLink } from "@/components/seo/OutboundLink"
import { AFFILIATE_TEXT } from "@/lib/affiliate"
import { track } from "@/lib/track"

export interface CheckCar {
  id: string
  brand: string
  label: string
  name: string
  years: number[]
  engines: string[]
  /** 이 차에 맞게 고른 쿠팡 상품 (가격은 date 기준) */
  picks: { part: string; engine?: string; name: string; price: number; date: string; url: string }[]
}

interface Result {
  compatibility: "YES" | "NO" | "UNCERTAIN"
  vehicle_spec: { manufacturer_model: string; production_year: string; engine_spec: string }
  parts_analysis: { part_name: string; oemNumber?: string; verdict: string; reason: string }[]
  expert_tips: string[]
  conclusion: string
  productInfo?: string
  cacheHit?: boolean
}

const FIELD =
  "h-12 w-full rounded-[10px] border border-input bg-card px-3.5 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted"
const VERDICT = {
  YES: { label: "맞을 가능성이 높아요", cls: "border-[#ABEFC6] bg-[#ECFDF3] text-[#067647]" },
  NO: { label: "안 맞을 가능성이 높아요", cls: "border-[#FECDCA] bg-[#FEF3F2] text-[#B42318]" },
  UNCERTAIN: { label: "확인이 더 필요해요", cls: "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]" },
} as const

export function CheckPage({ cars }: { cars: CheckCar[] }) {
  const brands = useMemo(() => Array.from(new Set(cars.map((c) => c.brand))), [cars])
  const [brand, setBrand] = useState("")
  const [carId, setCarId] = useState("")
  const [year, setYear] = useState("")
  const [engine, setEngine] = useState("")
  const [fromMy, setFromMy] = useState(false)
  const [product, setProduct] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<Result | null>(null)

  // 등록한 내 차가 있으면 미리 골라 둔다
  useEffect(() => {
    const my = loadMyCar()
    const c = my && cars.find((x) => x.id === my.car.id)
    if (c) {
      setBrand(c.brand)
      setCarId(c.id)
      if (my.year) setYear(String(my.year))
      if (my.engine) setEngine(my.engine)
      setFromMy(true)
    }
  }, [cars])

  const car = cars.find((c) => c.id === carId)
  // 엔진을 골랐으면 그 엔진 상품만 (가솔린 차에 디젤 오일이 보이지 않게)
  const picks = car ? car.picks.filter((p) => !p.engine || !engine || p.engine === engine) : []
  const parsed = parseProductInput(product)
  const ok = !!car && (!!parsed.name || !!parsed.url) && !busy

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (t) setProduct(t)
    } catch {
      setError("붙여넣기 권한이 없어요. 입력칸을 길게 눌러 붙여 넣어 주세요.")
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ok || !car) return
    setBusy(true)
    setError("")
    setResult(null)
    track({ type: "report", carId: car.id, meta: { via: "check_submit" } })
    try {
      const r = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId: car.id, year: year ? Number(year) : undefined, engine: engine || undefined, product }),
      })
      const j = await r.json()
      if (!r.ok) setError(j.error ?? "확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.")
      else setResult(j as Result)
    } catch {
      setError("인터넷 연결을 확인하고 다시 시도해 주세요.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {/* ① 내 차 */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] font-bold">내 차</p>
          {fromMy && <span className="text-[12px] text-muted-foreground">등록한 차로 골라 뒀어요</span>}
        </div>
        <div className="mt-2 grid grid-cols-[0.8fr_1.2fr] gap-2">
          <label className="sr-only" htmlFor="ck-brand">브랜드</label>
          <select id="ck-brand" className={FIELD} value={brand} onChange={(e) => { setBrand(e.target.value); setCarId(""); setYear(""); setEngine(""); setResult(null) }}>
            <option value="">브랜드</option>
            {brands.map((b) => <option key={b}>{b}</option>)}
          </select>
          <label className="sr-only" htmlFor="ck-car">차종</label>
          <select id="ck-car" className={FIELD} value={carId} disabled={!brand} onChange={(e) => { setCarId(e.target.value); setYear(""); setEngine(""); setResult(null) }}>
            <option value="">차종</option>
            {cars.filter((c) => c.brand === brand).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        {car && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="sr-only" htmlFor="ck-year">연식</label>
            <select id="ck-year" className={FIELD} value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">연식 (선택)</option>
              {car.years.map((y) => <option key={y} value={y}>{y}년형</option>)}
            </select>
            <label className="sr-only" htmlFor="ck-engine">엔진</label>
            <select id="ck-engine" className={FIELD} value={engine} onChange={(e) => setEngine(e.target.value)} disabled={car.engines.length < 2}>
              <option value="">{car.engines.length < 2 ? car.engines[0] ?? "엔진" : "엔진 (선택)"}</option>
              {car.engines.length > 1 && car.engines.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ② 이 차에 맞게 골라 둔 상품 (붙여 넣기 전에 먼저) */}
      {car && picks.length > 0 && !result && (
        <div className="mt-4 rounded-2xl border border-primary/30 bg-[#F6FEF9] p-4">
          <p className="text-[15px] font-bold">{car.name}에 맞게 골라 둔 상품</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">상품명의 규격·차종이 이 차와 맞는 것만 골랐어요</p>
          <ul className="mt-3 divide-y divide-border rounded-[12px] border border-border bg-card">
            {picks.map((p) => (
              <li key={p.url}>
                <OutboundLink href={p.url} target="coupang" carId={car.id} sponsored className="flex items-center gap-3 px-3.5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold text-primary">{p.part}</span>
                    <span className="line-clamp-1 block text-[13px]">{p.name}</span>
                  </span>
                  <span className="num shrink-0 text-right text-[14px] font-bold">
                    {p.price.toLocaleString("ko-KR")}원
                    <span className="block text-[11px] font-normal text-muted-foreground">{p.date.slice(5).replace("-", "/")} 기준</span>
                  </span>
                </OutboundLink>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{AFFILIATE_TEXT}</p>
        </div>
      )}

      {/* ③ 다른 상품 확인 */}
      <form onSubmit={submit} className="mt-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-[15px] font-bold">다른 상품이면 붙여 넣으세요</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">쿠팡 앱 상품 화면 → <b>공유</b> → <b>복사</b> 후 여기 붙여넣기. 상품명이나 품번만 적어도 돼요</p>
        <label className="sr-only" htmlFor="ck-product">상품</label>
        <textarea
          id="ck-product"
          rows={3}
          className="mt-3 w-full rounded-[10px] border border-input bg-card px-3.5 py-3 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="예: [쿠팡] 불스원 와이퍼 650mm+400mm 세트 https://link.coupang.com/a/…"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
        />
        {(parsed.name || parsed.url) && (
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {parsed.name ? <>상품명: <b className="text-foreground">{parsed.name.slice(0, 60)}</b></> : "링크에서 상품명을 읽어 볼게요"}
          </p>
        )}
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
          <button type="button" onClick={paste} className="h-12 rounded-[10px] border border-border px-4 text-[14px] font-semibold">
            붙여넣기
          </button>
          <button type="submit" disabled={!ok} className="h-12 rounded-[10px] bg-primary text-[16px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:bg-[#9BB8AD]">
            {busy ? "확인하는 중…" : !car ? "차종을 먼저 골라 주세요" : "내 차에 맞는지 확인"}
          </button>
        </div>
        {error && <p role="alert" className="mt-3 rounded-[10px] bg-[#FEF3F2] px-3.5 py-2.5 text-[14px] text-[#B42318]">{error}</p>}

        {car && (
          <details className="mt-3 text-[13px] text-muted-foreground">
            <summary className="min-h-[40px] cursor-pointer content-center font-semibold">AI에게 이렇게 물어봐요</summary>
            <ul className="space-y-1 rounded-[10px] bg-muted px-3.5 py-3 leading-relaxed">
              <li>차량: {car.label.split(" · ")[0]} · {year ? `${year}년형` : "연식 미선택"} · {engine || (car.engines.length === 1 ? car.engines[0] : "엔진 미선택")}</li>
              <li>상품: {parsed.name ?? (parsed.url ? "링크의 상품명" : "(입력 전)")}</li>
              <li>근거: 정비핵의 이 차 소모품 규격·순정 품번 (제조사 취급설명서 기준)</li>
              <li>답: 맞음 / 안 맞음 / 확인 필요 + 규격·품번 근거. 확실하지 않으면 &lsquo;확인 필요&rsquo;로 답하게 해요</li>
              <li>차대번호는 받지 않아요</li>
            </ul>
          </details>
        )}
      </form>

      {result && <ResultView r={result} carId={car?.id} onReset={() => setResult(null)} />}
    </div>
  )
}

function ResultView({ r, carId, onReset }: { r: Result; carId?: string; onReset: () => void }) {
  const v = VERDICT[r.compatibility] ?? VERDICT.UNCERTAIN
  return (
    <section className={`mt-4 rounded-2xl border p-4 ${v.cls}`} aria-live="polite">
      <p className="text-[18px] font-extrabold">{v.label}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-foreground">{r.conclusion}</p>
      <ul className="mt-3 space-y-2">
        {r.parts_analysis.map((p, i) => (
          <li key={i} className="rounded-[10px] bg-background/70 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground">
            <b>{p.part_name}</b>
            {p.oemNumber && p.oemNumber !== "확인 필요" && <span className="ml-1 text-muted-foreground">({p.oemNumber})</span>}
            <span className="mt-0.5 block text-muted-foreground">{p.reason}</span>
          </li>
        ))}
      </ul>
      {r.productInfo && <p className="mt-2 line-clamp-1 text-[11px] text-muted-foreground">확인한 상품: {r.productInfo}</p>}
      <p className="mt-1 text-[11px] text-muted-foreground">AI 판정은 참고용이에요. 비싼 부품은 판매자에게 한 번 더 물어보세요.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={onReset} className="h-11 rounded-[10px] border border-border bg-card text-[14px] font-semibold text-foreground">
          다른 상품 확인
        </button>
        {carId && (
          <Link href={`/cars/${carId}`} className="flex h-11 items-center justify-center rounded-[10px] bg-foreground text-[14px] font-semibold text-background">
            이 차 부품 가격
          </Link>
        )}
      </div>
    </section>
  )
}

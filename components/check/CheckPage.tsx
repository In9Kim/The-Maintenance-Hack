"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { loadMyCar } from "@/lib/my-car"
import { parseProductInput } from "@/lib/compat-request"
import { AFFILIATE_TEXT } from "@/lib/affiliate"
import { track } from "@/lib/track"
import { useAuthToken } from "@/components/my/useAuthToken"
import { LoginButtons } from "@/components/my/LoginButtons"
import { MyCarLine } from "@/components/my/MyCarLine"
import { InfoTip } from "@/components/ui/InfoTip"
import { ProductRow } from "@/components/cars/LiveCoupang"
import { PartIcon } from "@/components/PartIcon"
import { fitsEngine } from "@/lib/quote-analyze"

export interface CheckCar {
  id: string
  brand: string
  label: string
  name: string
  years: number[]
  engines: string[]
  /** 이 차에 맞게 고른 쿠팡 상품 (가격은 date 기준) */
  picks: { slug: string; name: string; price: number; url: string; image?: string }[]
  /** 부품 고르기 버튼 (쿠팡 검색용) */
  parts: { slug: string; name: string; engine?: string }[]
}

interface Item { productId: number; name: string; price: number; url: string; image?: string; rocket: boolean }

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
  const [q, setQ] = useState("")
  const [search, setSearch] = useState<{ busy: boolean; items: Item[]; error?: string } | null>(null)
  const [found, setFound] = useState<Record<string, Item[]>>({})
  const [openPart, setOpenPart] = useState<string | null>(null)
  // AI 확인은 로그인한 사람만 (검색·쿠팡 보기는 로그인 없이)
  const { token, setToken, providers } = useAuthToken()
  const [needLogin, setNeedLogin] = useState(false)

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
  // 엔진을 골랐으면 그 엔진 부품만 (가솔린 차에 디젤 오일이 보이지 않게)
  const parts = useMemo(() => (car ? car.parts.filter((p) => !p.engine || !engine || p.engine === engine) : []), [car, engine])
  // 부품마다 쿠팡 상품을 미리 찾아 둔다 (골라 둔 상품이 있으면 맨 앞에)
  useEffect(() => {
    if (!car) return
    let alive = true
    setFound({})
    setOpenPart(null)
    for (const p of parts) {
      const pick = car.picks.find((k) => k.slug === p.slug)
      fetch(`/api/coupang-search?${new URLSearchParams({ carId: car.id, part: p.slug })}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .catch(() => ({ items: [] }))
        .then((j: { items?: Item[] }) => {
          const got = (j.items ?? []).filter((x) => (!pick || x.url !== pick.url) && fitsEngine(x.name, engine || (car.engines.length === 1 ? car.engines[0] : undefined)))
          const list = pick ? [{ productId: -1, name: pick.name, price: pick.price, url: pick.url, image: pick.image, rocket: false }, ...got] : got
          if (alive) setFound((f) => ({ ...f, [p.slug]: list.slice(0, 3) }))
        })
    }
    return () => {
      alive = false
    }
  }, [car, parts, engine])
  const loadingParts = parts.some((p) => !found[p.slug])
  const shown = parts.filter((p) => (found[p.slug]?.length ?? 0) > 0)
  const parsed = parseProductInput(product)
  const ok = !!car && (!!parsed.name || !!parsed.url) && !busy

  /** 쿠팡 검색 (화면 안에서): 부품 버튼 또는 직접 입력 */
  const doSearch = async (opt: { part?: string; q?: string }) => {
    if (!car) return
    setSearch({ busy: true, items: [] })
    track({ type: "nav", carId: car.id, meta: { via: "check_search", part: opt.part ?? null } })
    const sp = new URLSearchParams({ carId: car.id, ...(opt.part ? { part: opt.part } : { q: opt.q ?? "" }) })
    try {
      const r = await fetch(`/api/coupang-search?${sp}`)
      const j = await r.json()
      if (!r.ok) setSearch({ busy: false, items: [], error: j.error })
      else setSearch({ busy: false, items: j.items ?? [] })
    } catch {
      setSearch({ busy: false, items: [], error: "인터넷 연결을 확인하고 다시 시도해 주세요." })
    }
  }

  const verify = async (text: string): Promise<{ result?: Result; error?: string; login?: boolean }> => {
    if (!car) return { error: "차종을 먼저 골라 주세요." }
    if (!token) return { login: true }
    try {
      const r = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ carId: car.id, year: year ? Number(year) : undefined, engine: engine || undefined, product: text }),
      })
      const j = await r.json()
      if (r.status === 401) {
        setToken(null)
        return { login: true }
      }
      return r.ok ? { result: j as Result } : { error: j.error ?? "확인하지 못했어요. 잠시 뒤 다시 시도해 주세요." }
    } catch {
      return { error: "인터넷 연결을 확인하고 다시 시도해 주세요." }
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ok || !car) return
    setBusy(true)
    setError("")
    setResult(null)
    track({ type: "report", carId: car.id, meta: { via: "check_submit" } })
    const r = await verify(product)
    setNeedLogin(!!r.login)
    if (r.error) setError(r.error)
    else if (r.result) setResult(r.result)
    setBusy(false)
  }

  return (
    <div>
      {/* ① 내 차: 등록한 차면 한 줄 */}
      {fromMy && car ? (
        <MyCarLine name={car.name} detail={[year && `${year}년형`, engine || car.engines[0]].filter(Boolean).join(" · ")} onChange={() => setFromMy(false)} />
      ) : (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[15px] font-bold">내 차</p>
        <div className="mt-2 grid grid-cols-[0.8fr_1.2fr] gap-2">
          <label className="sr-only" htmlFor="ck-brand">브랜드</label>
          <select id="ck-brand" className={FIELD} value={brand} onChange={(e) => { setBrand(e.target.value); setCarId(""); setYear(""); setEngine(""); setResult(null); setSearch(null) }}>
            <option value="">브랜드</option>
            {brands.map((b) => <option key={b}>{b}</option>)}
          </select>
          <label className="sr-only" htmlFor="ck-car">차종</label>
          <select id="ck-car" className={FIELD} value={carId} disabled={!brand} onChange={(e) => { setCarId(e.target.value); setYear(""); setEngine(""); setResult(null); setSearch(null) }}>
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
      )}

      {/* ② 내 차 부품: 한 줄에 그림·이름·쿠팡 최저가, 누르면 상품 */}
      {car && (
        <div className="mt-4 rounded-2xl border border-border bg-card px-4 pb-3 pt-4">
          <p className="flex items-center gap-1.5 text-[15px] font-bold">
            내 차 부품
            <InfoTip label="고른 기준" align="left">이 차 이름으로 쿠팡을 찾아 상품명에 차종이 맞는 것만 보여 줘요. 오른쪽 가격은 맨 위 상품 기준이고 바뀔 수 있어요. 쿠팡에 맞는 상품이 없는 부품은 뺐어요.</InfoTip>
          </p>
          {loadingParts ? (
            <div className="mt-3 h-48 animate-pulse rounded-[12px] bg-muted" />
          ) : shown.length === 0 ? (
            <p className="mt-3 text-[14px] text-muted-foreground">쿠팡에서 이 차에 맞는 상품을 찾지 못했어요.</p>
          ) : (
            <ul className="mt-2">
              {shown.map((p) => {
                const items = found[p.slug] ?? []
                const on = openPart === p.slug
                return (
                  <li key={p.slug} className="border-b border-border last:border-0">
                    <button onClick={() => setOpenPart(on ? null : p.slug)} aria-expanded={on} className="flex min-h-[56px] w-full items-center gap-3 py-2 text-left">
                      <PartIcon name={p.name} size={36} />
                      <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{p.name}</span>
                      <span className="num shrink-0 text-[14px] font-bold">{items[0].price.toLocaleString("ko-KR")}원</span>
                      <span aria-hidden className={`shrink-0 text-[16px] text-muted-foreground transition-transform ${on ? "rotate-90" : ""}`}>›</span>
                    </button>
                    {on && (
                      <ul className="mb-3 divide-y divide-border rounded-[10px] border border-border">
                        {items.map((it) => (
                          <li key={it.productId}>
                            <ProductRow href={it.url} carId={car.id} partId={p.slug} name={it.name} price={it.price} image={it.image} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (q.trim().length >= 2) doSearch({ q })
            }}
            className="mt-3 grid grid-cols-[1fr_auto] gap-2"
          >
            <label className="sr-only" htmlFor="ck-q">다른 부품 찾기</label>
            <input id="ck-q" className={FIELD} placeholder="다른 부품 찾기 (예: 브레이크 디스크)" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="submit" className="h-12 rounded-[10px] bg-foreground px-4 text-[14px] font-bold text-background">찾기</button>
          </form>
          {search?.busy && <div className="mt-3 h-28 animate-pulse rounded-[12px] bg-muted" />}
          {search?.error && <p role="alert" className="mt-3 rounded-[10px] bg-[#FEF3F2] px-3.5 py-2.5 text-[14px] text-[#B42318]">{search.error}</p>}
          {search && !search.busy && !search.error && search.items.length === 0 && (
            <p className="mt-3 text-[14px] text-muted-foreground">이 차에 맞는 상품이 없어요. 다른 말로 찾아보세요.</p>
          )}
          {search && !search.busy && search.items.length > 0 && (
            <ul className="mt-3 divide-y divide-border rounded-[10px] border border-border">
              {search.items.slice(0, 5).map((it) => (
                <li key={it.productId}>
                  <ProductRow href={it.url} carId={car.id} partId={`check-${q}`} name={it.name} price={it.price} image={it.image} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">상품명의 연식·엔진이 내 차와 같은지 보세요. {AFFILIATE_TEXT}</p>
        </div>
      )}

      {/* ④ 쿠팡에서 이미 고른 상품: 공유 글 붙여넣기 (보조) */}
      <details className="mt-4 rounded-2xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-[15px] font-bold">쿠팡에서 이미 고른 상품이 있나요?</summary>
      <form onSubmit={submit} className="mt-2">
        <p className="text-[13px] text-muted-foreground">쿠팡 앱 상품 화면 → <b>공유</b> → <b>복사</b> 후 아래 칸을 길게 눌러 붙여넣기. 상품명이나 품번만 적어도 돼요</p>
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
        <div className="mt-3">
          <button type="submit" disabled={!ok} className="h-12 w-full rounded-[10px] bg-primary text-[16px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:bg-[#9BB8AD]">
            {busy ? "확인하는 중…" : !car ? "차종을 먼저 골라 주세요" : "내 차에 맞는지 확인"}
          </button>
        </div>
        {error && <p role="alert" className="mt-3 rounded-[10px] bg-[#FEF3F2] px-3.5 py-2.5 text-[14px] text-[#B42318]">{error}</p>}
        {needLogin && !token && <LoginBox providers={providers} />}

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
      </details>

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

/** AI 확인 전에 로그인 안내 (로그인 후 이 화면으로 돌아옴) */
function LoginBox({ providers }: { providers: Parameters<typeof LoginButtons>[0]["providers"] }) {
  return (
    <div className="mt-2 rounded-[12px] bg-muted p-3.5">
      <p className="text-[14px] font-semibold">로그인하면 내 차에 맞는지 AI로 확인할 수 있어요 (하루 3번)</p>
      <div className="mt-2.5"><LoginButtons providers={providers} next="/check" /></div>
    </div>
  )
}

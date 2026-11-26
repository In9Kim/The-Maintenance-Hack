"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { loadMyCar } from "@/lib/my-car"
import { parseProductInput } from "@/lib/compat-request"
import { OutboundLink } from "@/components/seo/OutboundLink"
import { AFFILIATE_TEXT } from "@/lib/affiliate"
import { track } from "@/lib/track"
import { useAuthToken } from "@/components/my/useAuthToken"
import { LoginButtons } from "@/components/my/LoginButtons"

export interface CheckCar {
  id: string
  brand: string
  label: string
  name: string
  years: number[]
  engines: string[]
  /** 이 차에 맞게 고른 쿠팡 상품 (가격은 date 기준) */
  picks: { part: string; engine?: string; name: string; price: number; date: string; url: string }[]
  /** 부품 고르기 버튼 (쿠팡 검색용) */
  parts: { slug: string; name: string; engine?: string }[]
}

interface Item { productId: number; name: string; price: number; url: string; image?: string; rocket: boolean }
type ItemCheck = { busy: boolean; result?: Result; error?: string; login?: boolean }

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
  const [partSel, setPartSel] = useState("")
  const [q, setQ] = useState("")
  const [search, setSearch] = useState<{ busy: boolean; items: Item[]; pickId: number | null; error?: string } | null>(null)
  const [checks, setChecks] = useState<Record<number, ItemCheck>>({})
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
  // 엔진을 골랐으면 그 엔진 상품만 (가솔린 차에 디젤 오일이 보이지 않게)
  const picks = car ? car.picks.filter((p) => !p.engine || !engine || p.engine === engine) : []
  const parsed = parseProductInput(product)
  const ok = !!car && (!!parsed.name || !!parsed.url) && !busy

  /** 쿠팡 검색 (화면 안에서): 부품 버튼 또는 직접 입력 */
  const doSearch = async (opt: { part?: string; q?: string }) => {
    if (!car) return
    setSearch({ busy: true, items: [], pickId: null })
    setChecks({})
    track({ type: "nav", carId: car.id, meta: { via: "check_search", part: opt.part ?? null } })
    const sp = new URLSearchParams({ carId: car.id, ...(opt.part ? { part: opt.part } : { q: opt.q ?? "" }) })
    try {
      const r = await fetch(`/api/coupang-search?${sp}`)
      const j = await r.json()
      if (!r.ok) setSearch({ busy: false, items: [], pickId: null, error: j.error })
      else setSearch({ busy: false, items: j.items ?? [], pickId: j.pickId ?? null })
    } catch {
      setSearch({ busy: false, items: [], pickId: null, error: "인터넷 연결을 확인하고 다시 시도해 주세요." })
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

  const checkItem = async (it: Item) => {
    setChecks((c) => ({ ...c, [it.productId]: { busy: true } }))
    track({ type: "report", carId: car?.id, meta: { via: "check_item" } })
    const r = await verify(it.name)
    setChecks((c) => ({ ...c, [it.productId]: { busy: false, ...r } }))
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
      {/* ① 내 차 */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] font-bold">내 차</p>
          {fromMy && <span className="text-[12px] text-muted-foreground">등록한 차로 골라 뒀어요</span>}
        </div>
        <div className="mt-2 grid grid-cols-[0.8fr_1.2fr] gap-2">
          <label className="sr-only" htmlFor="ck-brand">브랜드</label>
          <select id="ck-brand" className={FIELD} value={brand} onChange={(e) => { setBrand(e.target.value); setCarId(""); setYear(""); setEngine(""); setResult(null); setSearch(null); setPartSel("") }}>
            <option value="">브랜드</option>
            {brands.map((b) => <option key={b}>{b}</option>)}
          </select>
          <label className="sr-only" htmlFor="ck-car">차종</label>
          <select id="ck-car" className={FIELD} value={carId} disabled={!brand} onChange={(e) => { setCarId(e.target.value); setYear(""); setEngine(""); setResult(null); setSearch(null); setPartSel("") }}>
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

      {/* ③ 화면 안에서 쿠팡 검색 → 고른 상품이 맞는지 바로 확인 (앱 이동 없음) */}
      {car && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-4">
          <p className="text-[15px] font-bold">다른 상품 찾아서 확인하기</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">부품을 누르면 쿠팡 상품이 나와요. [내 차에 맞나?]를 누르면 바로 확인해요</p>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {car.parts
              .filter((p) => !p.engine || !engine || p.engine === engine)
              .map((p) => (
                <button
                  key={p.slug}
                  onClick={() => {
                    setPartSel(p.slug)
                    doSearch({ part: p.slug })
                  }}
                  className={`h-10 shrink-0 rounded-full px-3.5 text-[14px] font-semibold ${partSel === p.slug ? "bg-foreground text-background" : "border border-border bg-card"}`}
                >
                  {p.name.replace(/\s*\(.*?\)/g, "")}
                </button>
              ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (q.trim().length >= 2) {
                setPartSel("")
                doSearch({ q })
              }
            }}
            className="mt-2 grid grid-cols-[1fr_auto] gap-2"
          >
            <label className="sr-only" htmlFor="ck-q">직접 찾기</label>
            <input id="ck-q" className={FIELD} placeholder="직접 찾기 (예: 브레이크 디스크)" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="submit" className="h-12 rounded-[10px] bg-foreground px-4 text-[14px] font-bold text-background">찾기</button>
          </form>

          {search?.busy && <div className="mt-3 h-40 animate-pulse rounded-[12px] bg-muted" />}
          {search?.error && <p role="alert" className="mt-3 rounded-[10px] bg-[#FEF3F2] px-3.5 py-2.5 text-[14px] text-[#B42318]">{search.error}</p>}
          {search && !search.busy && !search.error && search.items.length === 0 && (
            <p className="mt-3 text-[14px] text-muted-foreground">검색 결과가 없어요. 다른 말로 찾아보세요.</p>
          )}
          {search && !search.busy && search.items.length > 0 && (
            <ul className="mt-3 space-y-2">
              {search.items.map((it) => {
                const c = checks[it.productId]
                const v = c?.result ? VERDICT[c.result.compatibility] ?? VERDICT.UNCERTAIN : null
                return (
                  <li key={it.productId} className="rounded-[12px] border border-border p-3">
                    <div className="flex gap-3">
                      {it.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image} alt="" width={64} height={64} loading="lazy" className="h-16 w-16 shrink-0 rounded-lg bg-white object-contain ring-1 ring-border" />
                      )}
                      <span className="min-w-0 flex-1">
                        {search.pickId === it.productId && <span className="mb-0.5 inline-block rounded bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">정비핵 추천</span>}
                        <span className="line-clamp-2 block text-[13px] leading-snug">{it.name}</span>
                        <span className="num mt-0.5 block text-[15px] font-bold">
                          {it.price.toLocaleString("ko-KR")}원{it.rocket && <span className="ml-1 text-[11px] font-semibold text-[#0073E9]">로켓</span>}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button onClick={() => checkItem(it)} disabled={c?.busy} className="h-10 rounded-[8px] border border-border text-[13px] font-semibold disabled:opacity-60">
                        {c?.busy ? "확인하는 중…" : "내 차에 맞나?"}
                      </button>
                      <OutboundLink href={it.url} target="coupang" carId={car.id} sponsored className="flex h-10 items-center justify-center rounded-[8px] bg-primary text-[13px] font-bold text-primary-foreground">
                        쿠팡에서 보기
                      </OutboundLink>
                    </div>
                    {c?.error && <p className="mt-2 text-[13px] text-[#B42318]">{c.error}</p>}
                    {c?.login && <LoginBox providers={providers} />}
                    {c?.result && v && (
                      <div className={`mt-2 rounded-[10px] border px-3 py-2.5 ${v.cls}`}>
                        <p className="text-[14px] font-bold">{v.label}</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">{c.result.parts_analysis[0]?.reason ?? c.result.conclusion}</p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {search && search.items.length > 0 && (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">가격은 지금 쿠팡 검색 기준이에요. AI 판정은 로그인하면 하루 3번, 참고용이에요. {AFFILIATE_TEXT}</p>
          )}
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

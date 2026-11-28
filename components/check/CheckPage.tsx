"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { PartIcon } from "@/components/PartIcon"
import { loadMyCar } from "@/lib/my-car"
import { parseProductInput } from "@/lib/compat-request"
import { track } from "@/lib/track"
import { useAuthToken } from "@/components/my/useAuthToken"
import { LoginButtons } from "@/components/my/LoginButtons"
import { MyCarLine } from "@/components/my/MyCarLine"

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
  // AI 확인은 로그인한 사람만 (검색·쿠팡 보기는 로그인 없이)
  const { token, setToken, providers } = useAuthToken()
  const [needLogin, setNeedLogin] = useState(false)
  const boxRef = useRef<HTMLTextAreaElement>(null)

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
  const parsed = parseProductInput(product)
  const ok = !!car && (!!parsed.name || !!parsed.url) && !busy

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
      )}

      {/* ② 쿠팡 상품 붙여넣기 → 내 차에 맞는지 */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
      <form onSubmit={submit}>
        <p className="text-[15px] font-bold">사려는 상품을 붙여넣어 주세요</p>
        {!product && !result && <HowTo />}
        <button
          type="button"
          onClick={async () => {
            setError("")
            try {
              const t = (await navigator.clipboard.readText()).trim()
              if (t) setProduct(t)
              else setError("복사한 내용이 없어요. 쿠팡에서 공유 → 복사를 먼저 해 주세요.")
            } catch {
              // 아이폰은 '붙여넣기' 말풍선을 안 누르면 여기로 온다 → 칸에 커서를 두고 길게 눌러 붙여넣게
              boxRef.current?.focus()
              setError("아래 칸을 길게 눌러 '붙여넣기'를 눌러 주세요.")
            }
          }}
          className="mt-3 h-12 w-full rounded-[10px] border border-primary text-[15px] font-bold text-primary active:bg-primary/5"
        >
          복사한 상품 붙여넣기
        </button>
        <label className="sr-only" htmlFor="ck-product">상품</label>
        <textarea
          id="ck-product"
          ref={boxRef}
          rows={3}
          className="mt-3 w-full rounded-[10px] border border-input bg-card px-3.5 py-3 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="예: [쿠팡] 불스원 와이퍼 650mm+400mm 세트 https://link.coupang.com/a/…"
          value={product}
          onChange={(e) => {
            setProduct(e.target.value)
            if (e.target.value) setError("")
          }}
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
      </div>

      {result && <ResultView r={result} carId={car?.id} onReset={() => setResult(null)} />}
    </div>
  )
}

/** 쓰는 법 그림 3칸: 쿠팡에서 공유→복사 · 여기서 붙여넣기 · AI 판정 결과 (그림은 예시) */
function HowTo() {
  const tile = "relative flex aspect-[3/4] flex-col overflow-hidden rounded-[10px] bg-muted p-1.5"
  const bar = "block h-1.5 rounded-full bg-[#D0D5DD]"
  const ring = "ring-2 ring-[#12B76A] ring-offset-1"
  return (
    <ol className="mt-3 grid grid-cols-3 gap-2" aria-label="쓰는 법: 쿠팡에서 공유 후 복사, 여기서 붙여넣기, 내 차에 맞는지 결과">
      <li className="text-center">
        <span aria-hidden className={tile}>
          <span className="flex flex-1 flex-col rounded-md bg-white p-1.5">
            <span className="flex justify-end">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${ring}`}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#344054" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7h14v-7" />
                </svg>
              </span>
            </span>
            <span className="mt-1 flex justify-center"><PartIcon name="와이퍼" size={34} /></span>
            <span className={`${bar} mt-1.5 w-full`} />
            <span className={`${bar} mt-1 w-2/3`} />
          </span>
          <span className="mt-1 flex items-center justify-center gap-1 rounded-md bg-white py-1">
            <span className={`rounded px-1.5 text-[10px] font-bold text-foreground ${ring}`}>복사</span>
          </span>
        </span>
        <span className="mt-1 block text-[12px] font-semibold">쿠팡: 공유 → 복사</span>
      </li>
      <li className="text-center">
        <span aria-hidden className={tile}>
          <span className="flex-1 rounded-md border border-[#D0D5DD] bg-white p-1.5 text-left text-[9px] leading-snug text-muted-foreground">
            [쿠팡] 와이퍼 650mm+400mm 세트 link.coupang.com/…
          </span>
          <span className={`mt-1.5 rounded-md border border-primary bg-white py-1 text-[9px] font-bold text-primary ${ring}`}>붙여넣기</span>
        </span>
        <span className="mt-1 block text-[12px] font-semibold">여기서 붙여넣기</span>
      </li>
      <li className="text-center">
        <span aria-hidden className={tile}>
          <span className="flex flex-1 flex-col rounded-md border border-[#ABEFC6] bg-[#ECFDF3] p-1.5 text-left">
            <span className="flex items-center gap-1 text-[10px] font-extrabold text-[#067647]">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#12B76A] text-[9px] text-white">✓</span>
              맞아요
            </span>
            <span className="num mt-1.5 rounded bg-white/80 px-1 py-0.5 text-[9px] text-foreground">운전석 650mm ✓</span>
            <span className="num mt-1 rounded bg-white/80 px-1 py-0.5 text-[9px] text-foreground">조수석 400mm ✓</span>
            <span className={`${bar} mt-1.5 w-full`} />
          </span>
        </span>
        <span className="mt-1 block text-[12px] font-semibold">맞는지 바로 판정</span>
      </li>
    </ol>
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

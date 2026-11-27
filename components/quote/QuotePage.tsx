"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { loadMyCar } from "@/lib/my-car"
import { OutboundLink } from "@/components/seo/OutboundLink"
import { AFFILIATE_TEXT } from "@/lib/affiliate"
import { track } from "@/lib/track"
import { LiveCoupang } from "@/components/cars/LiveCoupang"
import { quoteSearchWord } from "@/lib/quote-analyze"
import { useAuthToken } from "@/components/my/useAuthToken"
import { LoginButtons } from "@/components/my/LoginButtons"
import { MyCarLine } from "@/components/my/MyCarLine"
import { InfoTip } from "@/components/ui/InfoTip"
import { addItem, hasItem, loadShopList, removeItem, saveShopList, type ShopItem } from "@/lib/shop-list"

export interface QuoteCar {
  id: string
  brand: string
  label: string
  name: string
  years: number[]
  engines: string[]
}

interface Item {
  name: string
  kind: "done" | "recommended" | "inspection"
  parts_price: number | null
  labor_price: number | null
  verdict: "gongim" | "center" | "ask"
  reason: string
  ours?: { slug: string; name: string; self: number; dealer: number; shop: { name: string; price: number; url: string; image?: string; date: string } | null }
}
interface Result {
  readable: boolean
  shop: string
  items: Item[]
  summary: string
}

const FIELD =
  "h-12 w-full rounded-[10px] border border-input bg-card px-3.5 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted"
const VERDICT = {
  gongim: { label: "공임나라 가능", cls: "bg-[#ECFDF3] text-[#067647]" },
  center: { label: "센터 권장", cls: "bg-[#EFF4FF] text-[#1849A9]" },
  ask: { label: "전화로 확인", cls: "bg-[#FFFAEB] text-[#B54708]" },
} as const
const KIND = { done: "한 작업", recommended: "권고", inspection: "점검" } as const
const won = (n: number) => `${n.toLocaleString("ko-KR")}원`

/** 로그인 안 한 사람의 하루 무료 횟수를 기기별로 세기 위한 무작위 값 (개인정보 아님, 이 브라우저에만) */
function deviceId(): string {
  try {
    let v = localStorage.getItem("mh_device")
    if (!v) {
      v = crypto.randomUUID()
      localStorage.setItem("mh_device", v)
    }
    return v
  } catch {
    return ""
  }
}

/** 사진을 긴 변 1568px JPEG로 줄인다 (AI가 읽기 좋은 크기, 전송량 감소). 원본은 어디에도 저장하지 않음 */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = bad
      i.src = url
    })
    const scale = Math.min(1, 1568 / Math.max(img.width, img.height))
    const c = document.createElement("canvas")
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL("image/jpeg", 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function QuotePage({ cars }: { cars: QuoteCar[] }) {
  const brands = useMemo(() => Array.from(new Set(cars.map((c) => c.brand))), [cars])
  const [brand, setBrand] = useState("")
  const [carId, setCarId] = useState("")
  const [year, setYear] = useState("")
  const [engine, setEngine] = useState("")
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [elapsed, setElapsed] = useState(0)
  const [live, setLive] = useState<Item[]>([]) // 분석 중 받는 대로 보여 줄 항목
  const [openShop, setOpenShop] = useState<number[]>([])
  // 로그인 없이 하루 1번, 로그인하면 하루 3번. undefined = 로그인 확인 중
  const { token, setToken, providers } = useAuthToken()
  const [needLogin, setNeedLogin] = useState(false)
  // 등록한 내 차로 채웠으면 입력칸 대신 한 줄로 (바꾸기를 누르면 입력칸)
  const [fromMy, setFromMy] = useState(false)

  // 분석 중 경과 시간 (진행 단계 표시용)
  useEffect(() => {
    if (!busy) return
    setElapsed(0)
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [busy])

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

  const pick = async (f?: File) => {
    if (!f) return
    setError("")
    setResult(null)
    try {
      setPreview(await shrink(f))
    } catch {
      setError("사진을 열지 못했어요. 다른 사진으로 해 주세요.")
    }
  }

  const finish = (res: Result) => {
    if (!res.readable) {
      setError("견적서·점검내역을 읽지 못했어요. 표가 화면에 꽉 차게, 글자가 선명하게 다시 찍어 주세요.")
      return
    }
    setResult(res)
    // 결과까지 본 사람 수와 아낄 수 있다고 나온 항목 수 (사용성 확인용, 견적 내용은 보내지 않음)
    track({ type: "report", carId: car!.id, meta: { via: "quote_result", items: res.items.length, gongim: res.items.filter((i) => i.verdict === "gongim").length, login: !!token } })
    setPreview(null) // 결과가 나오면 사진은 화면에서도 지움
  }

  const analyze = async () => {
    if (!car || !preview) return
    setBusy(true)
    setError("")
    setLive([])
    track({ type: "report", carId: car.id, meta: { via: "quote_submit" } })
    try {
      const r = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ carId: car.id, year: year ? Number(year) : undefined, engine: engine || undefined, image: preview, mediaType: "image/jpeg", device: deviceId(), stream: true }),
      })
      // 받는 대로(한 줄에 하나): 항목이 완성될 때마다 화면에 추가
      if (r.ok && r.body && (r.headers.get("content-type") ?? "").includes("ndjson")) {
        const reader = r.body.getReader()
        const dec = new TextDecoder()
        let buf = ""
        let ended = false
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const lines = buf.split("\n")
          buf = lines.pop() ?? ""
          for (const line of lines) {
            if (!line.trim()) continue
            const ev = JSON.parse(line) as { t: "item"; item: Item } | { t: "done"; result: Result } | { t: "error"; error: string }
            if (ev.t === "item") setLive((l) => [...l, ev.item])
            else if (ev.t === "done") {
              ended = true
              finish(ev.result)
            } else {
              ended = true
              setError(ev.error)
            }
          }
        }
        if (!ended) setError("분석이 중간에 끊겼어요. 다시 시도해 주세요.")
        return
      }
      const j = await r.json()
      if (r.status === 401) setToken(null)
      setNeedLogin(!!j.login && !token)
      if (!r.ok) setError(j.error ?? "분석하지 못했어요.")
      else finish(j as Result)
    } catch {
      setError("인터넷 연결을 확인하고 다시 시도해 주세요.")
    } finally {
      setBusy(false)
      setLive([])
    }
  }

  // 정비소에 보여줄 리스트 (공임나라 가능 항목을 담음)
  const [list, setList] = useState<ShopItem[]>([])
  useEffect(() => {
    if (result && carId) setList(loadShopList(carId))
  }, [result, carId])
  const itemOf = (it: Item): ShopItem => (it.ours ? { slug: it.ours.slug, name: it.ours.name, bought: it.ours.shop?.name } : { name: it.name })
  const toggleList = (it: Item) => {
    if (!carId) return
    const s = itemOf(it)
    const next = hasItem(list, s) ? removeItem(list, s) : addItem(list, s)
    setList(next)
    saveShopList(carId, next)
  }

  const gongim = result?.items.filter((i) => i.verdict === "gongim") ?? []
  const saving = gongim.reduce((s, i) => (i.ours ? s + Math.max(0, i.ours.dealer - i.ours.self) : s), 0)

  return (
    <div>
      {!result && (
        <>
          {fromMy && car ? (
          <MyCarLine name={car.name} detail={[year && `${year}년형`, engine || car.engines[0]].filter(Boolean).join(" · ")} onChange={() => setFromMy(false)} />
          ) : (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[15px] font-bold">내 차</p>
            <div className="mt-2 grid grid-cols-[0.8fr_1.2fr] gap-2">
              <label className="sr-only" htmlFor="qt-brand">브랜드</label>
              <select id="qt-brand" className={FIELD} value={brand} onChange={(e) => { setBrand(e.target.value); setCarId(""); setYear(""); setEngine("") }}>
                <option value="">브랜드</option>
                {brands.map((b) => <option key={b}>{b}</option>)}
              </select>
              <label className="sr-only" htmlFor="qt-car">차종</label>
              <select id="qt-car" className={FIELD} value={carId} disabled={!brand} onChange={(e) => { setCarId(e.target.value); setYear(""); setEngine("") }}>
                <option value="">차종</option>
                {cars.filter((c) => c.brand === brand).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            {car && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select aria-label="연식" className={FIELD} value={year} onChange={(e) => setYear(e.target.value)}>
                  <option value="">연식 (선택)</option>
                  {car.years.map((y) => <option key={y} value={y}>{y}년형</option>)}
                </select>
                <select aria-label="엔진" className={FIELD} value={engine} onChange={(e) => setEngine(e.target.value)} disabled={car.engines.length < 2}>
                  <option value="">{car.engines.length < 2 ? car.engines[0] ?? "엔진" : "엔진 (선택)"}</option>
                  {car.engines.length > 1 && car.engines.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
            )}
          </div>
          )}

          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-1.5 text-[15px] font-bold">
              견적서 사진
              <InfoTip label="찍는 방법과 이용 안내" align="left">
                로그인 없이 하루 1번, 로그인하면 하루 3번 쓸 수 있어요. 사진은 저장하지 않고, 이름·전화번호·차량번호는 결과에 남기지 않아요. AI 결과는 참고용이에요.
              </InfoTip>
            </p>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            {busy && preview ? (
              <Analyzing preview={preview} sec={elapsed} items={live} />
            ) : (
            <>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="올린 견적서" className="mt-3 max-h-[320px] w-full rounded-[10px] bg-muted object-contain" />
            ) : (
              <PhotoExamples />
            )}
            <button onClick={() => fileRef.current?.click()} className="mt-3 h-12 w-full rounded-[10px] border border-dashed border-input text-[15px] font-semibold">
              {preview ? "다른 사진 고르기" : "사진 찍기 / 고르기"}
            </button>
            <button
              onClick={analyze}
              disabled={!car || !preview || busy || token === undefined}
              className="mt-2 h-12 w-full rounded-[10px] bg-primary text-[16px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:bg-[#9BB8AD]"
            >
              {busy ? "분석 중…" : !car ? "차종을 먼저 골라 주세요" : !preview ? "사진을 먼저 올려 주세요" : "공임나라로 아낄 수 있는 것 찾기"}
            </button>
            </>
            )}
            {error && <p role="alert" className="mt-3 rounded-[10px] bg-[#FEF3F2] px-3.5 py-2.5 text-[14px] text-[#B42318]">{error}</p>}
            {needLogin && token === null && (
              <div className="mt-3 rounded-[12px] bg-muted p-3.5">
                <p className="text-[14px] font-semibold">로그인하고 이어서 분석하기</p>
                <div className="mt-2.5"><LoginButtons providers={providers} next="/quote" /></div>
              </div>
            )}
          </div>
        </>
      )}

      {result && (
        <section aria-live="polite">
          <div className="rounded-2xl bg-[#14213D] p-4 text-white">
            <p className="text-[13px] text-white/60">{result.shop || "정비소"} · {car?.name}</p>
            <p className="mt-1 text-[18px] font-extrabold leading-snug">
              {gongim.length > 0 ? `공임나라로 돌릴 만한 항목 ${gongim.length}개` : "공임나라로 돌릴 항목은 없어 보여요"}
            </p>
            {saving > 0 && <p className="num mt-1 text-[14px] text-[#75E0A7]">정비핵 데이터 기준 약 {won(saving)} 아낄 수 있어요 (공식센터 추정 대비)</p>}
            <p className="mt-2 text-[13px] leading-relaxed text-white/80">{result.summary}</p>
          </div>

          <ul className="mt-3 space-y-2">
            {result.items.map((it, i) => {
              const v = VERDICT[it.verdict] ?? VERDICT.ask
              return (
                <li key={i} className="rounded-[14px] border border-border bg-card p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold leading-snug">{it.name}</span>
                      <span className="num block text-[12px] text-muted-foreground">
                        {KIND[it.kind]}
                        {it.parts_price ? ` · 부품 ${won(it.parts_price)}` : ""}
                        {it.labor_price ? ` · 공임 ${won(it.labor_price)}` : ""}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${v.cls}`}>{v.label}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{it.reason}</p>
                  {it.verdict === "gongim" && (
                    <button
                      onClick={() => toggleList(it)}
                      aria-pressed={hasItem(list, itemOf(it))}
                      className={`mt-2 min-h-[36px] rounded-full border px-3 text-[13px] font-semibold ${hasItem(list, itemOf(it)) ? "border-primary bg-primary text-primary-foreground" : "border-primary/40 text-primary"}`}
                    >
                      {hasItem(list, itemOf(it)) ? "✓ 정비소 리스트에 담음" : "+ 정비소에 보여줄 리스트에 담기"}
                    </button>
                  )}
                  {it.verdict === "gongim" && !it.ours && car && quoteSearchWord(it.name).length >= 2 && (
                    openShop.includes(i) ? (
                      <div className="mt-2">
                        <LiveCoupang carId={car.id} q={quoteSearchWord(it.name)} partId={`quote-${quoteSearchWord(it.name)}`} emptyText={`쿠팡에서 맞는 '${quoteSearchWord(it.name)}' 상품을 못 찾았어요. 차종 전용 부품이라 공임나라에 부품 구해 주는지 같이 물어보세요.`} />
                      </div>
                    ) : (
                      <button onClick={() => setOpenShop((o) => [...o, i])} className="ml-2 mt-2 min-h-[36px] rounded-full border border-border px-3 text-[13px] font-semibold">
                        쿠팡 부품값 보기
                      </button>
                    )
                  )}
                  {it.verdict === "gongim" && it.ours && car && (
                    <div className="mt-2 rounded-[10px] bg-muted px-3 py-2.5">
                      <p className="num text-[13px]">
                        공식센터(추정) <span className="price-was">{won(it.ours.dealer)}</span> → 직접 구매+공임나라 <b className="text-primary">{won(it.ours.self)}</b>
                      </p>
                      {it.ours.shop ? (
                        <OutboundLink href={it.ours.shop.url} target="coupang" carId={car.id} partId={it.ours.slug} sponsored className="mt-2 flex items-center gap-3 rounded-[8px] bg-card p-2">
                          {it.ours.shop.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.ours.shop.image} alt="" width={44} height={44} loading="lazy" className="h-11 w-11 shrink-0 rounded-md bg-white object-contain ring-1 ring-border" />
                          )}
                          <span className="line-clamp-2 min-w-0 flex-1 text-[12px] leading-snug">{it.ours.shop.name}</span>
                          <span className="num shrink-0 text-[14px] font-bold text-primary">{won(it.ours.shop.price)}</span>
                        </OutboundLink>
                      ) : (
                        <Link href={`/cars/${car.id}/${it.ours.slug}`} className="mt-1.5 inline-flex min-h-[36px] items-center text-[13px] font-semibold text-primary">
                          규격·쿠팡 가격 보기 ›
                        </Link>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {result.items.some((i) => i.ours?.shop) && <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{AFFILIATE_TEXT}</p>}

          {list.length > 0 && car && (
            <Link href={`/shop-card?car=${car.id}`} className="mt-4 flex h-14 items-center justify-center rounded-[12px] bg-primary text-[16px] font-bold text-primary-foreground">
              정비소에 보여줄 리스트 보기 ({list.length}개)
            </Link>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => { setResult(null); setOpenShop([]) }} className="h-12 rounded-[10px] border border-border bg-card text-[14px] font-semibold">
              다른 견적서
            </button>
            <Link href="/near" className="flex h-12 items-center justify-center rounded-[10px] bg-foreground text-[14px] font-semibold text-background">
              근처 공임나라
            </Link>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
            공임나라가 부품을 받아 주는지·공임은 지점마다 달라요. 가기 전에 전화로 확인하세요.
          </p>
        </section>
      )}
    </div>
  )
}

/** 찍는 법을 글 대신 사진으로: 잘된 예 1장 + 잘못된 예 2장 (가상 견적서로 만든 이미지, 실제 개인정보 없음) */
const EXAMPLES = [
  { src: "/quote-examples/good.webp", ok: true, label: "표 전체가 보이게" },
  { src: "/quote-examples/cut.webp", ok: false, label: "잘림" },
  { src: "/quote-examples/blur.webp", ok: false, label: "흐림" },
]
function PhotoExamples() {
  return (
    <ul className="mt-3 grid grid-cols-3 gap-2" aria-label="견적서 사진 찍는 법">
      {EXAMPLES.map((e) => (
        <li key={e.src} className="text-center">
          <span className={`relative block overflow-hidden rounded-[10px] ring-2 ${e.ok ? "ring-[#12B76A]" : "ring-transparent"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.src} alt={e.ok ? "잘 찍은 견적서 예" : `잘못 찍은 견적서 예: ${e.label}`} width={300} height={400} loading="lazy" className="aspect-[3/4] w-full object-cover" />
            <span aria-hidden className={`absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[14px] font-bold text-white ${e.ok ? "bg-[#12B76A]" : "bg-[#D92D20]"}`}>
              {e.ok ? "✓" : "✕"}
            </span>
          </span>
          <span className={`mt-1 block text-[12px] font-semibold ${e.ok ? "text-[#067647]" : "text-[#B42318]"}`}>{e.label}</span>
        </li>
      ))}
    </ul>
  )
}

/** 분석 중 화면: 올린 사진 위에 스캔 효과 + 큰 게이지 + 찾은 항목이 하나씩 나타남.
 *  게이지는 경과 시간(Haiku 보통 10초 안팎, 2026-11-27 운영 측정 9.4초)과 실제로 받은 항목 수 중 큰 쪽 */
const EXPECT = 12
function stepText(sec: number, found: number) {
  if (found > 0) return `항목 ${found}개 찾았어요 · 계속 읽는 중`
  if (sec < 2) return "사진 보내는 중"
  if (sec < 5) return "견적서 글자 읽는 중"
  return "항목을 하나씩 나누는 중"
}
function Analyzing({ preview, sec, items }: { preview: string; sec: number; items: Item[] }) {
  const timePct = sec <= EXPECT ? (sec / EXPECT) * 80 : 80 + (sec - EXPECT) / 2
  const pct = Math.round(Math.min(95, Math.max(timePct, items.length ? 35 + items.length * 9 : 0)))
  return (
    <div className="mt-3" aria-live="polite" aria-busy="true">
      <div className="relative overflow-hidden rounded-[12px] bg-[#14213D]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="" className="max-h-[220px] w-full object-contain opacity-45" />
        <div aria-hidden className="mh-scan absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-[#75E0A7]/35 to-transparent motion-reduce:hidden" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <span className="num text-[44px] font-extrabold leading-none">{pct}%</span>
          <span className="mt-2 text-[14px] font-semibold">{stepText(sec, items.length)}</span>
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
      </div>
      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {items.map((it, i) => {
            const v = VERDICT[it.verdict] ?? VERDICT.ask
            return (
              <li key={i} className="mh-pop flex items-center justify-between gap-2 rounded-[10px] border border-border bg-background px-3 py-2">
                <span className="min-w-0 truncate text-[14px] font-semibold">{it.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${v.cls}`}>{v.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { loadMyCar, type MyCar } from "@/lib/my-car"
import { MyCarLine } from "@/components/my/MyCarLine"
import { InfoTip } from "@/components/ui/InfoTip"
import { addItem, hasItem, loadShopList, phoneScript, removeItem, saveShopList, type ShopItem } from "@/lib/shop-list"

export interface ShopCardPart {
  slug: string
  name: string
  spec: string
  partNumber?: string
  engine?: string
  /** 정비핵이 골라 둔 쿠팡 상품 이름 (있으면 '산 상품' 기본값) */
  pick?: string
  /** 현대모비스 부품 간단 검색에 넣을 단어 (현대·기아·제네시스만) */
  mobis?: string
}

export interface ShopCardCar {
  id: string
  brand: string
  label: string
  name: string
  engines: string[]
  parts: ShopCardPart[]
}

const FIELD =
  "h-12 w-full rounded-[10px] border border-input bg-card px-3.5 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted"

export function ShopCardPage({ cars }: { cars: ShopCardCar[] }) {
  const brands = useMemo(() => Array.from(new Set(cars.map((c) => c.brand))), [cars])
  const [brand, setBrand] = useState("")
  const [carId, setCarId] = useState("")
  const [my, setMy] = useState<MyCar | null>(null)
  const [items, setItems] = useState<ShopItem[]>([])
  const [free, setFree] = useState("")
  const [showing, setShowing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pickEngine, setPickEngine] = useState("")

  // 차: 주소의 ?car= → 등록한 내 차 → 직접 고르기
  useEffect(() => {
    const m = loadMyCar()
    setMy(m)
    const q = new URLSearchParams(location.search).get("car")
    const id = (q && cars.some((c) => c.id === q) ? q : null) ?? (m && cars.some((c) => c.id === m.car.id) ? m.car.id : "")
    if (id) {
      setCarId(id)
      setBrand(cars.find((c) => c.id === id)!.brand)
    }
  }, [cars])

  useEffect(() => {
    setItems(carId ? loadShopList(carId) : [])
  }, [carId])

  const car = cars.find((c) => c.id === carId)
  const mine = my && car && my.car.id === car.id ? my : null
  const engine = mine?.engine ?? (car && car.engines.length === 1 ? car.engines[0] : pickEngine || undefined)
  const parts = car ? car.parts.filter((p) => !p.engine || !engine || p.engine === engine) : []
  const partOf = (it: ShopItem) => (it.slug ? car?.parts.find((p) => p.slug === it.slug) : undefined)
  const carLine = car ? [car.name, mine?.year ? `${mine.year}년형` : "", engine ?? ""].filter(Boolean).join(" ") : ""

  const update = (next: ShopItem[]) => {
    setItems(next)
    if (car) saveShopList(car.id, next)
  }
  const toggle = (p: ShopCardPart) => {
    const it: ShopItem = { slug: p.slug, name: p.name }
    update(hasItem(items, it) ? removeItem(items, it) : addItem(items, it))
  }
  const addFree = () => {
    const n = free.trim()
    if (!n) return
    update(addItem(items, { name: n }))
    setFree("")
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phoneScript(carLine, items))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* 복사가 막히면 화면의 문장을 직접 보면 됨 */
    }
  }

  // 보여주기 화면에서 뒤로가기로 닫히게
  useEffect(() => {
    if (!showing) return
    history.pushState({ shopCard: 1 }, "")
    const back = () => setShowing(false)
    window.addEventListener("popstate", back)
    return () => window.removeEventListener("popstate", back)
  }, [showing])

  return (
    <div>
      {/* 1. 차 */}
      {mine && car ? (
        <MyCarLine
          name={car.name}
          detail={[mine.year ? `${mine.year}년형` : "", engine].filter(Boolean).join(" · ")}
          onChange={() => { setMy(null); setCarId(""); setBrand("") }}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[15px] font-bold">차종</p>
          <div className="mt-2 grid grid-cols-[0.8fr_1.2fr] gap-2">
            <select aria-label="브랜드" className={FIELD} value={brand} onChange={(e) => { setBrand(e.target.value); setCarId("") }}>
              <option value="">브랜드</option>
              {brands.map((b) => <option key={b}>{b}</option>)}
            </select>
            <select aria-label="차종" className={FIELD} value={carId} disabled={!brand} onChange={(e) => { setCarId(e.target.value); setPickEngine("") }}>
              <option value="">차종</option>
              {cars.filter((c) => c.brand === brand).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          {car && car.engines.length > 1 && (
            <select aria-label="엔진" className={`${FIELD} mt-2`} value={pickEngine} onChange={(e) => setPickEngine(e.target.value)}>
              <option value="">엔진 (고르면 맞는 부품만 보여요)</option>
              {car.engines.map((x) => <option key={x}>{x}</option>)}
            </select>
          )}
        </div>
      )}

      {car && (
        <>
          {/* 2. 담을 부품 */}
          <p className="mt-5 flex items-center gap-1.5 text-[15px] font-semibold">
            가져갈 부품
            <InfoTip label="정비소 리스트 안내" align="left">부품을 가져가면 받아 주는지, 공임이 얼마인지는 지점마다 달라요. 가기 전에 전화로 물어보세요. 견적서 분석 결과에서도 담을 수 있고, 이 목록은 이 폰에만 저장돼요.</InfoTip>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {parts.map((p) => {
              const on = hasItem(items, { slug: p.slug, name: p.name })
              return (
                <button
                  key={p.slug}
                  onClick={() => toggle(p)}
                  aria-pressed={on}
                  className={`min-h-[40px] rounded-full border px-3.5 text-[14px] font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
                >
                  {on ? "✓ " : ""}
                  {p.name}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex gap-2">
            <label htmlFor="sc-free" className="sr-only">다른 부품 직접 적기</label>
            <input
              id="sc-free"
              className={FIELD}
              value={free}
              maxLength={40}
              placeholder="다른 부품 직접 적기 (예: 하부암)"
              onChange={(e) => setFree(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFree()}
            />
            <button onClick={addFree} disabled={!free.trim()} className="h-12 shrink-0 rounded-[10px] bg-foreground px-4 text-[14px] font-semibold text-background disabled:opacity-40">
              담기
            </button>
          </div>

          {/* 3. 담은 목록 */}
          {items.length > 0 ? (
            <>
              <p className="mt-5 text-[15px] font-semibold">담은 부품 {items.length}개</p>
              <ul className="mt-2 divide-y divide-border rounded-[14px] border border-border bg-card">
                {items.map((it) => {
                  return (
                    <li key={it.slug ?? it.name} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="min-w-0 truncate text-[15px] font-semibold">{it.name}</span>
                      <button onClick={() => update(removeItem(items, it))} className="min-h-[36px] shrink-0 px-1 text-[13px] text-muted-foreground" aria-label={`${it.name} 빼기`}>
                        빼기
                      </button>
                    </li>
                  )
                })}
              </ul>

              <button onClick={() => setShowing(true)} className="mt-4 h-14 w-full rounded-[12px] bg-primary text-[17px] font-bold text-primary-foreground">
                정비소에 보여주기
              </button>

              {/* 4. 전화로 먼저 */}
              <div className="mt-4 rounded-2xl bg-muted p-4">
                <p className="text-[14px] font-bold">전화로 먼저 물어보기</p>
                <p className="mt-1.5 text-[14px] leading-relaxed">{phoneScript(carLine, items)}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={copy} className="h-11 rounded-[10px] border border-border bg-card text-[14px] font-semibold">
                    {copied ? "복사했어요" : "문장 복사"}
                  </button>
                  <Link href="/near" className="flex h-11 items-center justify-center rounded-[10px] bg-foreground text-[14px] font-semibold text-background">
                    근처 공임나라
                  </Link>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}

      {/* 정비소에 보여줄 큰 화면 */}
      {showing && car && (
        <div role="dialog" aria-modal="true" aria-label="정비소에 보여줄 부품 목록" className="fixed inset-0 z-[60] overflow-y-auto bg-white text-[#101828]">
          <div className="mx-auto max-w-2xl px-5 pb-10 pt-5">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-semibold text-[#475467]">부품 교체 요청</p>
              <button onClick={() => history.back()} className="min-h-[44px] px-2 text-[15px] font-semibold text-[#475467]">
                닫기
              </button>
            </div>
            <p className="mt-2 text-[28px] font-extrabold leading-tight">{car.name}</p>
            <p className="num mt-1 text-[18px] font-semibold text-[#344054]">
              {[mine?.year ? `${mine.year}년형` : "", engine, mine?.km ? `${mine.km.toLocaleString("ko-KR")}km` : ""].filter(Boolean).join(" · ")}
            </p>

            <ol className="mt-5 space-y-3">
              {items.map((it, i) => {
                const p = partOf(it)
                return (
                  <li key={it.slug ?? it.name} className="rounded-[14px] border-2 border-[#101828] p-4">
                    <p className="text-[22px] font-extrabold leading-snug">
                      {i + 1}. {it.name}
                    </p>
                    {p && <p className="mt-1 text-[17px] leading-snug">{p.spec}</p>}
                    {p?.partNumber && <p className="num mt-1 text-[17px] font-bold">순정 품번 {p.partNumber}</p>}
                    {it.bought && <p className="mt-1.5 text-[15px] leading-snug text-[#475467]">가져온 부품: {it.bought}</p>}
                  </li>
                )
              })}
            </ol>

            <p className="mt-6 text-[22px] font-extrabold leading-snug">부품은 제가 준비해 왔어요.<br />교체 작업만 부탁드려요.</p>
            <p className="mt-6 text-[12px] text-[#667085]">정비핵 jungbihack.com · 규격은 제조사 자료 기준, 차대번호로 한 번 더 확인해 주세요</p>
          </div>
        </div>
      )}
    </div>
  )
}

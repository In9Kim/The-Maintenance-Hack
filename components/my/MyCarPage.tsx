"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { dueList, loadMyCar, saveMyCar, today, type DueState, type MyCar, type MyCarSnapshot } from "@/lib/my-car"
import { track } from "@/lib/track"
import { RecentList } from "@/components/recent/Recent"

export interface MyCarOption {
  id: string
  brand: string
  label: string
  name: string
  photo?: string
  credit?: string
  engines: string[]
  parts: { slug: string; name: string; engine?: string; intervalKm?: number; intervalMonths?: number }[]
}

const FIELD =
  "h-12 w-full rounded-[10px] border border-input bg-card px-3.5 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted"

const STATE_STYLE: Record<DueState, { label: string; cls: string }> = {
  over: { label: "교체 시기 지남", cls: "bg-[#FEF3F2] text-[#B42318]" },
  soon: { label: "곧 교체", cls: "bg-[#FFF6ED] text-[#B54708]" },
  ok: { label: "여유 있음", cls: "bg-[#ECFDF3] text-[#067647]" },
  unknown: { label: "기록 필요", cls: "bg-muted text-muted-foreground" },
}

function snapshot(o: MyCarOption, engine?: string): MyCarSnapshot {
  return {
    id: o.id,
    name: o.name,
    photo: o.photo,
    credit: o.credit,
    parts: o.parts
      .filter((p) => !p.engine || !engine || p.engine === engine)
      .map(({ slug, name, intervalKm, intervalMonths }) => ({ slug, name, intervalKm, intervalMonths })),
  }
}

const num = (s: string) => {
  const n = Number(s.replace(/[^0-9]/g, ""))
  return Number.isFinite(n) ? n : 0
}

export function MyCarPage({ options }: { options: MyCarOption[] }) {
  const [ready, setReady] = useState(false)
  const [my, setMy] = useState<MyCar | null>(null)

  useEffect(() => {
    const v = loadMyCar()
    // 저장된 차 정보는 최신 데이터(교체 주기)로 갈아 끼운다
    if (v) {
      const o = options.find((x) => x.id === v.car.id)
      if (o) v.car = snapshot(o, v.engine)
    }
    setMy(v)
    setReady(true)
  }, [options])

  const update = (v: MyCar | null) => {
    setMy(v)
    saveMyCar(v)
  }

  if (!ready) return <div className="mx-auto max-w-2xl px-5 py-10"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>

  return (
    <div className="mx-auto max-w-2xl px-5 pb-6 pt-6 sm:pt-10">
      {my ? <Garage my={my} update={update} /> : <Register options={options} onSave={update} />}
      <RecentList className="mt-8" />
    </div>
  )
}

function Register({ options, onSave }: { options: MyCarOption[]; onSave: (v: MyCar) => void }) {
  const brands = useMemo(() => Array.from(new Set(options.map((o) => o.brand))), [options])
  const [brand, setBrand] = useState("")
  const [carId, setCarId] = useState("")
  const [engine, setEngine] = useState("")
  const [km, setKm] = useState("")
  const car = options.find((o) => o.id === carId)
  const needEngine = !!car && car.engines.length > 1
  const ok = !!car && (!needEngine || !!engine) && num(km) > 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!car || !ok) return
    track({ type: "nav", carId: car.id, meta: { via: "my_register" } })
    onSave({ car: snapshot(car, engine || undefined), engine: engine || undefined, km: num(km), kmDate: today(), records: {} })
  }

  return (
    <>
      <h1 className="text-[28px] font-extrabold leading-[1.3] sm:text-[34px]">내 차 등록</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
        차종과 주행거리를 적어 두면 소모품 교체 시기를 계산해 드려요. 가입은 필요 없고, 이 휴대폰(브라우저)에만 저장돼요.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
          <label className="sr-only" htmlFor="my-brand">브랜드</label>
          <select id="my-brand" className={FIELD} value={brand} onChange={(e) => { setBrand(e.target.value); setCarId(""); setEngine("") }}>
            <option value="">브랜드</option>
            {brands.map((b) => <option key={b}>{b}</option>)}
          </select>
          <label className="sr-only" htmlFor="my-car">차종</label>
          <select id="my-car" className={FIELD} value={carId} disabled={!brand} onChange={(e) => { setCarId(e.target.value); setEngine("") }}>
            <option value="">차종</option>
            {options.filter((o) => o.brand === brand).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        {needEngine && (
          <>
            <label className="sr-only" htmlFor="my-engine">엔진</label>
            <select id="my-engine" className={FIELD} value={engine} onChange={(e) => setEngine(e.target.value)}>
              <option value="">엔진 선택 (오일 규격이 달라요)</option>
              {car!.engines.map((x) => <option key={x}>{x}</option>)}
            </select>
          </>
        )}
        <label className="block">
          <span className="text-[14px] font-semibold">지금 주행거리</span>
          <span className="relative mt-1.5 block">
            <input inputMode="numeric" className={FIELD + " pr-12"} placeholder="예: 63,000" value={km ? num(km).toLocaleString("ko-KR") : ""} onChange={(e) => setKm(e.target.value)} />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted-foreground">km</span>
          </span>
          <span className="mt-1 block text-[13px] text-muted-foreground">계기판 ODO 숫자예요. 대충 적어도 괜찮아요.</span>
        </label>
        <button type="submit" disabled={!ok} className="h-12 w-full rounded-[10px] bg-primary text-[16px] font-bold text-primary-foreground transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:bg-[#9BB8AD]">
          내 차 등록하기
        </button>
      </form>
      <ul className="mt-6 space-y-2 text-[14px] leading-relaxed text-muted-foreground">
        <li>· 마지막으로 교체한 날짜를 넣으면 &ldquo;교체 시기 지남·곧 교체&rdquo;를 알려 드려요.</li>
        <li>· 서버에 아무것도 보내지 않아요. 휴대폰을 바꾸거나 방문 기록을 지우면 사라져요.</li>
      </ul>
    </>
  )
}

function Garage({ my, update }: { my: MyCar; update: (v: MyCar | null) => void }) {
  const [editKm, setEditKm] = useState(false)
  const [km, setKm] = useState(String(my.km))
  const [editing, setEditing] = useState<string | null>(null)
  const list = dueList(my)
  const urgent = list.filter((d) => d.state === "over" || d.state === "soon").length
  const unknown = list.filter((d) => d.state === "unknown").length

  const saveKm = () => {
    if (num(km) > 0) update({ ...my, km: num(km), kmDate: today() })
    setEditKm(false)
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl bg-[#14213D] text-white">
        <div className="flex items-center gap-4 p-5">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-white/60">내 차</p>
            <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight sm:text-[26px]">{my.car.name}</h1>
            {my.engine && <p className="mt-1 text-[13px] text-white/70">{my.engine}</p>}
          </div>
          {my.car.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={my.car.photo} alt="" width={160} height={100} className="h-[84px] w-[134px] shrink-0 rounded-lg object-cover" />
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-5 py-3.5">
          <span className="text-[14px] text-white/70">주행거리 <span className="text-[12px]">({my.kmDate.slice(5).replace("-", "/")} 기준)</span></span>
          {editKm ? (
            <span className="flex items-center gap-2">
              <input autoFocus inputMode="numeric" className="h-10 w-32 rounded-lg bg-white px-2.5 text-right text-[16px] text-foreground outline-none" value={num(km).toLocaleString("ko-KR")} onChange={(e) => setKm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveKm()} />
              <button onClick={saveKm} className="h-10 rounded-lg bg-primary px-3 text-[14px] font-bold">저장</button>
            </span>
          ) : (
            <button onClick={() => setEditKm(true)} className="num flex min-h-[44px] items-center gap-1.5 text-[22px] font-bold">
              {my.km.toLocaleString("ko-KR")}<span className="text-[14px] font-normal text-white/70">km</span>
              <span className="ml-1 rounded-md bg-white/10 px-2 py-0.5 text-[12px] font-semibold">고치기</span>
            </button>
          )}
        </div>
      </section>
      {my.car.credit && <p className="mt-1.5 text-right text-[11px] text-muted-foreground">{my.car.credit}</p>}

      <p className="mt-6 text-[15px] font-semibold">
        {urgent > 0 ? `지금 챙길 소모품이 ${urgent}개 있어요` : unknown === list.length ? "마지막으로 교체한 날짜를 넣어 주세요" : unknown > 0 ? "기록한 소모품 중엔 당장 교체할 게 없어요" : "당장 교체할 소모품은 없어요"}
      </p>
      {unknown > 0 && <p className="mt-1 text-[13px] text-muted-foreground">기억 안 나면 &ldquo;오늘 교체&rdquo;를 눌러 두고, 다음부터 정확히 관리해도 돼요.</p>}

      <ul className="mt-3 space-y-2.5">
        {list.map((d) => {
          const st = STATE_STYLE[d.state]
          return (
            <li key={d.part.slug} className="rounded-[14px] border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/cars/${my.car.id}/${d.part.slug}`} className="font-bold hover:underline">{d.part.name}</Link>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {d.record ? `마지막 교체 ${d.record.date.replace(/-/g, ".")}${d.record.km != null ? ` · ${d.record.km.toLocaleString("ko-KR")}km` : ""}` : d.text}
                  </p>
                </div>
                <span className="shrink-0 text-right">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold ${st.cls}`}>{st.label}</span>
                  {d.record && <span className="num mt-1 block text-[13px] font-semibold">{d.text}</span>}
                </span>
              </div>
              {editing === d.part.slug ? (
                <RecordForm
                  initial={d.record ?? { date: today(), km: my.km }}
                  onCancel={() => setEditing(null)}
                  onSave={(r) => {
                    update({ ...my, records: { ...my.records, [d.part.slug]: r } })
                    setEditing(null)
                  }}
                />
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => update({ ...my, records: { ...my.records, [d.part.slug]: { date: today(), km: my.km } } })}
                    className="min-h-[40px] rounded-lg bg-foreground px-3 text-[13px] font-semibold text-background"
                  >
                    오늘 교체했어요
                  </button>
                  <button onClick={() => setEditing(d.part.slug)} className="min-h-[40px] rounded-lg border border-border px-3 text-[13px] font-semibold">
                    날짜 직접 입력
                  </button>
                  {(d.state === "over" || d.state === "soon") && (
                    <Link href={`/cars/${my.car.id}/${d.part.slug}`} className="flex min-h-[40px] items-center rounded-lg px-2 text-[13px] font-semibold text-primary">
                      가격·규격 보기
                    </Link>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Link href={`/cars/${my.car.id}`} className="flex min-h-[48px] items-center justify-center rounded-[12px] border border-border bg-card text-[14px] font-semibold">내 차 소모품 가격 전체</Link>
        <Link href="/near" className="flex min-h-[48px] items-center justify-center rounded-[12px] bg-foreground text-[14px] font-semibold text-background">근처 공임나라 찾기</Link>
      </div>
      <p className="mt-6 text-center text-[13px] text-muted-foreground">
        이 휴대폰에만 저장돼요.{" "}
        <button
          onClick={() => confirm("등록한 차와 교체 기록을 지울까요?") && update(null)}
          className="font-semibold underline underline-offset-4"
        >
          다른 차로 바꾸기
        </button>
      </p>
    </>
  )
}

function RecordForm({ initial, onSave, onCancel }: { initial: { date: string; km?: number }; onSave: (r: { date: string; km?: number }) => void; onCancel: () => void }) {
  const [date, setDate] = useState(initial.date)
  const [km, setKm] = useState(initial.km != null ? String(initial.km) : "")
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <label className="text-[12px] font-semibold text-muted-foreground">
        교체한 날
        <input type="date" max={today()} className={FIELD + " mt-1 h-11 text-[15px]"} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="text-[12px] font-semibold text-muted-foreground">
        그때 주행거리 (모르면 비워 두기)
        <input inputMode="numeric" className={FIELD + " mt-1 h-11 text-[15px]"} placeholder="km" value={km ? num(km).toLocaleString("ko-KR") : ""} onChange={(e) => setKm(e.target.value)} />
      </label>
      <button onClick={() => date && onSave({ date, km: km ? num(km) : undefined })} className="h-11 rounded-lg bg-primary text-[14px] font-bold text-primary-foreground">저장</button>
      <button onClick={onCancel} className="h-11 rounded-lg border border-border text-[14px] font-semibold">취소</button>
    </div>
  )
}

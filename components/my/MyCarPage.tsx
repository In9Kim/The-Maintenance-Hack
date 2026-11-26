"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  dueList,
  loadGarage,
  newCarId,
  removeCar,
  saveGarage,
  today,
  upsertCar,
  type DueState,
  type Garage as GarageData,
  type MyCar,
  type MyCarSnapshot,
} from "@/lib/my-car"
import { authEnabled, enabledProviders, supabase, type Provider } from "@/lib/supabase"
import { deleteCloudCar, fetchCars, fromRow, mergeGarage, pushCars } from "@/lib/cloud-garage"
import { track } from "@/lib/track"
import { OutboundLink } from "@/components/seo/OutboundLink"
import { AFFILIATE_TEXT } from "@/lib/affiliate"

export interface MyCarOption {
  id: string
  brand: string
  label: string
  name: string
  photo?: string
  credit?: string
  engines: string[]
  years: number[]
  parts: { slug: string; name: string; engine?: string; intervalKm?: number; intervalMonths?: number; spec?: string; self?: number; price?: number; shop?: { price: number; date: string; url: string } }[]
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
      .map(({ slug, name, intervalKm, intervalMonths, spec, self, price, shop }) => ({ slug, name, intervalKm, intervalMonths, spec, self, price, shop })),
  }
}

const num = (s: string) => {
  const n = Number(s.replace(/[^0-9]/g, ""))
  return Number.isFinite(n) ? n : 0
}

interface Account {
  name: string
  provider: string
}

export function MyCarPage({ options }: { options: MyCarOption[] }) {
  const [ready, setReady] = useState(false)
  const [garage, setGarage] = useState<GarageData>({ cars: [], active: "" })
  const [adding, setAdding] = useState<string | null>(null) // 차 추가 화면 (값 = 미리 고른 차종 id, "" = 처음부터)
  const [account, setAccount] = useState<Account | null>(null)
  const [cloudError, setCloudError] = useState("")
  const accountRef = useRef<Account | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [guest, setGuest] = useState(false) // '로그인 없이 이 폰에만' 을 고름
  useEffect(() => {
    if (authEnabled()) enabledProviders().then(setProviders)
  }, [])

  const rebuild = useCallback(
    (carId: string, engine?: string) => {
      const o = options.find((x) => x.id === carId)
      return o ? snapshot(o, engine) : null
    },
    [options],
  )

  const apply = useCallback((g: GarageData) => {
    setGarage(g)
    saveGarage(g)
  }, [])

  // 처음: 이 기기 차고 읽기 (부품 정보는 최신 데이터로 갈아 끼움) + ?add=차종id
  useEffect(() => {
    const g = loadGarage()
    g.cars = g.cars.map((c) => {
      const car = rebuild(c.car.id, c.engine)
      return car ? { ...c, car } : c
    })
    setGarage(g)
    if (g.cars.length) saveGarage(g) // 최신 부품·쿠팡 가격을 저장해 두면 첫 화면 '내 차'도 같은 값을 씀
    const add = new URLSearchParams(window.location.search).get("add")
    if (add && options.some((o) => o.id === add)) setAdding(add)
    setReady(true)
  }, [options, rebuild])

  // 로그인 상태 따라가기. 로그인하면 이 기기의 차를 계정에 올리고 계정의 차 목록으로 맞춘다
  useEffect(() => {
    if (!authEnabled()) return
    let off = () => {}
    let alive = true
    supabase().then((sb) => {
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        if (!alive) return
        const u = session?.user
        const acc = u
          ? { name: (u.user_metadata?.name as string) || (u.user_metadata?.full_name as string) || u.email || "회원", provider: u.app_metadata?.provider ?? "" }
          : null
        const was = accountRef.current
        accountRef.current = acc
        setAccount(acc)
        if (acc && (event === "SIGNED_IN" || event === "INITIAL_SESSION") && !was) {
          // 콜백 처리 뒤 주소의 ?code= 정리
          if (window.location.search.includes("code=")) window.history.replaceState(null, "", "/my")
          setTimeout(async () => {
            try {
              const rows = await fetchCars()
              const remote = rows.map((r) => fromRow(r, rebuild)).filter((c): c is MyCar => !!c)
              const { garage: merged, upload } = mergeGarage(loadGarage(), remote)
              await pushCars(upload)
              apply(merged)
              setCloudError("")
            } catch {
              setCloudError("계정에서 차 목록을 못 불러왔어요. 잠시 뒤 다시 열어 주세요.")
            }
          }, 0)
        }
      })
      off = () => data.subscription.unsubscribe()
    })
    return () => {
      alive = false
      off()
    }
  }, [rebuild, apply])

  const cloud = (p: Promise<unknown>) =>
    p.then(
      () => setCloudError(""),
      () => setCloudError("계정에 저장하지 못했어요. 인터넷 연결을 확인해 주세요."),
    )

  const saveCar = (c: MyCar) => {
    apply(upsertCar(garage, c))
    if (accountRef.current) cloud(pushCars([c]))
  }
  const deleteCar = (id: string) => {
    apply(removeCar(garage, id))
    if (accountRef.current) cloud(deleteCloudCar(id))
  }

  if (!ready) return <div className="mx-auto max-w-2xl px-5 py-10"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>

  const active = garage.cars.find((c) => c.id === garage.active)
  const showRegister = adding !== null || !active
  // 처음 온 사람(차 없음·비로그인): 로그인을 먼저 보여 주고, 등록 양식은 '로그인 없이' 쓰는 길로
  const loginFirst = !account && garage.cars.length === 0 && providers.length > 0 && !guest && adding === null

  return (
    <div className="mx-auto max-w-2xl px-5 pb-6 pt-6 sm:pt-10">
      {garage.cars.length > 0 && (
        <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1" role="tablist" aria-label="내 차 목록">
          {garage.cars.map((c) => {
            const on = adding === null && c.id === garage.active
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setAdding(null)
                  apply({ ...garage, active: c.id! })
                }}
                className={`h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold ${on ? "bg-foreground text-background" : "border border-border bg-card"}`}
              >
                {c.car.name}
              </button>
            )
          })}
          <button
            onClick={() => setAdding("")}
            aria-selected={adding !== null}
            role="tab"
            className={`h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold ${adding !== null ? "bg-foreground text-background" : "border border-dashed border-border text-muted-foreground"}`}
          >
            + 차 추가
          </button>
        </div>
      )}

      {showRegister ? (
        <>
        {loginFirst ? (
          <>
            <h1 className="text-[28px] font-extrabold leading-[1.3] sm:text-[34px]">내 차 등록</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">차종과 연식만 고르면 맞는 부품과 가격을 보여 드려요</p>
            <div className="mt-6"><LoginButtons providers={providers} /></div>
            <p className="mt-2 text-[13px] text-muted-foreground">로그인하면 차 여러 대를 저장하고, 폰을 바꿔도 그대로예요</p>
            <button
              onClick={() => setGuest(true)}
              className="mt-6 flex h-12 w-full items-center justify-center rounded-[10px] border border-border bg-card text-[15px] font-semibold"
            >
              로그인 없이 이 폰에만 저장
            </button>
          </>
        ) : (
        <Register
          key={adding ?? "first"}
          options={options}
          initialCarId={adding || ""}
          first={garage.cars.length === 0}
          onCancel={garage.cars.length ? () => setAdding(null) : guest ? () => setGuest(false) : undefined}
          onSave={(c) => {
            saveCar(c)
            setAdding(null)
            if (window.location.search) window.history.replaceState(null, "", "/my")
          }}
        />
        )}
        </>
      ) : (
        <Garage key={active!.id} my={active!} loggedIn={!!account} update={saveCar} remove={() => deleteCar(active!.id!)} />
      )}

      {cloudError && <p role="alert" className="mt-4 rounded-[10px] bg-[#FEF3F2] px-4 py-3 text-[14px] text-[#B42318]">{cloudError}</p>}

      {authEnabled() && !loginFirst && !(guest && !account && garage.cars.length === 0) && (
        <AccountBox
          providers={providers}
          account={account}
          onSignedOut={() => {
            accountRef.current = null
            setAccount(null)
            apply({ cars: [], active: "" }) // 계정의 차는 이 폰에서 지움 (다시 로그인하면 돌아옴)
          }}
        />
      )}

      <nav aria-label="마이 메뉴" className="mt-4 divide-y divide-border rounded-[14px] border border-border bg-card">
        {[
          { href: "/quote", label: "견적서 사진으로 아낄 항목 찾기 (AI)" },
          { href: "/check", label: "이 부품 내 차에 맞을까? (AI 확인)" },
          { href: "/recalls", label: "자동차 리콜 정보" },
          { href: "/info", label: "데이터 출처·이용 안내" },
          { href: "/privacy", label: "개인정보 처리방침" },
        ].map((m) => (
          <Link key={m.href} href={m.href} className="flex min-h-[52px] items-center justify-between px-4 text-[15px]">
            {m.label}
            <span aria-hidden className="text-muted-foreground">›</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}

function LoginButtons({ providers }: { providers: Provider[] }) {
  const [busy, setBusy] = useState(false)
  const signIn = async (provider: Provider) => {
    setBusy(true)
    track({ type: "nav", meta: { via: `login_${provider}` } })
    const sb = await supabase()
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/my` } })
    if (error) {
      setBusy(false)
      alert("로그인을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.")
    }
  }
  return (
    <div className="grid gap-2">
        {providers.includes("kakao") && <button
          onClick={() => signIn("kakao")}
          disabled={busy}
          className="flex h-12 items-center justify-center gap-2 rounded-[10px] bg-[#FEE500] text-[15px] font-semibold text-black/85 disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="currentColor" d="M12 3.5C6.75 3.5 2.5 6.86 2.5 11c0 2.65 1.75 4.98 4.38 6.31l-.9 3.3c-.08.3.26.54.52.37l3.93-2.6c.51.06 1.03.1 1.57.1 5.25 0 9.5-3.36 9.5-7.48S17.25 3.5 12 3.5z" /></svg>
          카카오로 시작하기
        </button>}
        {providers.includes("google") && <button
          onClick={() => signIn("google")}
          disabled={busy}
          className="flex h-12 items-center justify-center gap-2 rounded-[10px] border border-border bg-white text-[15px] font-semibold text-black/85 disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <path fill="#4285F4" d="M22.5 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.9a5.05 5.05 0 0 1-2.19 3.31v2.75h3.54c2.07-1.9 3.25-4.71 3.25-8.07z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.54-2.75c-.99.66-2.25 1.05-3.74 1.05-2.87 0-5.3-1.94-6.17-4.55H2.18v2.84A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.83 14.09A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.65-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.07l3.65 2.84C6.7 7.31 9.13 5.38 12 5.38z" />
          </svg>
          구글로 시작하기
        </button>}
    </div>
  )
}

function AccountBox({ providers, account, onSignedOut }: { providers: Provider[]; account: Account | null; onSignedOut: () => void }) {
  const [busy, setBusy] = useState(false)

  const signOut = async () => {
    const sb = await supabase()
    await sb.auth.signOut()
    onSignedOut()
  }

  const withdraw = async () => {
    if (!confirm("탈퇴하면 계정에 저장한 차와 교체 기록이 모두 지워지고 되돌릴 수 없어요. 탈퇴할까요?")) return
    setBusy(true)
    const sb = await supabase()
    const { error } = await sb.rpc("delete_my_account")
    if (error) {
      setBusy(false)
      alert("탈퇴 처리에 실패했어요. 잠시 뒤 다시 시도해 주세요.")
      return
    }
    await sb.auth.signOut({ scope: "local" })
    onSignedOut()
    setBusy(false)
    alert("탈퇴했어요. 그동안 이용해 주셔서 고맙습니다.")
  }

  if (account) {
    return (
      <section className="mt-10 rounded-[14px] border border-border bg-card p-4">
        <p className="text-[15px] font-semibold">
          {account.name}
          <span className="ml-1.5 text-[13px] font-normal text-muted-foreground">{account.provider === "kakao" ? "카카오" : account.provider === "google" ? "구글" : ""} 로그인 중</span>
        </p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">차 목록과 교체 기록이 계정에 저장돼요</p>
        <div className="mt-3 flex gap-4 text-[13px]">
          <button onClick={signOut} disabled={busy} className="min-h-[40px] font-semibold underline underline-offset-4">로그아웃</button>
          <button onClick={withdraw} disabled={busy} className="min-h-[40px] text-muted-foreground underline underline-offset-4">회원 탈퇴</button>
        </div>
      </section>
    )
  }

  if (!providers.length) return null

  return (
    <section className="mt-10 rounded-[14px] border border-border bg-card p-4">
      <p className="text-[15px] font-semibold">로그인하면 차 여러 대를 폰 바꿔도 그대로</p>
      <div className="mt-3"><LoginButtons providers={providers} /></div>
      <p className="mt-2 text-[12px] text-muted-foreground">
        로그인 없이도 이 폰에서는 그대로 쓸 수 있어요 · <Link href="/privacy" className="underline underline-offset-2">개인정보 처리방침</Link>
      </p>
    </section>
  )
}

function Register({
  options,
  initialCarId,
  first,
  heading = true,
  onSave,
  onCancel,
}: {
  options: MyCarOption[]
  initialCarId: string
  first: boolean
  heading?: boolean
  onSave: (v: MyCar) => void
  onCancel?: () => void
}) {
  const brands = useMemo(() => Array.from(new Set(options.map((o) => o.brand))), [options])
  const pre = options.find((o) => o.id === initialCarId)
  const [brand, setBrand] = useState(pre?.brand ?? "")
  const [carId, setCarId] = useState(pre?.id ?? "")
  const [engine, setEngine] = useState("")
  const [year, setYear] = useState("")
  const [km, setKm] = useState("")
  const car = options.find((o) => o.id === carId)
  const needEngine = !!car && car.engines.length > 1
  const ok = !!car && (!needEngine || !!engine) && (!car.years.length || !!year)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!car || !ok) return
    track({ type: "nav", carId: car.id, meta: { via: "my_register" } })
    onSave({
      id: newCarId(),
      car: snapshot(car, engine || undefined),
      engine: engine || undefined,
      year: year ? Number(year) : undefined,
      km: num(km),
      kmDate: today(),
      records: {},
    })
  }

  return (
    <>
      {heading && (
        <>
          <h1 className="text-[28px] font-extrabold leading-[1.3] sm:text-[34px]">{first ? "내 차 등록" : "차 추가"}</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">차종과 연식만 고르면 맞는 부품과 가격을 보여 드려요</p>
        </>
      )}
      <form onSubmit={submit} className={`${heading ? "mt-6" : ""} space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-6`}>
        <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
          <label className="sr-only" htmlFor="my-brand">브랜드</label>
          <select id="my-brand" className={FIELD} value={brand} onChange={(e) => { setBrand(e.target.value); setCarId(""); setEngine(""); setYear("") }}>
            <option value="">브랜드</option>
            {brands.map((b) => <option key={b}>{b}</option>)}
          </select>
          <label className="sr-only" htmlFor="my-car">차종</label>
          <select id="my-car" className={FIELD} value={carId} disabled={!brand} onChange={(e) => { setCarId(e.target.value); setEngine(""); setYear("") }}>
            <option value="">차종</option>
            {options.filter((o) => o.brand === brand).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        {car && car.years.length > 0 && (
          <>
            <label className="sr-only" htmlFor="my-year">연식</label>
            <select id="my-year" className={FIELD} value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">연식</option>
              {car.years.map((y) => <option key={y} value={y}>{y}년형</option>)}
            </select>
          </>
        )}
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
          <span className="text-[14px] font-semibold">지금 주행거리 <span className="font-normal text-muted-foreground">(선택)</span></span>
          <span className="relative mt-1.5 block">
            <input inputMode="numeric" className={FIELD + " pr-12"} placeholder="예: 63,000" value={km ? num(km).toLocaleString("ko-KR") : ""} onChange={(e) => setKm(e.target.value)} />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted-foreground">km</span>
          </span>
        </label>
        <button type="submit" disabled={!ok} className="h-12 w-full rounded-[10px] bg-primary text-[16px] font-bold text-primary-foreground transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:bg-[#9BB8AD]">
          {first ? "내 차 등록하기" : "이 차 추가하기"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="h-11 w-full text-[14px] font-semibold text-muted-foreground">취소</button>
        )}
      </form>
    </>
  )
}

function Garage({ my, loggedIn, update, remove }: { my: MyCar; loggedIn: boolean; update: (v: MyCar) => void; remove: () => void }) {
  const [editKm, setEditKm] = useState(false)
  const [km, setKm] = useState(my.km > 0 ? String(my.km) : "")
  const [editing, setEditing] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
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
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-extrabold leading-tight sm:text-[24px]">{my.car.name}</h1>
            {(my.year || my.engine) && <p className="mt-1 text-[13px] text-white/70">{[my.year && `${my.year}년형`, my.engine].filter(Boolean).join(" · ")}</p>}
          </div>
          {my.car.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={my.car.photo} alt="" width={160} height={100} className="h-[56px] w-[90px] shrink-0 rounded-md object-cover" />
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-4 py-1.5">
          <span className="text-[14px] text-white/70">주행거리 <span className="text-[12px]">({my.kmDate.slice(5).replace("-", "/")} 기준)</span></span>
          {editKm ? (
            <span className="flex items-center gap-2">
              <input autoFocus inputMode="numeric" className="h-10 w-32 rounded-lg bg-white px-2.5 text-right text-[16px] text-foreground outline-none" value={num(km).toLocaleString("ko-KR")} onChange={(e) => setKm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveKm()} />
              <button onClick={saveKm} className="h-10 rounded-lg bg-primary px-3 text-[14px] font-bold">저장</button>
            </span>
          ) : (
            <button onClick={() => setEditKm(true)} className="num flex min-h-[44px] items-center gap-1.5 text-[18px] font-bold">
              {my.km > 0 ? (
                <>
                  {my.km.toLocaleString("ko-KR")}<span className="text-[14px] font-normal text-white/70">km</span>
                  <span className="ml-1 rounded-md bg-white/10 px-2 py-0.5 text-[12px] font-semibold">고치기</span>
                </>
              ) : (
                <span className="rounded-md bg-white/10 px-2.5 py-1 text-[14px] font-semibold">입력하기</span>
              )}
            </button>
          )}
        </div>
      </section>
      {my.car.credit && <p className="mt-1.5 text-right text-[11px] text-muted-foreground">{my.car.credit}</p>}

      <p className="mt-5 text-[15px] font-semibold">
        {urgent > 0 ? `지금 챙길 소모품이 ${urgent}개 있어요` : unknown === list.length ? "마지막으로 교체한 날짜를 넣어 주세요" : unknown > 0 ? "기록한 소모품 중엔 당장 교체할 게 없어요" : "당장 교체할 소모품은 없어요"}
      </p>
      {unknown > 0 && <p className="mt-1 text-[13px] text-muted-foreground">부품을 누르면 교체 날짜를 넣을 수 있어요</p>}

      <ul className="mt-3 divide-y divide-border rounded-[14px] border border-border bg-card">
        {list.map((d) => {
          const st = STATE_STYLE[d.state]
          const isOpen = open === d.part.slug
          const spec = shortSpec(d.part.spec)
          const toggle = () => {
            setOpen(isOpen ? null : d.part.slug)
            setEditing(null)
          }
          return (
            <li key={d.part.slug}>
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={toggle}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle())}
                className="flex cursor-pointer items-center gap-3 px-4 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{d.part.name}</span>
                  <span className="num block truncate text-[13px] text-muted-foreground">
                    {spec && <>{spec} · </>}
                    {d.part.shop ? (
                      <span onClick={(e) => e.stopPropagation()}>
                      <OutboundLink
                        href={d.part.shop.url}
                        target="coupang"
                        carId={my.car.id}
                        partId={d.part.slug}
                        sponsored
                        className="font-bold text-primary"
                      >
                        쿠팡 {d.part.shop.price.toLocaleString("ko-KR")}원 ›
                      </OutboundLink>
                      </span>
                    ) : d.part.price ? (
                      <>예상 {d.part.price.toLocaleString("ko-KR")}원</>
                    ) : null}
                    {d.record && <> · {d.record.date.slice(2).replace(/-/g, ".")} 교체</>}
                  </span>
                </span>
                {d.record && <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${st.cls}`}>{d.text}</span>}
                <span aria-hidden className={`shrink-0 text-[14px] text-muted-foreground transition ${isOpen ? "rotate-180" : ""}`}>⌄</span>
              </div>
              {isOpen && (
                <div className="px-4 pb-3">
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => update({ ...my, records: { ...my.records, [d.part.slug]: { date: today(), km: my.km } } })}
                        className="min-h-[40px] rounded-lg bg-foreground px-3 text-[13px] font-semibold text-background"
                      >
                        오늘 교체했어요
                      </button>
                      <button onClick={() => setEditing(d.part.slug)} className="min-h-[40px] rounded-lg border border-border px-3 text-[13px] font-semibold">
                        날짜 직접 입력
                      </button>
                      <Link href={`/cars/${my.car.id}/${d.part.slug}`} className="flex min-h-[40px] items-center rounded-lg px-2 text-[13px] font-semibold text-primary">
                        규격·가격 자세히
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {list.some((d) => d.part.shop) && <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">쿠팡 가격은 표시한 날 기준이라 바뀔 수 있어요. {AFFILIATE_TEXT}</p>}

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Link href={`/cars/${my.car.id}`} className="flex min-h-[48px] items-center justify-center rounded-[12px] border border-border bg-card text-[14px] font-semibold">내 차 소모품 가격 전체</Link>
        <Link href="/near" className="flex min-h-[48px] items-center justify-center rounded-[12px] bg-foreground text-[14px] font-semibold text-background">근처 공임나라 찾기</Link>
      </div>
      <p className="mt-6 text-center text-[13px] text-muted-foreground">
        {loggedIn ? "계정에 저장돼요." : "이 휴대폰에만 저장돼요."}{" "}
        <button
          onClick={() => confirm(`${my.car.name}와 교체 기록을 지울까요?`) && remove()}
          className="font-semibold underline underline-offset-4"
        >
          이 차 지우기
        </button>
      </p>
    </>
  )
}

/** 목록에 쓸 짧은 규격: 모든 부품에 붙는 안내 문구는 빼고, 와이퍼는 "650·400mm"처럼 */
function shortSpec(spec?: string): string | null {
  if (!spec) return null
  const w = spec.match(/운전석\s*(\d+)\s*mm.*?조수석\s*(\d+)\s*mm/)
  if (w) return `${w[1]}·${w[2]}mm`
  if (/차종 전용|구매 전|공통|확인/.test(spec) || spec.length > 22) return null
  return spec.replace(/^SAE\s*/, "")
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

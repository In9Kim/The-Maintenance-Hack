"use client"

import { useEffect, useState } from "react"
import { authEnabled, enabledProviders, supabase, type Provider } from "@/lib/supabase"
import { loadGarage, saveGarage } from "@/lib/my-car"
import { pushCars } from "@/lib/cloud-garage"
import { LoginPanel } from "@/components/my/LoginPanel"
import { PushToggle } from "@/components/my/PushToggle"
import { disableAllPush, disablePush } from "@/lib/push-client"

interface Account {
  name: string
  provider: string
}

/**
 * 계정 상자: 로그인 전엔 로그인 버튼, 로그인 후엔 '○○ 로그인 중 · 알림 · 로그아웃 · 탈퇴'.
 * 혼자 로그인 상태를 읽는다 (더보기 화면에서 씀). 로그인 뒤 차 목록 합치기는 /my 콜백(MyCarPage)이 한다.
 * 바깥 여백은 쓰는 쪽에서 정한다.
 */
export function AccountBox({ next = "/more" }: { next?: string }) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [account, setAccount] = useState<Account | null>(null)
  const [ready, setReady] = useState(false) // 로그인 상태를 받기 전엔 아무것도 안 그림 (로그인한 사람에게 로그인 버튼이 번쩍 뜨지 않게)
  const [provReady, setProvReady] = useState(false) // 로그인 수단 목록을 받았는지 (받기 전엔 로그인 상자가 비어 있음)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!authEnabled()) return
    enabledProviders().then(setProviders, () => {}).finally(() => setProvReady(true))
  }, [])

  useEffect(() => {
    if (!authEnabled()) return
    let off = () => {}
    let alive = true
    supabase().then((sb) => {
      const { data } = sb.auth.onAuthStateChange((_event, session) => {
        if (!alive) return
        const u = session?.user
        setAccount(
          u
            ? { name: (u.user_metadata?.name as string) || (u.user_metadata?.full_name as string) || u.email || "회원", provider: u.app_metadata?.provider ?? "" }
            : null,
        )
        setReady(true)
      })
      off = () => data.subscription.unsubscribe()
    })
    return () => {
      alive = false
      off()
    }
  }, [])

  const onSignedOut = () => {
    setAccount(null)
    saveGarage({ cars: [], active: "" }) // 계정의 차는 이 폰에서 지움 (다시 로그인하면 돌아옴)
  }

  const signOut = async () => {
    // 로그아웃하면 이 폰의 차 목록을 비우므로, 그 전에 계정에 한 번 더 올려 둔다 (저장 실패했던 수정이 사라지지 않게)
    setBusy(true)
    const cars = loadGarage().cars
    const saved = cars.length ? await pushCars(cars).then(() => true, () => false) : true
    setBusy(false)
    if (!saved && !confirm("계정에 저장 못 한 기록이 있어요. 로그아웃하면 이 폰에서 사라져요. 그래도 할까요?")) return
    await disablePush().catch(() => {}) // 로그아웃한 폰에는 알림을 보내지 않음
    const sb = await supabase()
    await sb.auth.signOut()
    onSignedOut()
  }

  const withdraw = async () => {
    if (!confirm("탈퇴하면 계정에 저장한 차와 교체 기록이 모두 지워지고 되돌릴 수 없어요. 탈퇴할까요?")) return
    setBusy(true)
    await disableAllPush().catch(() => {}) // 이 계정으로 알림을 켠 다른 폰까지 모두 지움
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

  if (!authEnabled()) return null
  // 상태를 받기 전엔 회색 틀로 자리만 잡는다 (아래 도구 목록이 먼저 떴다가 밀려 내려가지 않게)
  if (!ready || (!account && !provReady)) return <div aria-hidden className="h-[366px] animate-pulse rounded-[14px] bg-muted" />

  if (account) {
    return (
      <section className="rounded-[14px] border border-border bg-card p-4">
        <p className="text-[15px] font-semibold">
          {account.name}
          <span className="ml-1.5 text-[13px] font-normal text-muted-foreground">{account.provider === "kakao" ? "카카오" : account.provider === "google" ? "구글" : ""} 로그인 중</span>
        </p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">차 목록과 교체 기록이 계정에 저장돼요</p>
        <PushToggle />
        <div className="mt-3 flex gap-4 text-[13px]">
          <button onClick={signOut} disabled={busy} className="min-h-[40px] font-semibold underline underline-offset-4">로그아웃</button>
          <button onClick={withdraw} disabled={busy} className="min-h-[40px] text-muted-foreground underline underline-offset-4">회원 탈퇴</button>
        </div>
      </section>
    )
  }

  return <LoginPanel providers={providers} next={next} />
}

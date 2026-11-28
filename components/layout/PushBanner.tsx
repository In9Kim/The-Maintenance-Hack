"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { loadMyCar } from "@/lib/my-car"
import { authEnabled, supabase } from "@/lib/supabase"
import { enablePush, pushState, type PushState } from "@/lib/push-client"
import { track } from "@/lib/track"

const DISMISS_KEY = "mh_push_dismissed"

/**
 * 홈 맨 위 한 줄: 교체 시기 알림 켜기 (리콜 띠가 있으면 그 대신 안 보임, RecallBanner가 그림).
 * 차를 등록하고 로그인한 사람에게만, 아직 안 켰을 때만. ×로 닫으면 다시 안 보임 (더보기 > 계정에서 켜고 끌 수 있음)
 */
export function PushBanner() {
  const pathname = usePathname()
  const [st, setSt] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    let alive = true
    const read = async () => {
      try {
        if (localStorage.getItem(DISMISS_KEY) || !loadMyCar() || !authEnabled()) return setSt(null)
        const sb = await supabase()
        const { data } = await sb.auth.getSession()
        if (!data.session) return alive && setSt(null)
        const s = await pushState()
        if (alive) setSt(s === "off" || s === "ios-install" ? s : null)
      } catch {
        if (alive) setSt(null)
      }
    }
    read()
    window.addEventListener("mh-my-car", read)
    return () => {
      alive = false
      window.removeEventListener("mh-my-car", read)
    }
  }, [pathname])

  if (!st || pathname.startsWith("/admin")) return null

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1")
    } catch {}
    track({ type: "nav", meta: { via: "push_banner_close" } })
    setSt(null)
  }
  const on = async () => {
    setBusy(true)
    setErr("")
    try {
      const r = await enablePush()
      track({ type: "nav", meta: { via: "push_on", from: "banner", result: r } })
      if (r === "on") setSt(null)
      else if (r === "denied") setErr("알림이 막혀 있어요. 휴대폰 설정 → 알림에서 켜 주세요.")
      else setErr("알림을 켜지 못했어요. 다시 눌러 주세요.")
    } catch (e) {
      setErr((e as Error)?.message || "알림을 켜지 못했어요")
    }
    setBusy(false)
  }

  return (
    <div className="border-b border-[#ABEFC6] bg-[#ECFDF3] text-[#054F31]">
      <div className="mx-auto flex max-w-5xl items-center gap-2 pl-5 pr-1">
        <span aria-hidden className="text-[16px]">🔔</span>
        <span className="min-w-0 flex-1 py-2 text-[14px] font-semibold">
          {st === "ios-install" ? "홈 화면에 추가하면 교체 시기 알림을 받아요" : "부품 갈 때가 되면 알림 받기"}
          {err && <span className="block text-[12px] font-normal text-[#B42318]">{err}</span>}
        </span>
        {st === "off" && (
          <button onClick={on} disabled={busy} className="h-9 shrink-0 rounded-[8px] bg-primary px-3 text-[14px] font-bold text-primary-foreground disabled:opacity-60">
            {busy ? "켜는 중…" : "켜기"}
          </button>
        )}
        <button onClick={close} aria-label="알림 안내 닫기" className="flex h-11 w-11 shrink-0 items-center justify-center text-[18px] text-[#054F31]/60">
          ×
        </button>
      </div>
    </div>
  )
}

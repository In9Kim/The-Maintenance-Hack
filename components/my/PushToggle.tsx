"use client"

import { useEffect, useState } from "react"
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push-client"
import { track } from "@/lib/track"

/** 마이(로그인한 사람): 교체 시기 알림 켜기·끄기 */
export function PushToggle() {
  const [st, setSt] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  useEffect(() => {
    pushState().then(setSt, () => setSt("unsupported"))
  }, [])
  if (!st) return null

  const on = async () => {
    setBusy(true)
    setErr("")
    try {
      const r = await enablePush()
      setSt(r)
      track({ type: "nav", meta: { via: "push_on", result: r } })
      if (r === "off") setErr("알림을 켜지 못했어요. 잠시 뒤 다시 눌러 주세요.")
    } catch (e) {
      const m = (e as Error)?.message || "알림을 켜지 못했어요"
      setErr(m)
      track({ type: "nav", meta: { via: "push_fail", reason: m.slice(0, 80) } })
    }
    setBusy(false)
  }
  const off = async () => {
    setBusy(true)
    await disablePush().catch(() => {})
    setSt("off")
    setBusy(false)
  }

  return (
    <div className="mt-3 rounded-[12px] bg-muted p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[15px] font-bold">교체 시기 알림</span>
          <span className="block text-[13px] text-muted-foreground">
            {st === "on" ? "켜져 있어요 · 갈 때가 되면 아침 9시에 알려 드려요" : "갈 때가 되면 아침 9시에 한 번 알려 드려요"}
          </span>
        </span>
        {st === "on" ? (
          <button onClick={off} disabled={busy} className="h-10 shrink-0 rounded-[10px] border border-border bg-card px-3 text-[14px] font-semibold">
            끄기
          </button>
        ) : st === "off" ? (
          <button onClick={on} disabled={busy} className="h-10 shrink-0 rounded-[10px] bg-primary px-3.5 text-[14px] font-bold text-primary-foreground disabled:opacity-60">
            {busy ? "켜는 중…" : "켜기"}
          </button>
        ) : null}
      </div>
      {st === "ios-install" && (
        <p className="mt-2 text-[13px] leading-relaxed">
          아이폰은 <b>홈 화면에 추가</b>한 정비핵에서만 알림을 받을 수 있어요.
          <br />
          Safari 아래 공유 버튼 → 홈 화면에 추가 → 추가한 정비핵을 열고 여기서 켜기
        </p>
      )}
      {st === "denied" && <p className="mt-2 text-[13px]">알림이 막혀 있어요. 휴대폰 설정 → 알림에서 브라우저(또는 정비핵) 알림을 켜 주세요.</p>}
      {st === "unsupported" && <p className="mt-2 text-[13px]">이 브라우저는 알림을 받을 수 없어요. 크롬이나 삼성 인터넷에서 열어 주세요.</p>}
      {err && <p role="alert" className="mt-2 text-[13px] text-[#B42318]">{err}</p>}
    </div>
  )
}

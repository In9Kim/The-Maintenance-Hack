"use client"

import { useState } from "react"
import { supabase, type Provider } from "@/lib/supabase"
import { track } from "@/lib/track"

const AFTER_KEY = "mh_after_login"

/** 로그인 후 돌아갈 화면 꺼내기 (한 번 쓰면 지움). Supabase 허용 주소가 /my 하나라서 /my를 거쳐 돌려보낸다 */
export function takeAfterLogin(): string | null {
  try {
    const v = sessionStorage.getItem(AFTER_KEY)
    sessionStorage.removeItem(AFTER_KEY)
    return v && /^\/[a-z-]+$/.test(v) && v !== "/my" ? v : null
  } catch {
    return null
  }
}

/** /my에서 로그인한 뒤 돌아올 화면 미리 적어 두기 (예: 계산기의 'AI로 규격 만들기') */
export function rememberAfterLogin(path: string) {
  try {
    sessionStorage.setItem(AFTER_KEY, path)
  } catch {}
}

/** 카카오·구글 로그인 버튼. next: 로그인 후 돌아올 화면 */
export function LoginButtons({ providers, next = "/my" }: { providers: Provider[]; next?: string }) {
  const [busy, setBusy] = useState(false)
  const signIn = async (provider: Provider) => {
    setBusy(true)
    track({ type: "nav", meta: { via: `login_${provider}` } })
    try {
      if (next !== "/my") sessionStorage.setItem(AFTER_KEY, next)
    } catch {}
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

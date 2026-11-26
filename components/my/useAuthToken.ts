"use client"

import { useEffect, useState } from "react"
import { authEnabled, enabledProviders, supabase, type Provider } from "@/lib/supabase"

/**
 * 로그인 토큰과 켜진 로그인 방식. token: undefined = 확인 중, null = 로그인 안 함.
 * AI 기능(견적서·부품 확인)은 로그인한 사람만 쓰므로 서버에 "Authorization: Bearer"로 보낸다.
 */
export function useAuthToken() {
  const [token, setToken] = useState<string | null | undefined>(undefined)
  const [providers, setProviders] = useState<Provider[]>([])

  useEffect(() => {
    if (!authEnabled()) return setToken(null)
    let alive = true
    let off: (() => void) | undefined
    enabledProviders().then((p) => alive && setProviders(p))
    supabase()
      .then(async (sb) => {
        const { data } = await sb.auth.getSession()
        if (alive) setToken(data.session?.access_token ?? null)
        off = sb.auth.onAuthStateChange((_e, s) => alive && setToken(s?.access_token ?? null)).data.subscription.unsubscribe
      })
      .catch(() => alive && setToken(null))
    return () => {
      alive = false
      off?.()
    }
  }, [])

  return { token, setToken, providers }
}

import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Supabase 접속 정보. 둘 다 브라우저에 그대로 나가는 공개 값이다 (publishable key).
 * 데이터 보호는 DB의 RLS(supabase/schema.sql)가 한다. secret/service_role 키는 절대 여기 넣지 않는다.
 * 키가 비어 있으면 로그인 화면을 숨기고 예전처럼 이 기기에만 저장한다.
 */
export const SUPABASE_URL = "https://vqkroartpmbvffggunsw.supabase.co"
export const SUPABASE_KEY = "sb_publishable_W0kiS1Iduhz8gCTWncmudg_TdK-Wwu1"

export const authEnabled = () => SUPABASE_KEY.length > 0

export type Provider = "kakao" | "google"

/** Supabase 대시보드에서 켜 둔 로그인 방식만 (켜기 전 버튼이 고장 나 보이지 않게) */
export async function enabledProviders(): Promise<Provider[]> {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } })
    const j = (await r.json()) as { external?: Record<string, boolean> }
    return (["kakao", "google"] as const).filter((p) => j.external?.[p])
  } catch {
    return []
  }
}

let client: Promise<SupabaseClient> | null = null

/** 로그인 기능을 쓰는 화면에서만 불러온다 (다른 페이지 용량에 안 들어가게) */
export function supabase(): Promise<SupabaseClient> {
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  )
  return client
}

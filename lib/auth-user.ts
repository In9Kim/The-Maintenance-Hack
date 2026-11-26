import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase"

/**
 * 요청의 "Authorization: Bearer <access_token>"을 Supabase에 물어 로그인한 사용자 id를 돌려준다.
 * 토큰이 없거나 만료·위조면 null. (서버 전용 — 공개 키만 쓰고 secret 키는 쓰지 않음)
 */
export async function userIdFrom(req: Request): Promise<string | null> {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token || token.length > 4000) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    const j = (await r.json()) as { id?: string }
    return typeof j.id === "string" && j.id ? j.id : null
  } catch {
    return null
  }
}

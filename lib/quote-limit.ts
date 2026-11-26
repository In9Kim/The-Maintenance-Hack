/**
 * 견적서 분석 하루 제한 (유료 AI라 엄격하게): 로그인한 사람(계정 id 해시) 하루 1번, 사이트 전체 하루 GLOBAL번.
 * KV(VERIFY_LIMIT)에 날짜별로 센다. KV가 없는 로컬에서는 제한 없음.
 */
import { createHash } from "crypto"
import { kstDay } from "@/lib/verify-limit"

export const QUOTE_PER_USER = 1
export const QUOTE_GLOBAL = 100

interface KV {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
}
async function kv(): Promise<KV | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare")
    return ((getCloudflareContext().env as unknown as { VERIFY_LIMIT?: KV }).VERIFY_LIMIT) ?? null
  } catch {
    return null
  }
}

/** 쓸 수 있으면 바로 1번 센다 (AI 호출 전에 막아야 비용이 안 샘) */
export async function takeQuote(who: string): Promise<"ok" | "user" | "global"> {
  const store = await kv()
  if (!store) return "ok"
  const day = kstDay()
  const uk = `qu:${day}:${createHash("sha256").update(`${day}|${who}`).digest("hex").slice(0, 20)}`
  const gk = `qg:${day}`
  const [u, g] = await Promise.all([store.get(uk), store.get(gk)])
  if (Number(g ?? 0) >= QUOTE_GLOBAL) return "global"
  if (Number(u ?? 0) >= QUOTE_PER_USER) return "user"
  const ttl = 60 * 60 * 36
  await Promise.all([store.put(uk, String(Number(u ?? 0) + 1), { expirationTtl: ttl }), store.put(gk, String(Number(g ?? 0) + 1), { expirationTtl: ttl })])
  return "ok"
}

/** 분석이 실패했거나 사진을 못 읽었으면 그 1번은 돌려준다 */
export async function refundQuote(who: string): Promise<void> {
  const store = await kv()
  if (!store) return
  const day = kstDay()
  const uk = `qu:${day}:${createHash("sha256").update(`${day}|${who}`).digest("hex").slice(0, 20)}`
  const gk = `qg:${day}`
  const [u, g] = await Promise.all([store.get(uk), store.get(gk)])
  const ttl = 60 * 60 * 36
  await Promise.all([
    store.put(uk, String(Math.max(0, Number(u ?? 0) - 1)), { expirationTtl: ttl }),
    store.put(gk, String(Math.max(0, Number(g ?? 0) - 1)), { expirationTtl: ttl }),
  ])
}

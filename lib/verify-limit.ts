/**
 * 부품 호환 확인(AI 판정) 하루 조회 제한.
 *  - 한 사람(IP 기준) 하루 PER_USER번. 이미 판정해 둔 결과(캐시)를 다시 보는 건 세지 않는다.
 *  - 사이트 전체 하루 GLOBAL번을 넘으면 그날은 AI 판정을 멈춘다 (API 비용 안전장치).
 * 저장: Cloudflare KV (VERIFY_LIMIT). IP는 원문을 저장하지 않고 날짜를 섞은 해시만 쓴다.
 * KV가 없는 환경(로컬 next dev 등)에서는 제한 없이 통과.
 */
import { createHash } from "crypto"

export const PER_USER = 3
export const GLOBAL = 300

interface KV {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
}

/** 한국 시간 기준 오늘 (자정에 초기화) */
export const kstDay = (now = Date.now()) => new Date(now + 9 * 3600_000).toISOString().slice(0, 10)

export function userKey(ip: string, day: string): string {
  return `u:${day}:${createHash("sha256").update(`${day}|${ip}`).digest("hex").slice(0, 20)}`
}

async function kv(): Promise<KV | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare")
    const env = getCloudflareContext().env as unknown as { VERIFY_LIMIT?: KV }
    return env.VERIFY_LIMIT ?? null
  } catch {
    return null
  }
}

export interface LimitState {
  ok: boolean
  /** 오늘 남은 횟수 (이번 조회 전) */
  remaining: number
  reason?: "user" | "global"
}

export async function checkLimit(ip: string): Promise<LimitState> {
  const store = await kv()
  if (!store) return { ok: true, remaining: PER_USER }
  const day = kstDay()
  const [u, g] = await Promise.all([store.get(userKey(ip, day)), store.get(`g:${day}`)])
  const used = Number(u ?? 0)
  if (Number(g ?? 0) >= GLOBAL) return { ok: false, remaining: Math.max(PER_USER - used, 0), reason: "global" }
  if (used >= PER_USER) return { ok: false, remaining: 0, reason: "user" }
  return { ok: true, remaining: PER_USER - used }
}

/** AI 판정을 실제로 했을 때 한 번 센다 */
export async function countUse(ip: string): Promise<void> {
  const store = await kv()
  if (!store) return
  const day = kstDay()
  const uk = userKey(ip, day)
  const [u, g] = await Promise.all([store.get(uk), store.get(`g:${day}`)])
  const ttl = 60 * 60 * 36
  await Promise.all([
    store.put(uk, String(Number(u ?? 0) + 1), { expirationTtl: ttl }),
    store.put(`g:${day}`, String(Number(g ?? 0) + 1), { expirationTtl: ttl }),
  ])
}

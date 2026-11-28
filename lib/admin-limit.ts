/**
 * 관리자 로그인 반복 시도 제한: 같은 IP가 10분 안에 MAX_FAILS번 틀리면 그 10분 동안 막는다.
 * 저장: Cloudflare KV(VERIFY_LIMIT), IP는 해시로만. KV가 없는 로컬에서는 제한 없음.
 * (KV는 원자적이지 않아 동시에 몰아 보내면 몇 번 더 들어갈 수 있다. 비밀번호를 충분히 길게 두는 게 1차 방어)
 */
import { createHash } from "crypto"

export const MAX_FAILS = 5
export const WINDOW_SEC = 600

export interface AdminKV {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
}

const keyOf = (ip: string) => `al:${createHash("sha256").update(`admin|${ip}`).digest("hex").slice(0, 20)}`

/** 지금 막혀 있는지 */
export async function adminLocked(store: AdminKV | null, ip: string): Promise<boolean> {
  if (!store) return false
  return Number((await store.get(keyOf(ip)).catch(() => null)) ?? 0) >= MAX_FAILS
}

/** 틀렸을 때 1번 센다 (10분 뒤 자동으로 지워짐) */
export async function adminFail(store: AdminKV | null, ip: string): Promise<void> {
  if (!store) return
  const k = keyOf(ip)
  const n = Number((await store.get(k).catch(() => null)) ?? 0)
  await store.put(k, String(n + 1), { expirationTtl: WINDOW_SEC }).catch(() => {})
}

/** 맞혔으면 센 것을 비운다 (KV 최소 TTL이 60초라 0으로 60초) */
export async function adminReset(store: AdminKV | null, ip: string): Promise<void> {
  if (!store) return
  await store.put(keyOf(ip), "0", { expirationTtl: 60 }).catch(() => {})
}

export async function adminStore(): Promise<AdminKV | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare")
    return (getCloudflareContext().env as unknown as { VERIFY_LIMIT?: AdminKV }).VERIFY_LIMIT ?? null
  } catch {
    return null
  }
}

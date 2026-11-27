/**
 * 견적서 분석 하루 제한 (유료 AI라 AI를 부르기 전에 센다). KV(VERIFY_LIMIT)에 날짜별로, 키는 해시로만 저장.
 *  - 로그인 안 한 사람: 기기마다 하루 GUEST번 (정비소 앞에서 바로 쓰게 로그인 없이)
 *    + 같은 IP 하루 PER_IP번 (휴대폰 통신사는 여러 사람이 IP 하나를 같이 써서 넉넉하게, 마구 부르는 것만 막음)
 *  - 로그인한 사람: 계정마다 하루 USER번
 *  - 사이트 전체: 하루 GLOBAL번 (Haiku 기준 1번 1~2원 추정이라 최악이어도 하루 수백 원)
 * KV가 없는 로컬에서는 제한 없음.
 */
import { createHash } from "crypto"
import { kstDay } from "@/lib/verify-limit"

export const QUOTE_GUEST = 1
export const QUOTE_PER_USER = 3
export const QUOTE_PER_IP = 10
export const QUOTE_GLOBAL = 300

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

/** 세는 대상 하나: who("u:계정" / "d:기기" / "ip:주소")와 하루 한도 */
export interface QuoteCounter {
  who: string
  limit: number
}

const keyOf = (day: string, who: string) => `qu:${day}:${createHash("sha256").update(`${day}|${who}`).digest("hex").slice(0, 20)}`
const TTL = 60 * 60 * 36

/** 모두 한도 안이면 한꺼번에 1번씩 센다. 넘은 게 있으면 그 who를 돌려준다 (아무것도 세지 않음) */
export async function takeQuote(counters: QuoteCounter[]): Promise<"ok" | "global" | { over: string }> {
  const store = await kv()
  if (!store) return "ok"
  const day = kstDay()
  const gk = `qg:${day}`
  const keys = counters.map((c) => keyOf(day, c.who))
  const [g, ...vals] = await Promise.all([store.get(gk), ...keys.map((k) => store.get(k))])
  if (Number(g ?? 0) >= QUOTE_GLOBAL) return "global"
  const over = counters.find((c, i) => Number(vals[i] ?? 0) >= c.limit)
  if (over) return { over: over.who }
  await Promise.all([
    store.put(gk, String(Number(g ?? 0) + 1), { expirationTtl: TTL }),
    ...keys.map((k, i) => store.put(k, String(Number(vals[i] ?? 0) + 1), { expirationTtl: TTL })),
  ])
  return "ok"
}

/** 분석이 실패했거나 사진을 못 읽었으면 그 1번은 돌려준다 */
export async function refundQuote(counters: QuoteCounter[]): Promise<void> {
  const store = await kv()
  if (!store) return
  const day = kstDay()
  const gk = `qg:${day}`
  const keys = [gk, ...counters.map((c) => keyOf(day, c.who))]
  const vals = await Promise.all(keys.map((k) => store.get(k)))
  await Promise.all(keys.map((k, i) => store.put(k, String(Math.max(0, Number(vals[i] ?? 0) - 1)), { expirationTtl: TTL })))
}

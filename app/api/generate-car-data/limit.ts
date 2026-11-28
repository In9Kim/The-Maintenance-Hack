/**
 * 'AI로 규격 만들기'(/api/generate-car-data) 하루 한도. 유료 AI를 부르고 구글시트에 행을 쌓아서 막아 둔다.
 *  - 로그인한 사람만 (계정마다 하루 GEN_PER_USER번)
 *  - 사이트 전체 하루 GEN_GLOBAL번 (넘으면 그날은 멈춤: 비용·시트 오염 안전장치)
 * 저장: Cloudflare KV(VERIFY_LIMIT), 계정 id는 날짜를 섞은 해시로만. KV가 없는 로컬에서는 제한 없음.
 * (lib/verify-limit.ts·lib/quote-limit.ts와 같은 방식, 키 접두사만 gen·gg로 따로)
 */
import { createHash } from "crypto"

export const GEN_PER_USER = 3
export const GEN_GLOBAL = 30

export interface GenKV {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
}

const TTL = 60 * 60 * 36
/** 한국 시간 기준 오늘 */
const kstDay = (now: number) => new Date(now + 9 * 3600_000).toISOString().slice(0, 10)
const userKey = (day: string, uid: string) => `gen:${day}:${createHash("sha256").update(`${day}|u:${uid}`).digest("hex").slice(0, 20)}`

/** 한도 안이면 계정·전체를 1번씩 센다. 넘었으면 아무것도 세지 않고 이유를 돌려준다 */
export async function takeGen(store: GenKV | null, uid: string, now = Date.now()): Promise<"ok" | "user" | "global"> {
  if (!store) return "ok"
  const day = kstDay(now)
  const uk = userKey(day, uid)
  const gk = `gg:${day}`
  const [u, g] = await Promise.all([store.get(uk), store.get(gk)])
  if (Number(g ?? 0) >= GEN_GLOBAL) return "global"
  if (Number(u ?? 0) >= GEN_PER_USER) return "user"
  await Promise.all([
    store.put(uk, String(Number(u ?? 0) + 1), { expirationTtl: TTL }),
    store.put(gk, String(Number(g ?? 0) + 1), { expirationTtl: TTL }),
  ])
  return "ok"
}

/** AI가 실패했으면 계정 몫 1번만 돌려준다 (전체 상한은 돌려주지 않음: 실패를 반복해 상한을 비켜 가지 못하게) */
export async function refundGenUser(store: GenKV | null, uid: string, now = Date.now()): Promise<void> {
  if (!store) return
  const uk = userKey(kstDay(now), uid)
  const u = Number((await store.get(uk)) ?? 0)
  await store.put(uk, String(Math.max(0, u - 1)), { expirationTtl: TTL })
}

/** 운영(Workers)의 KV. 로컬처럼 없으면 null */
export async function genStore(): Promise<GenKV | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare")
    return (getCloudflareContext().env as unknown as { VERIFY_LIMIT?: GenKV }).VERIFY_LIMIT ?? null
  } catch {
    return null
  }
}

/** 받은 본문을 문자열 필드만, 길이를 잘라서 (프롬프트가 커지지 않게). 객체가 아니면 null */
export function cleanGenInput(body: unknown): { brand: string; model: string; generation?: string; yearRange?: string; engineType: string; vin?: string } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null
  const b = body as Record<string, unknown>
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
  const vin = s(b.vin, 20).toUpperCase().replace(/[^A-Z0-9]/g, "")
  return {
    brand: s(b.brand, 40),
    model: s(b.model, 60),
    generation: s(b.generation, 60) || undefined,
    yearRange: s(b.yearRange, 30) || undefined,
    engineType: s(b.engineType, 60),
    // 화면은 10자부터 받는다 (CarSelector). 짧거나 비면 차대번호 없이
    vin: vin.length >= 10 ? vin.slice(0, 17) : undefined,
  }
}

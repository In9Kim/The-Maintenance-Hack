/**
 * 부품 호환 확인(AI 판정) 하루 조회 제한.
 *  - 로그인한 사람: 계정마다 하루 PER_USER번.
 *  - 로그인 안 한 사람: 기기마다 하루 GUEST번 + 같은 IP 하루 PER_IP번 (견적서 분석과 같은 기준).
 *  - 이미 판정해 둔 결과(캐시)를 다시 보는 건 세지 않는다.
 *  - 사이트 전체 하루 GLOBAL번을 넘으면 그날은 AI 판정을 멈춘다 (API 비용 안전장치).
 * 저장: Cloudflare KV (VERIFY_LIMIT). IP는 원문을 저장하지 않고 날짜를 섞은 해시만 쓴다.
 * KV가 없는 환경(로컬 next dev 등)에서는 제한 없이 통과.
 */
import { createHash } from "crypto"
// 타입만 가져옴 (node 테스트가 확장자 없는 경로를 못 읽어서, 계산은 아래 takeKeys·refundKeys에 같은 내용을 둠)
import type { AtomicCounter, KV as CoreKV, RefundOp, TakeOp, TakeResult } from "./counter-core"

export const PER_USER = 3
export const GUEST = 1
export const PER_IP = 10
export const GLOBAL = 300
/** 비로그인 전체 몫 (전체 300번 중). 게스트가 로그인 사용자 몫까지 다 쓰지 못하게 */
export const GUEST_ALL_MAX = 200
export const GUEST_ALL = "guest-all"

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

export async function checkLimit(ip: string, limit = PER_USER): Promise<LimitState> {
  const store = await kv()
  if (!store) return { ok: true, remaining: limit }
  const day = kstDay()
  const [u, g] = await Promise.all([store.get(userKey(ip, day)), store.get(`g:${day}`)])
  const used = Number(u ?? 0)
  if (Number(g ?? 0) >= GLOBAL) return { ok: false, remaining: Math.max(limit - used, 0), reason: "global" }
  if (used >= limit) return { ok: false, remaining: 0, reason: "user" }
  return { ok: true, remaining: limit - used }
}

// ── 하루 횟수 세기 (견적서 분석 lib/quote-limit.ts도 같이 씀) ──
// AI를 부르기 "전에" 먼저 센다. 응답 뒤에 세면 동시에 보낸 요청이 모두 한도를 통과하기 때문.
// 실패하면 개인(기기 d:·계정 u:) 횟수만 돌려준다. IP 횟수와 사이트 전체 횟수는 돌려주지 않아서
// 일부러 실패를 반복해도 AI 호출은 IP·전체 한도 안에 머문다 (비용 안전장치).

export type { KV }

/** 세는 대상 하나: who("u:계정" / "d:기기" / "ip:주소")와 하루 한도 */
export interface Counter {
  who: string
  limit: number
}

/** 기능마다 다른 KV 키 규칙 */
export interface CounterSpec {
  globalKey: (day: string) => string
  key: (day: string, who: string) => string
  globalMax: number
}

/** 한 사람이 하루에 돌려받을 수 있는 실패 횟수 (그 이상 실패는 그냥 쓴 것으로 침) */
export const REFUND_MAX = 3
const TTL = 60 * 60 * 36

/** 개인 횟수(돌려줄 수 있는 것)인지: 기기·계정만. IP는 여러 사람이 같이 쓰는 한도라 돌려주지 않음 */
export const isPersonal = (who: string) => who.startsWith("d:") || who.startsWith("u:")

/** 부품 확인 키 규칙 (예전 키 그대로: g:날짜, u:날짜:해시) */
export const VERIFY_SPEC: CounterSpec = { globalKey: (day) => `g:${day}`, key: (day, who) => userKey(who, day), globalMax: GLOBAL }

/**
 * KV로 셀 때의 계산. lib/counter-core.ts(Durable Object 안에서 도는 쪽)와 같은 내용이어야 함
 * (lib/counter-core.test.ts가 둘이 같은 결과를 내는지 확인).
 */
export async function takeKeys(store: CoreKV, op: TakeOp): Promise<TakeResult> {
  const [g, ...vals] = await Promise.all([store.get(op.gk), ...op.items.map((i) => store.get(i.key))])
  if (Number(g ?? 0) >= op.globalMax) return "global"
  const over = op.items.findIndex((it, i) => Number(vals[i] ?? 0) >= it.limit)
  if (over >= 0) return { index: over }
  await Promise.all([
    store.put(op.gk, String(Number(g ?? 0) + 1), { expirationTtl: op.ttl }),
    ...op.items.map((it, i) => store.put(it.key, String(Number(vals[i] ?? 0) + 1), { expirationTtl: op.ttl })),
  ])
  return "ok"
}

export async function refundKeys(store: CoreKV, op: RefundOp): Promise<void> {
  const minus = async (k: string) => {
    const v = Number((await store.get(k)) ?? 0)
    if (v > 0) await store.put(k, String(v - 1), { expirationTtl: op.ttl })
  }
  const jobs: Promise<void>[] = op.personal.map(async (k) => {
    const rk = `${k}:r`
    const refunded = Number((await store.get(rk)) ?? 0)
    if (refunded >= op.refundMax) return
    await Promise.all([store.put(rk, String(refunded + 1), { expirationTtl: op.ttl }), minus(k)])
  })
  if (op.globalKey) jobs.push(minus(op.globalKey))
  await Promise.all(jobs)
}

/** KV 또는 한 번에 하나씩 세는 Durable Object */
export type CounterStore = KV | AtomicCounter
const isAtomic = (s: CounterStore): s is AtomicCounter => typeof (s as AtomicCounter).run === "function"

/** 모두 한도 안이면 한꺼번에 1번씩 센다(전체 포함). 넘은 게 있으면 아무것도 세지 않고 이유를 돌려준다 */
export async function takeCounters(
  store: CounterStore | null,
  spec: CounterSpec,
  counters: Counter[],
  day = kstDay(),
): Promise<"ok" | "global" | { over: string }> {
  if (!store) return "ok"
  const op: TakeOp = {
    kind: "take",
    gk: spec.globalKey(day),
    globalMax: spec.globalMax,
    items: counters.map((c) => ({ key: spec.key(day, c.who), limit: c.limit })),
    ttl: TTL,
  }
  const r = isAtomic(store) ? ((await store.run(op)) as TakeResult) : await takeKeys(store, op)
  return typeof r === "string" ? r : { over: counters[r.index]?.who ?? "" }
}

/**
 * 실패한 1번을 돌려준다: 기기·계정 횟수만, 하루 REFUND_MAX번까지.
 * aiCalled=false(AI를 아예 안 부른 실패, 예: 키 없음)일 때만 전체 횟수도 돌려준다.
 */
export async function refundCounters(
  store: CounterStore | null,
  spec: CounterSpec,
  counters: Counter[],
  { aiCalled = true }: { aiCalled?: boolean } = {},
  day = kstDay(),
): Promise<void> {
  if (!store) return
  const op: RefundOp = {
    kind: "refund",
    personal: counters.filter((c) => isPersonal(c.who)).map((c) => spec.key(day, c.who)),
    refundMax: REFUND_MAX,
    globalKey: aiCalled ? undefined : spec.globalKey(day),
    ttl: TTL,
  }
  if (isAtomic(store)) await store.run(op)
  else await refundKeys(store, op)
}

/**
 * 운영에서 쓸 저장소: Durable Object(LIMITS)가 있으면 그것(동시에 몰아 보내도 한도 유지), 없으면 KV, 둘 다 없으면(로컬) null.
 * Durable Object 호출이 실패하면 KV로 센다 (기능이 멈추지 않게).
 */
export async function counterStore(): Promise<CounterStore | null> {
  let env: { VERIFY_LIMIT?: KV; LIMITS?: DONamespace } = {}
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare")
    env = getCloudflareContext().env as unknown as typeof env
  } catch {
    return null
  }
  const fallback = env.VERIFY_LIMIT ?? null
  const ns = env.LIMITS
  if (!ns) return fallback
  return {
    async run(op) {
      try {
        const stub = ns.get(ns.idFromName("limits"))
        const r = await stub.fetch("https://limits/run", { method: "POST", body: JSON.stringify(op) })
        if (!r.ok) throw new Error(String(r.status))
        return ((await r.json()) as { result: TakeResult | null }).result
      } catch (e) {
        console.error("[limits] DO 실패, KV로 셈", String(e).slice(0, 100))
        if (!fallback) return op.kind === "take" ? "ok" : null
        if (op.kind === "take") return takeKeys(fallback, op)
        await refundKeys(fallback, op)
        return null
      }
    },
  }
}

interface DONamespace {
  idFromName(name: string): unknown
  get(id: unknown): { fetch(url: string, init: RequestInit): Promise<Response> }
}

/** 부품 확인: AI 부르기 전에 센다 */
export async function takeVerify(counters: Counter[]) {
  return takeCounters(await counterStore(), VERIFY_SPEC, counters)
}

/** 부품 확인: AI가 실패하면 개인 횟수만 돌려준다 */
export async function refundVerify(counters: Counter[]) {
  return refundCounters(await counterStore(), VERIFY_SPEC, counters)
}

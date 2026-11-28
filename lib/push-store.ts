/**
 * 교체 시기 알림: 구독 저장(KV) + 매일 아침 보내기.
 * 저장: KV(VERIFY_LIMIT, 앞머리 "push:"). 키 = push:<계정 해시>:<기기 해시>. 값 = 구독 정보·알림 일정·보낸 기록.
 *  - 이름·이메일·번호판은 저장하지 않는다. 차 이름과 부품 이름, 날짜만.
 * 워커 진입점(worker.ts)의 예약 실행(매일 09:00 한국 시간)에서 runDailyPush를 부른다. (그래서 "@/..." 경로를 쓰지 않음)
 */
import { buildPush, type PushSub } from "./web-push"
import { pushMessage, type PushItem } from "./push-schedule"

export interface KV {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
  list(opts: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>
}

export interface PushRecord {
  sub: PushSub
  items: PushItem[]
  /** 보낸 알림 key → 보낸 날 */
  sent: Record<string, string>
}

/** 오래 안 쓴 구독은 1년 뒤 저절로 지움 (일정을 다시 보내면 연장) */
const TTL = 60 * 60 * 24 * 365

async function hash(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
  return Array.from(new Uint8Array(d).slice(0, 10), (b) => b.toString(16).padStart(2, "0")).join("")
}

/** 이 계정의 구독 키 앞머리 (기기 수 세기·탈퇴 때 모두 지우기) */
export const pushUserPrefix = async (uid: string) => `push:${await hash(`u|${uid}`)}:`
export const pushKey = async (uid: string, endpoint: string) => `${await pushUserPrefix(uid)}${await hash(`e|${endpoint}`)}`

/** 이 계정의 구독 키 전부 */
export async function userPushKeys(kv: KV, uid: string): Promise<string[]> {
  const prefix = await pushUserPrefix(uid)
  const out: string[] = []
  let cursor: string | undefined
  do {
    const page = await kv.list({ prefix, cursor })
    out.push(...page.keys.map((k) => k.name))
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor && out.length < 1000)
  return out
}

/** 계정별 하루 횟수 (저장·확인 알림). 넘으면 false. 키 앞머리가 push:가 아니라서 매일 알림 작업이 훑지 않음 */
export async function takePushQuota(kv: KV, uid: string, kind: "save" | "hello", max: number, now = Date.now()): Promise<boolean> {
  const key = `pq:${kind}:${kstToday(now)}:${await hash(`u|${uid}`)}`
  const n = Number((await kv.get(key)) ?? 0)
  if (n >= max) return false
  await kv.put(key, String(n + 1), { expirationTtl: 60 * 60 * 26 })
  return true
}

/** 구독·일정 저장. 이미 보낸 기록은 지금 일정에 남은 것만 이어 간다 */
export async function savePush(kv: KV, key: string, sub: PushSub, items: PushItem[]) {
  const old = JSON.parse((await kv.get(key)) ?? "null") as PushRecord | null
  const keep = new Set(items.map((i) => i.key))
  const sent = Object.fromEntries(Object.entries(old?.sent ?? {}).filter(([k]) => keep.has(k)))
  await kv.put(key, JSON.stringify({ sub, items, sent } satisfies PushRecord), { expirationTtl: TTL })
}

export const kstToday = (now = Date.now()) => new Date(now + 9 * 3600_000).toISOString().slice(0, 10)

/** 매일 한 번: 날짜가 된 알림을 기기마다 한 통씩 보낸다. 없어진 구독(404·410)은 지운다 */
export async function runDailyPush(kv: KV, privateJWK: string, now = Date.now()): Promise<{ sent: number; removed: number; failed: number }> {
  const today = kstToday(now)
  const out = { sent: 0, removed: 0, failed: 0 }
  let cursor: string | undefined
  do {
    const page = await kv.list({ prefix: "push:", cursor })
    for (const { name } of page.keys) {
      const rec = JSON.parse((await kv.get(name)) ?? "null") as PushRecord | null
      if (!rec?.sub?.endpoint) continue
      const msg = pushMessage(rec.items ?? [], rec.sent ?? {}, today)
      if (!msg) continue
      try {
        const { endpoint, headers, body } = await buildPush(rec.sub, { title: msg.title, body: msg.body, url: "/my" }, privateJWK, "https://jungbihack.com")
        const r = await fetch(endpoint, { method: "POST", headers, body })
        if (r.status === 404 || r.status === 410) {
          await kv.delete(name)
          out.removed++
        } else if (r.ok) {
          for (const k of msg.keys) rec.sent[k] = today
          await kv.put(name, JSON.stringify(rec), { expirationTtl: TTL })
          out.sent++
        } else out.failed++
      } catch {
        out.failed++
      }
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return out
}

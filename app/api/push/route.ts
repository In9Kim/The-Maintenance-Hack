import { NextRequest, NextResponse } from "next/server"
import { userIdFrom } from "@/lib/auth-user"
import { pushKey, savePush, takePushQuota, userPushKeys, type KV } from "@/lib/push-store"
import { isPushEndpoint, MAX_HELLO_PER_DAY, MAX_SAVES_PER_DAY, MAX_SUBS_PER_USER } from "@/lib/push-guard"
import { buildPush } from "@/lib/web-push"
import type { PushItem } from "@/lib/push-schedule"

/** 교체 시기 알림 켜기·일정 갱신(POST), 끄기(DELETE). 로그인한 사람만 (회원 혜택) */

async function cf(): Promise<{ VERIFY_LIMIT?: KV; VAPID_PRIVATE_KEY?: string }> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare")
    return getCloudflareContext().env as unknown as { VERIFY_LIMIT?: KV; VAPID_PRIVATE_KEY?: string }
  } catch {
    return {}
  }
}
const kv = async () => (await cf()).VERIFY_LIMIT ?? null

const str = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v : null)

function readSub(v: unknown) {
  const s = v as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null
  const endpoint = str(s?.endpoint, 1000)
  const p256dh = str(s?.keys?.p256dh, 200)
  const auth = str(s?.keys?.auth, 100)
  // 브라우저 푸시 서버 주소만 (아무 주소나 받으면 워커가 남이 고른 곳으로 요청을 보내게 됨)
  if (!endpoint || !p256dh || !auth || !isPushEndpoint(endpoint)) return null
  return { endpoint, keys: { p256dh, auth } }
}

function readItems(v: unknown): PushItem[] | null {
  if (!Array.isArray(v) || v.length > 200) return null
  const out: PushItem[] = []
  for (const x of v as Record<string, unknown>[]) {
    const key = str(x?.key, 120)
    const name = str(x?.name, 40)
    const car = str(x?.car, 40)
    const date = str(x?.date, 10)
    if (!key || !name || !car || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
    out.push({ key, name, car, date })
  }
  return out
}

export async function POST(req: NextRequest) {
  const uid = await userIdFrom(req)
  if (!uid) return NextResponse.json({ error: "로그인하면 알림을 받을 수 있어요.", login: true }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { subscription?: unknown; items?: unknown; hello?: unknown } | null
  const sub = readSub(body?.subscription)
  const items = readItems(body?.items)
  if (!sub || !items) return NextResponse.json({ error: "알림 정보가 올바르지 않아요." }, { status: 400 })
  const env = await cf()
  if (!env.VERIFY_LIMIT) return NextResponse.json({ ok: true, stored: false })
  const store = env.VERIFY_LIMIT
  const key = await pushKey(uid, sub.endpoint)
  // 비용 한도: 계정당 기기 수·하루 저장 횟수 (KV 쓰기·매일 아침 작업이 끝없이 늘지 않게)
  const mine = await userPushKeys(store, uid)
  if (!mine.includes(key) && mine.length >= MAX_SUBS_PER_USER)
    return NextResponse.json({ error: `알림은 한 계정에 기기 ${MAX_SUBS_PER_USER}대까지 켤 수 있어요. 안 쓰는 폰에서 먼저 꺼 주세요.` }, { status: 429 })
  if (!(await takePushQuota(store, uid, "save", MAX_SAVES_PER_DAY)))
    return NextResponse.json({ error: "오늘은 알림 저장을 많이 했어요. 내일 다시 해 주세요." }, { status: 429 })
  await savePush(store, key, sub, items)
  // 처음 켤 때: 바로 한 통 보내서 이 폰에서 알림이 오는지 확인시킨다 (계정당 하루 몇 번만)
  let hello: number | null = null
  if (body?.hello === true && env.VAPID_PRIVATE_KEY && (await takePushQuota(store, uid, "hello", MAX_HELLO_PER_DAY))) {
    try {
      const p = await buildPush(sub, { title: "정비핵 알림이 켜졌어요", body: "부품 갈 때가 되면 아침 9시에 이렇게 알려 드려요", url: "/my" }, env.VAPID_PRIVATE_KEY, "https://jungbihack.com", 3600)
      hello = (await fetch(p.endpoint, { method: "POST", headers: p.headers, body: p.body })).status
    } catch {
      hello = 0
    }
  }
  return NextResponse.json({ ok: true, stored: true, hello })
}

export async function DELETE(req: NextRequest) {
  const uid = await userIdFrom(req)
  if (!uid) return NextResponse.json({ error: "로그인이 필요해요.", login: true }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown; all?: unknown } | null
  const store = await kv()
  // 탈퇴: 이 계정으로 켠 모든 기기의 알림 정보를 지운다
  if (body?.all === true) {
    if (store) for (const k of await userPushKeys(store, uid)) await store.delete(k)
    return NextResponse.json({ ok: true })
  }
  const endpoint = str(body?.endpoint, 1000)
  if (!endpoint) return NextResponse.json({ error: "알림 정보가 올바르지 않아요." }, { status: 400 })
  if (store) await store.delete(await pushKey(uid, endpoint))
  return NextResponse.json({ ok: true })
}

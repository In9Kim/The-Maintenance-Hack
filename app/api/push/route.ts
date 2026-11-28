import { NextRequest, NextResponse } from "next/server"
import { userIdFrom } from "@/lib/auth-user"
import { pushKey, savePush, type KV } from "@/lib/push-store"
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
  if (!endpoint || !p256dh || !auth || !/^https:\/\//.test(endpoint)) return null
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
  await savePush(env.VERIFY_LIMIT, await pushKey(uid, sub.endpoint), sub, items)
  // 처음 켤 때: 바로 한 통 보내서 이 폰에서 알림이 오는지 확인시킨다
  let hello: number | null = null
  if (body?.hello === true && env.VAPID_PRIVATE_KEY) {
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
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null
  const endpoint = str(body?.endpoint, 1000)
  if (!endpoint) return NextResponse.json({ error: "알림 정보가 올바르지 않아요." }, { status: 400 })
  const store = await kv()
  if (store) await store.delete(await pushKey(uid, endpoint))
  return NextResponse.json({ ok: true })
}

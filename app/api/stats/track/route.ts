import { NextRequest, NextResponse, after } from "next/server"
import { logEvent } from "@/lib/googleSheets"

// 허용하는 행동 유형과 이동 대상
const TYPES = new Set(["outbound", "car_view", "calc_use", "report"])
const TARGETS = new Set(["coupang", "naver", "gongim", "other", ""])

// 예전 계산기 코드 호환: part_click → 쿠팡 이동, gongim_click → 공임나라 이동
const LEGACY: Record<string, { type: string; target: string }> = {
  part_click: { type: "outbound", target: "coupang" },
  gongim_click: { type: "outbound", target: "gongim" },
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = JSON.parse(await req.text())
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const legacy = LEGACY[clip(body.type, 30)]
  const type = legacy?.type ?? clip(body.type, 30)
  const target = legacy?.target ?? clip(body.target, 20)
  if (!TYPES.has(type) || !TARGETS.has(target)) {
    return NextResponse.json({ error: "알 수 없는 이벤트입니다." }, { status: 400 })
  }

  let referrer = ""
  try {
    const ref = clip(body.referrer, 300)
    if (ref) referrer = new URL(ref).hostname
  } catch {
    /* 잘못된 referrer 무시 */
  }

  const event = {
    type,
    target,
    carId: clip(body.carId, 100),
    partId: clip(body.partId, 150),
    path: clip(body.path, 300),
    referrer,
    meta: typeof body.meta === "object" && body.meta ? (body.meta as Record<string, unknown>) : undefined,
  }

  // 응답은 바로 보내고, 시트 기록은 뒤에서 처리
  after(() => logEvent(event))
  return NextResponse.json({ ok: true })
}

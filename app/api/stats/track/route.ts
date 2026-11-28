import { NextRequest, NextResponse, after } from "next/server"
import { logEvent } from "@/lib/googleSheets"

// 허용하는 행동 유형과 이동 대상
const TYPES = new Set(["outbound", "car_view", "calc_use", "report", "landing", "nav"])
const TARGETS = new Set(["coupang", "naver", "gongim", "recall_center", "blog", "kakaomap", "other", ""])

// 예전 계산기 코드 호환: part_click → 쿠팡 이동, gongim_click → 공임나라 이동
const LEGACY: Record<string, { type: string; target: string }> = {
  part_click: { type: "outbound", target: "coupang" },
  gongim_click: { type: "outbound", target: "gongim" },
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")
/** 구글 시트가 수식으로 읽지 않게 (=, +, @, -글자 로 시작하면 앞에 작은따옴표) */
const cell = (v: string) => (/^[=+@\t\r]|^-[^\d]/.test(v) ? `'${v}` : v)

/** meta는 한 단계 객체만, 키 20개·값은 글자/숫자/참거짓(글자는 200자까지), 합쳐 1,000자 넘으면 버림 (시트 셀이 커지지 않게) */
function cleanMeta(v: unknown): Record<string, string | number | boolean> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined
  const out: Record<string, string | number | boolean> = {}
  for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 20)) {
    if (typeof x === "string") out[k.slice(0, 40)] = x.slice(0, 200)
    else if (typeof x === "number" || typeof x === "boolean") out[k.slice(0, 40)] = x
  }
  if (!Object.keys(out).length || JSON.stringify(out).length > 1000) return undefined
  return out
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    const text = await req.text()
    if (text.length > 8000) throw new Error("too big")
    const parsed: unknown = JSON.parse(text)
    // 'null'·숫자·배열처럼 객체가 아닌 본문은 400 (body.type에서 500이 나지 않게)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not object")
    body = parsed as Record<string, unknown>
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
    carId: cell(clip(body.carId, 100)),
    partId: cell(clip(body.partId, 150)),
    // 화면 주소만 ("/"로 시작)
    path: /^\/(?!\/)/.test(clip(body.path, 300)) ? clip(body.path, 300) : "",
    referrer,
    meta: cleanMeta(body.meta),
  }

  // 응답은 바로 보내고, 시트 기록은 뒤에서 처리
  after(() => logEvent(event))
  return NextResponse.json({ ok: true })
}

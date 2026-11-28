import { NextRequest, NextResponse } from "next/server"
import { getSeoCar, partCost, partSlug } from "@/lib/seo"
import { coupangPickFor } from "@/lib/coupang-links"
import { analyzeQuoteImage, buildQuotePrompt, streamQuoteImage, type QuoteItem } from "@/lib/quote-analyze"
import { takeQuote, refundQuote, QUOTE_GUEST, QUOTE_GUEST_ALL, QUOTE_PER_IP, QUOTE_PER_USER, GUEST_ALL, type QuoteCounter } from "@/lib/quote-limit"
import { clientIp } from "@/lib/client-ip"
import { userIdFrom } from "@/lib/auth-user"
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth"

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_B64 = 5_000_000 // 약 3.7MB (화면에서 줄여 보내서 보통 0.5MB 안쪽)

/** 견적서 사진 분석. 사진은 저장하지 않고 응답이 끝나면 버린다 */
export async function POST(req: NextRequest) {
  let body: { carId?: string; year?: number; engine?: string; image?: string; mediaType?: string; device?: string; stream?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "요청을 읽지 못했어요." }, { status: 400 })
  }
  // 본문이 null·숫자·배열이면 아래에서 TypeError(500)가 나므로 여기서 400
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "요청을 읽지 못했어요." }, { status: 400 })
  const car = getSeoCar(typeof body.carId === "string" ? body.carId : "")
  if (!car) return NextResponse.json({ error: "차종을 먼저 골라 주세요." }, { status: 400 })
  const image = typeof body.image === "string" ? body.image.replace(/^data:[^,]+,/, "") : ""
  const mediaType = TYPES.has(body.mediaType ?? "") ? body.mediaType! : "image/jpeg"
  if (!image || image.length > MAX_B64) return NextResponse.json({ error: "사진이 없거나 너무 커요. 다시 찍어 주세요." }, { status: 400 })

  // 로그인 안 해도 기기마다 하루 1번 (정비소 앞에서 바로 쓰게). 로그인하면 계정마다 하루 3번
  const uid = await userIdFrom(req)
  const device = typeof body.device === "string" && /^[0-9a-f-]{36}$/.test(body.device) ? body.device : ""
  // IPv6는 /64로 묶어서 셈 (주소만 바꿔 가며 한도를 피하지 못하게)
  const ip = clientIp(req.headers)
  // 관리자(/admin/login으로 로그인한 운영자)는 개인 한도 없이 테스트. 사이트 전체 한도는 그대로 센다
  const admin = await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value ?? "")
  const counters: QuoteCounter[] = admin
    ? []
    : uid
    ? [{ who: `u:${uid}`, limit: QUOTE_PER_USER }]
    : [
        { who: `d:${device || ip}`, limit: QUOTE_GUEST },
        { who: `ip:${ip}`, limit: QUOTE_PER_IP },
        // 비로그인 전체 몫: 사이트 전체 한도를 게스트가 다 쓰지 못하게
        { who: GUEST_ALL, limit: QUOTE_GUEST_ALL },
      ]
  const take = await takeQuote(counters)
  if (take !== "ok") {
    const error =
      take === "global"
        ? "오늘은 분석 요청이 많아 마감됐어요. 내일 다시 이용해 주세요."
        : take.over === GUEST_ALL
          ? "오늘 무료 분석이 마감됐어요. 로그인하면 이어서 쓸 수 있어요."
          : uid
          ? `견적서 분석은 하루 ${QUOTE_PER_USER}번까지예요. 내일 다시 이용해 주세요.`
          : `오늘 무료 분석 ${QUOTE_GUEST}번을 썼어요. 로그인하면 하루 ${QUOTE_PER_USER}번까지 쓸 수 있어요.`
    return NextResponse.json({ error, limited: true, login: !uid && take !== "global" }, { status: 429 })
  }

  const year = Number.isInteger(body.year) ? body.year : undefined
  const engine = typeof body.engine === "string" ? body.engine : undefined
  // 정비핵 소모품과 짝지어진 항목: 직접 구매+공임나라 예상, 공식센터 추정, 쿠팡 상품
  const enrich = (it: QuoteItem) => {
    const part = it.match_part_id ? car.parts.find((p) => p.id === it.match_part_id) : undefined
    if (!part) return { ...it, match_part_id: null }
    const c = partCost(part)
    const pick = coupangPickFor(part)
    return {
      ...it,
      ours: {
        slug: partSlug(car, part),
        name: part.name,
        self: c.self,
        labor: part.laborCost,
        dealer: c.dealer,
        shop: pick ? { name: pick.name, price: pick.price, url: pick.url, image: pick.image, date: pick.checkedAt } : null,
      },
    }
  }
  // 부품이 없는 항목(점검·클리닝·탈부착만)은 결과에서 뺀다
  const isPart = (it: QuoteItem) => it.has_part !== false
  const failMsg = (msg: string): [string, number] =>
    msg === "NO_KEY"
      ? ["분석 기능을 준비 중이에요.", 503]
      : /credit|balance|billing/i.test(msg)
        ? ["분석 기능이 잠시 멈췄어요. 곧 다시 열게요.", 503]
        : ["사진을 분석하지 못했어요. 글자가 잘 보이게 다시 찍어 주세요.", 502]
  const prompt = buildQuotePrompt(car, car.parts, year, engine)

  // 받는 대로 보여 주기: 한 줄에 하나씩 {t:"item"} … {t:"done"} 또는 {t:"error"} (NDJSON)
  if (body.stream) {
    const enc = new TextEncoder()
    const stream = new ReadableStream({
      async start(ctl) {
        // 보내기 실패(화면이 연결을 끊음)는 무시: AI 실패와 섞여 횟수를 돌려주면 끊기를 반복해 한도를 피할 수 있음
        const send = (o: unknown) => {
          try {
            ctl.enqueue(enc.encode(JSON.stringify(o) + "\n"))
          } catch {}
        }
        try {
          const result = await streamQuoteImage(image, mediaType, prompt, (it) => it.has_part !== false && send({ t: "item", item: enrich(it) }))
          if (!result.readable) await refundQuote(counters)
          send({ t: "done", result: { ...result, items: result.items.filter(isPart).map(enrich) } })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.error("[quote:stream]", msg.slice(0, 200))
          await refundQuote(counters, { aiCalled: msg !== "NO_KEY" })
          send({ t: "error", error: failMsg(msg)[0] })
        } finally {
          try {
            ctl.close()
          } catch {}
        }
      },
    })
    return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } })
  }

  try {
    const result = await analyzeQuoteImage(image, mediaType, prompt)
    if (!result.readable) await refundQuote(counters)
    return NextResponse.json({ ...result, items: result.items.filter(isPart).map(enrich) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[quote]", msg.slice(0, 200))
    await refundQuote(counters, { aiCalled: msg !== "NO_KEY" })
    const [error, status] = failMsg(msg)
    return NextResponse.json({ error }, { status })
  }
}

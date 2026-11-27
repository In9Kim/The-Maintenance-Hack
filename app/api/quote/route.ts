import { NextRequest, NextResponse } from "next/server"
import { getSeoCar, partCost, partSlug } from "@/lib/seo"
import { coupangPickFor } from "@/lib/coupang-links"
import { analyzeQuoteImage, buildQuotePrompt, streamQuoteImage, type QuoteItem } from "@/lib/quote-analyze"
import { takeQuote, refundQuote, QUOTE_GUEST, QUOTE_PER_IP, QUOTE_PER_USER, type QuoteCounter } from "@/lib/quote-limit"
import { userIdFrom } from "@/lib/auth-user"

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
  const car = getSeoCar(body.carId ?? "")
  if (!car) return NextResponse.json({ error: "차종을 먼저 골라 주세요." }, { status: 400 })
  const image = typeof body.image === "string" ? body.image.replace(/^data:[^,]+,/, "") : ""
  const mediaType = TYPES.has(body.mediaType ?? "") ? body.mediaType! : "image/jpeg"
  if (!image || image.length > MAX_B64) return NextResponse.json({ error: "사진이 없거나 너무 커요. 다시 찍어 주세요." }, { status: 400 })

  // 로그인 안 해도 기기마다 하루 1번 (정비소 앞에서 바로 쓰게). 로그인하면 계정마다 하루 3번
  const uid = await userIdFrom(req)
  const device = typeof body.device === "string" && /^[0-9a-f-]{36}$/.test(body.device) ? body.device : ""
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const counters: QuoteCounter[] = uid
    ? [{ who: `u:${uid}`, limit: QUOTE_PER_USER }]
    : [
        { who: `d:${device || ip}`, limit: QUOTE_GUEST },
        { who: `ip:${ip}`, limit: QUOTE_PER_IP },
      ]
  const take = await takeQuote(counters)
  if (take !== "ok") {
    const error =
      take === "global"
        ? "오늘은 분석 요청이 많아 마감됐어요. 내일 다시 이용해 주세요."
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
        dealer: c.dealer,
        shop: pick ? { name: pick.name, price: pick.price, url: pick.url, image: pick.image, date: pick.checkedAt } : null,
      },
    }
  }
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
        const send = (o: unknown) => ctl.enqueue(enc.encode(JSON.stringify(o) + "\n"))
        try {
          const result = await streamQuoteImage(image, mediaType, prompt, (it) => send({ t: "item", item: enrich(it) }))
          if (!result.readable) await refundQuote(counters)
          send({ t: "done", result: { ...result, items: result.items.map(enrich) } })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.error("[quote:stream]", msg.slice(0, 200))
          await refundQuote(counters)
          send({ t: "error", error: failMsg(msg)[0] })
        } finally {
          ctl.close()
        }
      },
    })
    return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } })
  }

  try {
    const result = await analyzeQuoteImage(image, mediaType, prompt)
    if (!result.readable) await refundQuote(counters)
    return NextResponse.json({ ...result, items: result.items.map(enrich) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[quote]", msg.slice(0, 200))
    await refundQuote(counters)
    const [error, status] = failMsg(msg)
    return NextResponse.json({ error }, { status })
  }
}

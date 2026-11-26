import { NextRequest, NextResponse } from "next/server"
import { getSeoCar, partCost, partSlug } from "@/lib/seo"
import { coupangPickFor } from "@/lib/coupang-links"
import { analyzeQuoteImage, buildQuotePrompt } from "@/lib/quote-analyze"
import { takeQuote, refundQuote, QUOTE_PER_USER } from "@/lib/quote-limit"

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_B64 = 5_000_000 // 약 3.7MB (화면에서 줄여 보내서 보통 0.5MB 안쪽)

/** 견적서 사진 분석. 사진은 저장하지 않고 응답이 끝나면 버린다 */
export async function POST(req: NextRequest) {
  let body: { carId?: string; year?: number; engine?: string; image?: string; mediaType?: string }
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

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const take = await takeQuote(ip)
  if (take !== "ok") {
    return NextResponse.json(
      { error: take === "global" ? "오늘은 분석 요청이 많아 마감됐어요. 내일 다시 이용해 주세요." : `견적서 분석은 하루 ${QUOTE_PER_USER}번까지예요. 내일 다시 이용해 주세요.`, limited: true },
      { status: 429 },
    )
  }

  const year = Number.isInteger(body.year) ? body.year : undefined
  const engine = typeof body.engine === "string" ? body.engine : undefined
  try {
    const result = await analyzeQuoteImage(image, mediaType, buildQuotePrompt(car, car.parts, year, engine))
    if (!result.readable) await refundQuote(ip)
    // 정비핵 소모품과 짝지어진 항목: 직접 구매+공임나라 예상, 공식센터 추정, 쿠팡 상품
    const items = result.items.map((it) => {
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
    })
    return NextResponse.json({ ...result, items })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[quote]", msg.slice(0, 200))
    await refundQuote(ip)
    if (msg === "NO_KEY") return NextResponse.json({ error: "분석 기능을 준비 중이에요." }, { status: 503 })
    if (/credit|balance|billing/i.test(msg)) return NextResponse.json({ error: "분석 기능이 잠시 멈췄어요. 곧 다시 열게요." }, { status: 503 })
    return NextResponse.json({ error: "사진을 분석하지 못했어요. 글자가 잘 보이게 다시 찍어 주세요." }, { status: 502 })
  }
}

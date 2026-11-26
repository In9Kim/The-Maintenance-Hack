import { NextRequest, NextResponse } from "next/server"
import { getSeoCar, partSlug } from "@/lib/seo"
import { allowSearch, coupangSearch } from "@/lib/coupang-api"
import { coupangPickFor } from "@/lib/coupang-links"

/**
 * /check 화면 안에서 쿠팡 상품 검색 (앱 이동 없이 고르기).
 * GET ?carId=…&part=부품주소  또는  ?carId=…&q=자유검색어 → 차 이름을 붙여 검색, 상위 10개 + 정비핵 추천 상품 표시
 */
/** 여러 부품에 두루 붙는 말 (구별에 쓰지 않음) */
const GENERIC = new Set(["브레이크", "엔진", "필터", "블레이드", "전면", "앞", "뒤", "전", "후", "세트", "12V", "4개"])

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const car = getSeoCar(sp.get("carId") ?? "")
  if (!car) return NextResponse.json({ error: "차종을 먼저 골라 주세요." }, { status: 400 })
  const code = car.generation.split(/\s/)[0]
  const name = [car.model, /^[A-Z][A-Z0-9]{1,4}$/.test(code) ? code : ""].filter(Boolean).join(" ")
  const part = sp.get("part") ? car.parts.find((p) => partSlug(car, p) === sp.get("part")) : undefined
  const q = (sp.get("q") ?? "").trim().slice(0, 40)
  if (!part && q.length < 2) return NextResponse.json({ error: "찾을 부품을 고르거나 적어 주세요." }, { status: 400 })

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (!(await allowSearch(ip))) return NextResponse.json({ error: "오늘 검색을 많이 했어요. 내일 다시 이용해 주세요." }, { status: 429 })
  const partName = part ? part.name.replace(/\s*\(.*?\)/g, "").replace(/\+/g, " ") : ""
  const keyword = part ? `${name} ${partName}` : q.includes(car.model) ? q : `${name} ${q}`
  try {
    const all = await coupangSearch(keyword, 10)
    // 쿠팡 검색은 비슷한 다른 부품(디스크 → 패드)이 섞여 나와서, 부품을 구별하는 낱말이 상품명에 있는 것만 (너무 적으면 전부)
    const words = (part ? partName : q).split(/\s+/).filter((w) => w.length >= 2 && !GENERIC.has(w))
    const kept = words.length ? all.filter((x) => words.some((w) => x.name.replace(/\s/g, "").includes(w))) : all
    const items = kept.length >= 3 ? kept : all
    const pick = part ? coupangPickFor(part) : undefined
    return NextResponse.json(
      { keyword, pickId: pick?.productId ? Number(pick.productId) : null, items },
      { headers: { "Cache-Control": "public, max-age=600" } },
    )
  } catch {
    return NextResponse.json({ error: "쿠팡 검색이 잠시 안 돼요. 조금 뒤 다시 시도해 주세요." }, { status: 502 })
  }
}

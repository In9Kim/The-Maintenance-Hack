import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"

const DEEPLINK_HOST = "api-gateway.coupang.com"
const DEEPLINK_PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink"
const DEEPLINK_URL  = `https://${DEEPLINK_HOST}${DEEPLINK_PATH}`

// 엔진 타입·구동 방식·변속기 등 쿠팡 검색 정확도를 낮추는 노이즈 패턴
const SPEC_NOISE =
  /\b(가솔린|디젤|LPG|LPI|하이브리드|전기|전륜구동|후륜구동|사륜구동|4WD|AWD|FF|FR|RR|자동변속기|수동변속기|변속기|DCT|CVT|터보|Turbo)\b|\([^)]*\)|\b\d+\.\d+\b|[,·]/gi

// specs 문자열에서 노이즈를 제거하고 [연식 + 모델명]만 남김
function compressSpecs(raw: string): string {
  return raw.replace(SPEC_NOISE, "").replace(/\s+/g, " ").trim()
}

// 쿠팡 스펙: yyMMddTHHmmssZ (2자리 연도, UTC 기준)
// Java 예시: new SimpleDateFormat("yyMMdd'T'HHmmss'Z'")
function generateDatetime(): string {
  const now = new Date()
  const yy = String(now.getUTCFullYear()).slice(-2)
  const MM = String(now.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(now.getUTCDate()).padStart(2, "0")
  const HH = String(now.getUTCHours()).padStart(2, "0")
  const mm = String(now.getUTCMinutes()).padStart(2, "0")
  const ss = String(now.getUTCSeconds()).padStart(2, "0")
  return `${yy}${MM}${dd}T${HH}${mm}${ss}Z`
}

// 메시지 = datetime + method + path + query (구분자 없는 직접 연결)
function generateSignature(
  method: string,
  path: string,
  query: string,
  datetime: string,
  secretKey: string
): string {
  const message = datetime + method + path + query
  console.log("[coupang-link] HMAC message:", JSON.stringify(message))
  return createHmac("sha256", secretKey).update(message).digest("hex")
}

export async function POST(req: NextRequest) {
  const accessKey = process.env.COUPANG_ACCESS_KEY
  const secretKey = process.env.COUPANG_SECRET_KEY

  if (!accessKey || !secretKey) {
    return NextResponse.json(
      { error: "Coupang API credentials not configured" },
      { status: 503 }
    )
  }

  let inputPart: string
  let specs: string
  try {
    const body = await req.json() as { inputPart?: unknown; specs?: unknown; query?: unknown }
    if (typeof body.inputPart === "string") {
      inputPart = body.inputPart.trim().slice(0, 100)
      specs     = typeof body.specs === "string" ? body.specs.trim() : ""
    } else {
      // backward compat: { query }
      inputPart = typeof body.query === "string" ? body.query.trim().slice(0, 200) : ""
      specs     = ""
    }
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  if (!inputPart) {
    return NextResponse.json({ error: "검색어가 필요합니다." }, { status: 400 })
  }

  const compressedSpecs = compressSpecs(specs)
  const finalQuery = [inputPart, compressedSpecs].filter(Boolean).join(" ").slice(0, 200)
  console.log("[coupang-link] Compressed query:", JSON.stringify(finalQuery))

  const searchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(finalQuery)}`
  const datetime  = generateDatetime()
  const signature = generateSignature("POST", DEEPLINK_PATH, "", datetime, secretKey)
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`
  console.log("[coupang-link] Authorization:", authorization)

  try {
    const res = await fetch(DEEPLINK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        Authorization: authorization,
      },
      body: JSON.stringify({ coupangUrls: [searchUrl] }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error("[coupang-link] API error:", res.status, text)
      return NextResponse.json({ error: "쿠팡 API 오류" }, { status: 502 })
    }

    const json = await res.json() as {
      rCode: string
      rMessage: string
      data: Array<{ shortenUrl: string; originUrl: string }>
    }

    const shortenUrl = json.data?.[0]?.shortenUrl
    if (!shortenUrl) {
      return NextResponse.json({ error: "단축 URL을 받지 못했습니다." }, { status: 502 })
    }

    return NextResponse.json({ shortenUrl })
  } catch (err) {
    console.error("[coupang-link]", err)
    return NextResponse.json(
      { error: "링크 생성 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse, after } from "next/server"
import { verifyCompatibility, friendlyAiError } from "@/lib/gemini"
import { lookupCache, writeCache, makeVinPrefix, logEvent, sheetsEnabled, lookupVehicleSpec } from "@/lib/googleSheets"
import { getFixedVehicleSpec } from "@/lib/vehicle-spec"
import { softenResult } from "@/lib/compat-wording"
import { createHash } from "crypto"
import { checkLimit, countUse, GUEST, PER_IP, PER_USER } from "@/lib/verify-limit"
import { getSeoCar } from "@/lib/seo"
import { buildCompatRequest, parseProductInput } from "@/lib/compat-request"
import { userIdFrom } from "@/lib/auth-user"

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i
// Block SSRF to private/loopback ranges
const BLOCKED_HOSTNAMES = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/

/**
 * 쇼핑몰 공통 제목(상품명이 아님). 네이버 스마트스토어·쿠팡 등은 서버에서 열면 상품명이 아니라
 * "네이버+ 스토어" 같은 껍데기 제목만 돌려줘서, 이걸 상품 정보로 쓰면 엉터리 판정이 나고 캐시까지 오염됨.
 */
const GENERIC_TITLES =
  /^(네이버\+?\s*스토어|네이버\s*(쇼핑|스마트스토어)?|스마트스토어|naver|쿠팡!?|coupang|11번가|g마켓|gmarket|옥션|auction|ssg\.?com|롯데온|위메프|티몬|access denied|로그인|login|error|에러|오류|페이지를 찾을 수 없습니다|just a moment\.*|attention required.*)$/i

/** 상품 정보로 쓸 만한 문자열인지 (너무 짧거나 쇼핑몰 공통 제목이면 false) */
function isUsefulProductInfo(text: string | null | undefined): text is string {
  if (!text) return false
  const t = text.replace(/\s*[:|\-–]\s*(네이버\+?\s*스토어|스마트스토어|쿠팡!?|coupang|11번가|g마켓|옥션)\s*$/i, "").trim()
  if (t.length < 4) return false
  return !GENERIC_TITLES.test(t)
}

async function extractProductInfoFromUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
    })
    clearTimeout(timeoutId)

    if (!res.ok) return null

    const reader = res.body?.getReader()
    if (!reader) return null

    const decoder = new TextDecoder()
    let html = ""
    while (html.length < 40000) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
      // Stop early once we have the <head> section
      if (/<\/head>/i.test(html)) break
    }
    reader.cancel().catch(() => {})

    const ogTitle =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,300})["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']{1,300})["'][^>]+property=["']og:title["']/i)?.[1]

    const title = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1]

    const clean = (v?: string) =>
      v?.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim()
    // og:title이 껍데기면 <title>도 확인하고, 둘 다 쓸모없으면 실패 처리 → 사용자에게 직접 입력 요청
    const candidate = [clean(ogTitle), clean(title)].find((v) => isUsefulProductInfo(v))
    return candidate ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  // 로그인 안 해도 기기마다 하루 GUEST번 (견적서 분석과 같은 기준). 로그인하면 계정마다 하루 PER_USER번
  const uid = await userIdFrom(req)
  const ipAddr = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  try {
    const body = await req.json()
    const { vin, carId, year, engine, product } = body as {
      vin?: string
      carId?: string
      year?: number
      engine?: string
      product?: string
      productUrl?: string
      productText?: string
      productCategory?: string
    }
    let { productUrl, productText } = body as { productUrl?: string; productText?: string }
    const { productCategory } = body as { productCategory?: string }

    // 차종·연식으로 고른 경우 (차대번호 없음): 붙여 넣은 글에서 상품명·링크를 나눔
    const car = typeof carId === "string" ? getSeoCar(carId) : undefined
    if (carId && !car) return NextResponse.json({ error: "차종을 다시 골라 주세요." }, { status: 400 })
    const req2 = car ? buildCompatRequest(car, Number.isInteger(year) && year! > 1980 && year! < 2100 ? year : undefined, typeof engine === "string" ? engine : undefined) : null
    if (car) {
      const p = parseProductInput(typeof product === "string" ? product : "")
      productText = p.name
      productUrl = p.url
      if (!p.name && !p.url) return NextResponse.json({ error: "쿠팡에서 공유한 글이나 상품 링크, 상품명을 넣어 주세요.", needsManualInput: true }, { status: 400 })
    }

    // Validate VIN
    if (!car && (!vin || !VIN_REGEX.test(vin.trim()))) {
      return NextResponse.json(
        { error: "올바른 차대번호(VIN) 17자리를 입력해주세요. (I, O, Q 제외 영숫자)" },
        { status: 400 }
      )
    }
    const normalizedVin = car ? "" : vin!.trim().toUpperCase()

    // Validate and sanitize product info
    let productInfo = typeof productText === "string" ? productText.trim().slice(0, 500) : ""
    let urlExtracted = false

    if (productUrl && typeof productUrl === "string" && !productInfo) {
      let parsedUrl: URL
      try {
        parsedUrl = new URL(productUrl.trim())
      } catch {
        return NextResponse.json({ error: "올바른 URL 형식이 아닙니다." }, { status: 400 })
      }

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return NextResponse.json({ error: "HTTP/HTTPS URL만 지원합니다." }, { status: 400 })
      }

      if (BLOCKED_HOSTNAMES.test(parsedUrl.hostname)) {
        return NextResponse.json({ error: "접근할 수 없는 주소입니다." }, { status: 400 })
      }

      const extracted = await extractProductInfoFromUrl(productUrl.trim())
      if (extracted) {
        productInfo = extracted
        urlExtracted = true
      }
    }

    if (!isUsefulProductInfo(productInfo)) {
      return NextResponse.json(
        {
          error: urlExtracted || productUrl
            ? "이 쇼핑몰 링크는 상품명을 자동으로 읽을 수 없어요. 상품명이나 품번을 직접 입력해주세요."
            : "상품 정보를 가져올 수 없습니다. 상품명이나 품번을 직접 입력해주세요.",
          needsManualInput: true,
        },
        { status: 422 }
      )
    }

    const safeCategory =
      typeof productCategory === "string" && productCategory.trim() ? productCategory.trim() : undefined

    // ── Cache-Aside: 구글시트 캐시 조회 ────────────────────────────────
    const vinPrefix = req2 ? req2.cacheKey : makeVinPrefix(normalizedVin)
    const useSheets = sheetsEnabled()

    let result
    let cacheHit = false

    if (useSheets) {
      const cached = await lookupCache(vinPrefix, productInfo)
      // 예전에 저장된 판정 불가 캐시는 쓰지 않고 다시 판정
      if (cached && cached.compatibility !== "UNCERTAIN") {
        result = cached
        cacheHit = true
      }
    }

    // 차량 정보 고정: 같은 차대번호(앞 11자리)는 항상 같은 차량 정보로 판정·표시
    let saveVehicle: (() => Promise<void>) | undefined
    if (result) {
      // 캐시 적중: 저장된 차량 정보가 있으면 표시만 맞춘다 (AI 호출 없음)
      const saved = req2 ? req2.vehicle : useSheets ? await lookupVehicleSpec(vinPrefix) : null
      if (saved) result = { ...result, vehicle_spec: saved }
    } else {
      // 캐시 미스 = AI를 실제로 부름 → 하루 조회 제한 확인 (캐시 결과는 세지 않음)
      const device = typeof body.device === "string" && /^[0-9a-f-]{36}$/.test(body.device) ? body.device : ""
      const keys = uid
        ? [{ who: `u:${uid}`, limit: PER_USER }]
        : [
            { who: `d:${device || ipAddr}`, limit: GUEST },
            { who: `ip:${ipAddr}`, limit: PER_IP },
          ]
      const states = await Promise.all(keys.map((k) => checkLimit(k.who, k.limit)))
      const limit = states.find((s) => s.reason === "global") ?? states.find((s) => !s.ok) ?? states[0]
      if (!limit.ok) {
        return NextResponse.json(
          {
            error:
              limit.reason === "global"
                ? "오늘은 확인 요청이 많아 AI 판정을 잠시 멈췄어요. 내일 다시 이용해 주세요. 그동안은 차종 페이지의 규격·순정 품번으로 직접 대조할 수 있어요."
                : uid
                  ? `AI 판정은 계정마다 하루 ${PER_USER}번까지예요. 내일 다시 이용해 주세요. 이미 누가 확인한 같은 차·같은 상품은 횟수와 상관없이 바로 보여 드려요.`
                  : `오늘 무료 확인 ${GUEST}번을 썼어요. 로그인하면 하루 ${PER_USER}번까지 쓸 수 있어요.`,
            limited: true,
            login: !uid && limit.reason !== "global",
          },
          { status: 429 }
        )
      }
      after(() => Promise.all(keys.map((k, i) => countUse(k.who, i === 0))))
      // 차량 정보 확정(저장본 또는 새로 해석) → 그 정보로 부품만 판정
      if (req2) {
        result = await verifyCompatibility(null, productInfo, safeCategory, req2.vehicle, req2.reference)
      } else {
        const fixed = await getFixedVehicleSpec(normalizedVin)
        saveVehicle = fixed?.save
        result = await verifyCompatibility(normalizedVin, productInfo, safeCategory, fixed?.spec)
      }
    }

    // 단정 표현 순화 + 결론에 확인 안내 (예전 캐시 결과에도 적용)
    result = softenResult(result)

    // 응답 후 백그라운드 저장: 캐시(미스일 때) + 행동 기록 (VIN은 해시만 — 개인정보 미저장)
    const vinHash = car ? null : createHash("sha256").update(normalizedVin).digest("hex").slice(0, 16)
    const finalResult = result
    after(async () => {
      if (saveVehicle) await saveVehicle()
      // 판정 불가(UNCERTAIN) 결과는 캐시하지 않음 → 다음 조회 때 다시 판정할 기회를 줌
      if (useSheets && !cacheHit && finalResult.compatibility !== "UNCERTAIN") {
        await writeCache(vinPrefix, productInfo, finalResult)
      }
      await logEvent({
        type: "verify",
        meta: {
          cacheHit,
          vinHash,
          carId: car?.id ?? null,
          category: safeCategory ?? null,
          product: productInfo.slice(0, 120),
          compatibility: finalResult.compatibility,
          model: finalResult.vehicle_spec?.manufacturer_model ?? null,
        },
      })
    })

    return NextResponse.json({
      ...result,
      productInfo,
      urlExtracted,
      productCategory: safeCategory ?? null,
      cacheHit,
    })
  } catch (err) {
    console.error("[verify]", err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: friendlyAiError(err) },
      { status: 500 }
    )
  }
}

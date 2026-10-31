import { NextRequest, NextResponse, after } from "next/server"
import { verifyCompatibility } from "@/lib/gemini"
import { lookupCache, writeCache, makeVinPrefix, logEvent, sheetsEnabled } from "@/lib/googleSheets"
import { createHash } from "crypto"

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i
// Block SSRF to private/loopback ranges
const BLOCKED_HOSTNAMES = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/

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

    const raw = ogTitle || title || null
    return raw ? raw.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { vin, productUrl, productText, productCategory } = body as {
      vin?: string
      productUrl?: string
      productText?: string
      productCategory?: string
    }

    // Validate VIN
    if (!vin || !VIN_REGEX.test(vin.trim())) {
      return NextResponse.json(
        { error: "올바른 차대번호(VIN) 17자리를 입력해주세요. (I, O, Q 제외 영숫자)" },
        { status: 400 }
      )
    }
    const normalizedVin = vin.trim().toUpperCase()

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

    if (!productInfo) {
      return NextResponse.json(
        {
          error: "상품 정보를 가져올 수 없습니다. 상품명이나 품번을 직접 입력해주세요.",
          needsManualInput: true,
        },
        { status: 422 }
      )
    }

    const safeCategory =
      typeof productCategory === "string" && productCategory.trim() ? productCategory.trim() : undefined

    // ── Cache-Aside: 구글시트 캐시 조회 ────────────────────────────────
    const vinPrefix = makeVinPrefix(normalizedVin)
    const useSheets = sheetsEnabled()

    let result
    let cacheHit = false

    if (useSheets) {
      const cached = await lookupCache(vinPrefix, productInfo)
      if (cached) {
        result = cached
        cacheHit = true
      }
    }

    if (!result) {
      // 캐시 미스 → Gemini API 호출
      result = await verifyCompatibility(normalizedVin, productInfo, safeCategory)
    }

    // 응답 후 백그라운드 저장: 캐시(미스일 때) + 행동 기록 (VIN은 해시만 — 개인정보 미저장)
    const vinHash = createHash("sha256").update(normalizedVin).digest("hex").slice(0, 16)
    const finalResult = result
    after(async () => {
      if (useSheets && !cacheHit) await writeCache(vinPrefix, productInfo, finalResult)
      await logEvent({
        type: "verify",
        meta: {
          cacheHit,
          vinHash,
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
    console.error("[verify]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "분석 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

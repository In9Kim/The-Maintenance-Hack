import { NextRequest, NextResponse } from "next/server"
import { verifyCompatibility } from "@/lib/gemini"
import { lookupCache, writeCache, makeVinPrefix, GEMINI_COST_PER_CALL_KRW } from "@/lib/googleSheets"
import { createHash } from "crypto"
import { existsSync, readFileSync, writeFileSync } from "fs"
import path from "path"

const HISTORY_PATH = path.join(process.cwd(), "data", "verified_history.json")
const CACHE_STATS_PATH = path.join(process.cwd(), "data", "cache_stats.json")
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i
// Block SSRF to private/loopback ranges
const BLOCKED_HOSTNAMES = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/

interface CacheStats {
  hits: number
  misses: number
  estimatedSavingsKrw: number
  lastUpdated: string
}

function readCacheStats(): CacheStats {
  try {
    if (existsSync(CACHE_STATS_PATH)) return JSON.parse(readFileSync(CACHE_STATS_PATH, "utf-8"))
  } catch { /* fallthrough */ }
  return { hits: 0, misses: 0, estimatedSavingsKrw: 0, lastUpdated: new Date().toISOString() }
}

function writeCacheStats(stats: CacheStats): void {
  try {
    writeFileSync(CACHE_STATS_PATH, JSON.stringify(stats, null, 2), "utf-8")
  } catch {
    console.warn("[verify] Could not write cache_stats.json")
  }
}

function readHistory(): Record<string, unknown>[] {
  if (!existsSync(HISTORY_PATH)) return []
  try {
    return JSON.parse(readFileSync(HISTORY_PATH, "utf-8"))
  } catch {
    return []
  }
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

    // ── Cache-Aside: Google Apps Script 캐시 조회 ────────────────────────
    const vinPrefix = makeVinPrefix(normalizedVin)
    const sheetsEnabled = !!process.env.APPS_SCRIPT_URL

    let result
    let cacheHit = false

    if (sheetsEnabled) {
      const cached = await lookupCache(vinPrefix, productInfo)
      if (cached) {
        result = cached
        cacheHit = true
        // 절감 통계 기록
        const stats = readCacheStats()
        stats.hits += 1
        stats.estimatedSavingsKrw = Math.round((stats.hits * GEMINI_COST_PER_CALL_KRW) * 100) / 100
        stats.lastUpdated = new Date().toISOString()
        writeCacheStats(stats)
      }
    }

    if (!result) {
      // 캐시 미스 → Gemini API 호출
      result = await verifyCompatibility(normalizedVin, productInfo, safeCategory)

      // 절감 통계 기록 (미스)
      const stats = readCacheStats()
      stats.misses += 1
      stats.lastUpdated = new Date().toISOString()
      writeCacheStats(stats)

      // 결과를 Google Sheets에 비동기 저장 (응답 속도에 영향 없음)
      if (sheetsEnabled) {
        writeCache(vinPrefix, productInfo, result).catch(() => {})
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    // Persist anonymized record (VIN is hashed — no PII stored)
    const vinHash = createHash("sha256").update(normalizedVin).digest("hex").slice(0, 16)
    const history = readHistory()
    history.push({
      timestamp: new Date().toISOString(),
      vinHash,
      productCategory: safeCategory ?? null,
      productInfo: productInfo.slice(0, 200),
      compatibility: result.compatibility,
      vehicle_spec: result.vehicle_spec,
      cacheHit,
    })
    try {
      writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8")
    } catch {
      // Non-critical: log but don't fail the request (read-only FS in prod)
      console.warn("[verify] Could not write verified_history.json")
    }

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

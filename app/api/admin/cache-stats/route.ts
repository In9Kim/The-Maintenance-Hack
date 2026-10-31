import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth"
import { getCacheRowCount, GEMINI_COST_PER_CALL_KRW } from "@/lib/googleSheets"
import { existsSync, readFileSync } from "fs"
import path from "path"

const CACHE_STATS_PATH = path.join(process.cwd(), "data", "cache_stats.json")

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
  return { hits: 0, misses: 0, estimatedSavingsKrw: 0, lastUpdated: "" }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  if (!(await verifyAdminToken(token ?? ""))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const stats = readCacheStats()
  const totalCalls = stats.hits + stats.misses
  const hitRate = totalCalls > 0 ? Math.round((stats.hits / totalCalls) * 100) : 0

  // Google Sheets 연동 여부 확인
  const sheetsEnabled = !!(
    process.env.GOOGLE_SHEET_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  )

  // 캐시 시트 행 수 (Google Sheets 연동 시에만)
  const cacheRowCount = sheetsEnabled ? await getCacheRowCount() : 0

  // 비용 추정 상세
  const costPerCallKrw = GEMINI_COST_PER_CALL_KRW
  const estimatedSavingsKrw = Math.round(stats.hits * costPerCallKrw * 100) / 100

  return NextResponse.json({
    sheetsEnabled,
    hits: stats.hits,
    misses: stats.misses,
    totalCalls,
    hitRate,
    estimatedSavingsKrw,
    costPerCallKrw,
    cacheRowCount,
    lastUpdated: stats.lastUpdated,
  })
}

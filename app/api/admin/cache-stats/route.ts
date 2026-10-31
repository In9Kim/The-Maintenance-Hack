import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth"
import { getCacheRowCount, getEventStats, sheetsEnabled, GEMINI_COST_PER_CALL_KRW } from "@/lib/googleSheets"

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  if (!(await verifyAdminToken(token ?? ""))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const enabled = sheetsEnabled()
  const [stats, cacheRowCount] = enabled ? await Promise.all([getEventStats(), getCacheRowCount()]) : [null, 0]
  const hits = stats?.verify.hits ?? 0
  const misses = stats?.verify.misses ?? 0
  const totalCalls = hits + misses

  return NextResponse.json({
    sheetsEnabled: enabled,
    hits,
    misses,
    totalCalls,
    hitRate: totalCalls > 0 ? Math.round((hits / totalCalls) * 100) : 0,
    estimatedSavingsKrw: Math.round(hits * GEMINI_COST_PER_CALL_KRW * 100) / 100,
    costPerCallKrw: GEMINI_COST_PER_CALL_KRW,
    cacheRowCount,
    lastUpdated: new Date().toISOString(),
  })
}

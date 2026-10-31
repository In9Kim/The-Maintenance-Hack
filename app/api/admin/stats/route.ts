import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth"
import { getEventStats } from "@/lib/googleSheets"
import { getAllCars } from "@/lib/data/all-cars"

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  if (!(await verifyAdminToken(token ?? ""))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [stats, cars] = await Promise.all([getEventStats(), getAllCars()])

  // 차종별 통계 집계 (쿠팡 이동은 3점, 공임나라 이동은 5점 가중)
  const carStats = cars.map((car) => {
    const views = stats.carViews[car.id] ?? 0
    const clicks = Object.entries(stats.partClicks)
      .filter(([key]) => key.startsWith(car.id + ":"))
      .reduce((sum, [, v]) => sum + v, 0)
    const gongimClicks = stats.gongimClicks[car.id] ?? 0
    return { car, views, clicks, gongimClicks, total: views + clicks * 3 + gongimClicks * 5 }
  })

  const topParts = Object.entries(stats.partClicks)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([key, count]) => ({ key, count }))

  return NextResponse.json({
    carStats: carStats.sort((a, b) => b.total - a.total),
    topParts,
    outbound: stats.outbound,
    byDay: stats.byDay,
    raw: stats,
  })
}

import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth"
import type { VehicleStats } from "@/types"
import type { CarModel } from "@/types"
import fs from "fs"
import path from "path"

function readStats(): VehicleStats {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "stats.json"), "utf-8"))
  } catch {
    return { carViews: {}, partClicks: {}, gongimClicks: {} }
  }
}

function readVehicles(): CarModel[] {
  const db = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "vehicles.json"), "utf-8"))
  return db.cars
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  if (!(await verifyAdminToken(token ?? ""))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const stats = readStats()
  const cars = readVehicles()

  // 차종별 통계 집계 (클릭 합산)
  const carStats = cars.map((car) => {
    const views = stats.carViews[car.id] ?? 0
    const clicks = Object.entries(stats.partClicks)
      .filter(([key]) => key.startsWith(car.id + ":"))
      .reduce((sum, [, v]) => sum + v, 0)
    const gongimClicks = stats.gongimClicks[car.id] ?? 0
    return { car, views, clicks, gongimClicks, total: views + clicks * 3 + gongimClicks * 5 }
  })

  // 부품별 클릭 Top 10
  const topParts = Object.entries(stats.partClicks)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([key, count]) => ({ key, count }))

  return NextResponse.json({
    carStats: carStats.sort((a, b) => b.total - a.total),
    topParts,
    raw: stats,
  })
}

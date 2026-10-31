import { NextRequest, NextResponse } from "next/server"
import type { VehicleStats } from "@/types"
import fs from "fs"
import path from "path"

const STATS_PATH = path.join(process.cwd(), "data", "stats.json")

function readStats(): VehicleStats {
  try {
    return JSON.parse(fs.readFileSync(STATS_PATH, "utf-8"))
  } catch {
    return { carViews: {}, partClicks: {}, gongimClicks: {} }
  }
}

function writeStats(stats: VehicleStats): void {
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2), "utf-8")
}

export async function POST(req: NextRequest) {
  try {
    const { type, carId, partId } = await req.json() as {
      type: "car_view" | "part_click" | "gongim_click"
      carId: string
      partId?: string
    }

    if (!type || !carId) {
      return NextResponse.json({ error: "type, carId는 필수입니다." }, { status: 400 })
    }

    const stats = readStats()

    if (type === "car_view") {
      stats.carViews[carId] = (stats.carViews[carId] ?? 0) + 1
    } else if (type === "part_click" && partId) {
      const key = `${carId}:${partId}`
      stats.partClicks[key] = (stats.partClicks[key] ?? 0) + 1
    } else if (type === "gongim_click") {
      stats.gongimClicks[carId] = (stats.gongimClicks[carId] ?? 0) + 1
    }

    try {
      writeStats(stats)
    } catch {
      // Vercel 등 read-only 환경에서는 무시
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "통계 기록 실패" }, { status: 500 })
  }
}

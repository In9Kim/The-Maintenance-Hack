import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth"
import type { CarModel } from "@/types"
import fs from "fs"
import path from "path"

function readDB(): { cars: CarModel[] } {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "vehicles.json"), "utf-8"))
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  if (!(await verifyAdminToken(token ?? ""))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = readDB()
    return NextResponse.json({ cars: db.cars })
  } catch {
    return NextResponse.json({ error: "데이터를 읽을 수 없습니다." }, { status: 500 })
  }
}

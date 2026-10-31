import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth"
import type { CarModel } from "@/types"
import fs from "fs"
import path from "path"

const DATA_PATH = path.join(process.cwd(), "data", "vehicles.json")

function readDB(): { cars: CarModel[] } {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"))
}

function writeDB(db: { cars: CarModel[] }): void {
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), "utf-8")
}

async function authorize(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  return verifyAdminToken(token ?? "")
}

// 차량 데이터 부분 업데이트 (is_verified 토글 등)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const updates = await req.json()
    const db = readDB()
    const idx = db.cars.findIndex((c) => c.id === params.id)
    if (idx === -1) return NextResponse.json({ error: "차종을 찾을 수 없습니다." }, { status: 404 })

    db.cars[idx] = { ...db.cars[idx], ...updates }
    writeDB(db)
    return NextResponse.json({ car: db.cars[idx] })
  } catch {
    return NextResponse.json({ error: "업데이트 중 오류가 발생했습니다." }, { status: 500 })
  }
}

// 차량 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = readDB()
    const before = db.cars.length
    db.cars = db.cars.filter((c) => c.id !== params.id)
    if (db.cars.length === before) {
      return NextResponse.json({ error: "차종을 찾을 수 없습니다." }, { status: 404 })
    }
    writeDB(db)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "삭제 중 오류가 발생했습니다." }, { status: 500 })
  }
}

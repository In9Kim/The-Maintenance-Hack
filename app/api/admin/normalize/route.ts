import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth"
import type { CarModel, DuplicateGroup } from "@/types"
import fs from "fs"
import path from "path"

const DATA_PATH = path.join(process.cwd(), "data", "vehicles.json")

function readDB(): { cars: CarModel[] } {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"))
}

function writeDB(db: { cars: CarModel[] }): void {
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), "utf-8")
}

function normalize(str: string): string {
  return str.toLowerCase().replace(/[\s\-_]/g, "").replace(/[^\w가-힣]/g, "")
}

function detectDuplicates(cars: CarModel[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = []
  const visited = new Set<string>()

  for (let i = 0; i < cars.length; i++) {
    if (visited.has(cars[i].id)) continue
    const group: CarModel[] = [cars[i]]

    for (let j = i + 1; j < cars.length; j++) {
      if (visited.has(cars[j].id)) continue
      const sameBrand = normalize(cars[i].brand) === normalize(cars[j].brand)
      if (!sameBrand) continue

      const normA = normalize(cars[i].model)
      const normB = normalize(cars[j].model)
      const modelSimilar =
        normA === normB || normA.includes(normB) || normB.includes(normA)

      if (modelSimilar) {
        group.push(cars[j])
        visited.add(cars[j].id)
      }
    }

    if (group.length > 1) {
      visited.add(cars[i].id)
      groups.push({ cars: group, reason: `브랜드+모델명 유사: ${cars[i].brand} ${cars[i].model}` })
    }
  }

  return groups
}

// 중복 감지 결과 반환
export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  if (!(await verifyAdminToken(token ?? ""))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = readDB()
  const duplicates = detectDuplicates(db.cars)
  return NextResponse.json({ duplicates, total: db.cars.length })
}

// 중복 병합: keepId 를 남기고 나머지 제거
export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  if (!(await verifyAdminToken(token ?? ""))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { keepId, removeIds } = await req.json() as { keepId: string; removeIds: string[] }
    if (!keepId || !Array.isArray(removeIds)) {
      return NextResponse.json({ error: "keepId, removeIds 필드가 필요합니다." }, { status: 400 })
    }

    const db = readDB()
    db.cars = db.cars.filter((c) => !removeIds.includes(c.id))
    // 유지 차종을 verified로 표시
    const keeper = db.cars.find((c) => c.id === keepId)
    if (keeper) keeper.is_verified = true
    writeDB(db)

    return NextResponse.json({ ok: true, removed: removeIds.length })
  } catch {
    return NextResponse.json({ error: "병합 처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}

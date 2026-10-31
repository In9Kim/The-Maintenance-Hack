import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth"
import { isBaseCar } from "@/lib/data/all-cars"
import { updateGeneratedCar, deleteGeneratedCars } from "@/lib/googleSheets"

type Ctx = { params: Promise<{ id: string }> }

const BASE_READONLY = NextResponse.json(
  { error: "기본 차종은 data/vehicles.json 파일에서 수정합니다. (AI 생성 차종만 여기서 수정 가능)" },
  { status: 400 }
)

async function authorize(req: NextRequest): Promise<boolean> {
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value ?? "")
}

// 생성 차종 부분 업데이트 (is_verified 토글 등)
export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await authorize(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await ctx.params
  if (isBaseCar(id)) return BASE_READONLY

  try {
    const car = await updateGeneratedCar(id, await req.json())
    if (!car) return NextResponse.json({ error: "차종을 찾을 수 없습니다." }, { status: 404 })
    return NextResponse.json({ car })
  } catch {
    return NextResponse.json({ error: "업데이트 중 오류가 발생했습니다." }, { status: 500 })
  }
}

// 생성 차종 삭제
export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!(await authorize(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await ctx.params
  if (isBaseCar(id)) return BASE_READONLY

  const removed = await deleteGeneratedCars([id])
  if (!removed) return NextResponse.json({ error: "차종을 찾을 수 없습니다." }, { status: 404 })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from "next/server"
import { generateAdminToken, verifyAdminToken, ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE } from "@/lib/admin-auth"

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()

    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "ADMIN_PASSWORD가 서버에 설정되지 않았습니다." }, { status: 503 })
    }

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 })
    }

    const token = await generateAdminToken()
    const res = NextResponse.json({ ok: true })
    res.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: ADMIN_COOKIE_MAX_AGE,
      path: "/",
    })
    return res
  } catch {
    return NextResponse.json({ error: "인증 처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  if (token && !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(ADMIN_COOKIE)
  return res
}

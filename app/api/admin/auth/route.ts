import { NextRequest, NextResponse } from "next/server"
import {
  checkAdminPassword,
  generateAdminToken,
  verifyAdminToken,
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAX_AGE,
} from "@/lib/admin-auth"
import { adminFail, adminLocked, adminReset, adminStore } from "@/lib/admin-limit"
import { clientIp } from "@/lib/client-ip"

export async function POST(req: NextRequest) {
  let password: unknown
  try {
    const body: unknown = await req.json()
    password = body && typeof body === "object" ? (body as { password?: unknown }).password : undefined
  } catch {
    return NextResponse.json({ error: "요청을 읽지 못했어요." }, { status: 400 })
  }
  try {
    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "ADMIN_PASSWORD가 서버에 설정되지 않았습니다." }, { status: 503 })
    }

    // 같은 IP가 10분에 5번 틀리면 10분 동안 막음 (lib/admin-limit.ts)
    const ip = clientIp(req.headers) // IPv6는 /64로 묶음
    const store = await adminStore()
    if (await adminLocked(store, ip)) {
      return NextResponse.json({ error: "여러 번 틀렸어요. 10분 뒤 다시 해 주세요." }, { status: 429 })
    }

    if (!(await checkAdminPassword(password))) {
      await adminFail(store, ip)
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 })
    }
    await adminReset(store, ip)

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

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
// 토큰 확인은 lib/admin-auth.ts 한 곳에서 (응답 시간이 일정한 비교 포함)
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith("/admin")) return NextResponse.next()
  if (pathname === "/admin/login") return NextResponse.next()

  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    // ADMIN_PASSWORD 미설정 시 접근 차단
    return NextResponse.redirect(new URL("/admin/login?error=config", request.url))
  }

  const token = request.cookies.get(ADMIN_COOKIE)?.value
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", request.url))
  }

  const valid = await verifyAdminToken(token)
  if (!valid) {
    const res = NextResponse.redirect(new URL("/admin/login", request.url))
    res.cookies.delete(ADMIN_COOKIE)
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}

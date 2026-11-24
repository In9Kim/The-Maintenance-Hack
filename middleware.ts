import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
// 토큰 확인은 lib/admin-auth.ts 한 곳에서 (응답 시간이 일정한 비교 포함)
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth"

/** 예전 주소(workers.dev)와 www로 들어오면 운영 도메인으로 영구 이동. 미리보기 주소(overhaul-… 등)는 그대로 둔다 */
const CANONICAL_HOST = "jungbihack.com"
const OLD_HOSTS = new Set(["maintenance-hack.wwe9459.workers.dev", "www.jungbihack.com"])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = (request.headers.get("host") ?? "").toLowerCase()
  if (OLD_HOSTS.has(host)) {
    const to = new URL(pathname + request.nextUrl.search, `https://${CANONICAL_HOST}`)
    return NextResponse.redirect(to, 301)
  }

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
  // 정적 파일은 빼고 모든 페이지 (주소 이동 때문에)
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}

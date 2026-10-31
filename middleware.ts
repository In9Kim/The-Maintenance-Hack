import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { ADMIN_COOKIE } from "@/lib/admin-auth"

const SALT = "maintenance-hack-admin-v1"

async function verifyToken(token: string, password: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(SALT))
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return token === expected
}

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

  const valid = await verifyToken(token, password)
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

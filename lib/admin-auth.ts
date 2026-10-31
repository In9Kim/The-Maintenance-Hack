// Simple HMAC-based admin token using Web Crypto API (works in Edge + Node.js 18+)

const SALT = "maintenance-hack-admin-v1"

async function deriveToken(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(SALT))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function generateAdminToken(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD
  if (!password) throw new Error("ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.")
  return deriveToken(password)
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD
  if (!password || !token) return false
  try {
    const expected = await deriveToken(password)
    return token === expected
  } catch {
    return false
  }
}

export const ADMIN_COOKIE = "admin_token"
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 8 // 8시간

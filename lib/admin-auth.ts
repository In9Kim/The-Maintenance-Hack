// Simple HMAC-based admin token using Web Crypto API (works in Edge + Node.js 18+)

// 토큰 = "만료시각(초).HMAC(비밀번호, SALT|만료시각)". 만료가 지나면 서버가 거절한다 (쿠키 maxAge만 믿지 않음)
const SALT = "maintenance-hack-admin-v2"

async function deriveToken(password: string, exp: number): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${SALT}|${exp}`))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * 비밀값 비교를 응답 시간이 일정하게 (=== 는 앞 글자부터 다르면 바로 끝나서 시간 차로 값이 새어 나갈 수 있음).
 * 두 값을 SHA-256으로 같은 길이(32바이트)로 만든 뒤 모든 바이트를 끝까지 비교한다. Workers·Node 둘 다 동작.
 */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ])
  const x = new Uint8Array(da)
  const y = new Uint8Array(db)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

/** 관리자 비밀번호 확인 (설정이 없거나 입력이 문자열이 아니면 false) */
export async function checkAdminPassword(input: unknown): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD
  if (!password || typeof input !== "string") return false
  return safeEqual(input, password)
}

export const ADMIN_COOKIE = "admin_token"
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 8 // 8시간

export async function generateAdminToken(now = Date.now()): Promise<string> {
  const password = process.env.ADMIN_PASSWORD
  if (!password) throw new Error("ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.")
  const exp = Math.floor(now / 1000) + ADMIN_COOKIE_MAX_AGE
  return `${exp}.${await deriveToken(password, exp)}`
}

export async function verifyAdminToken(token: string, now = Date.now()): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD
  if (!password || !token) return false
  const m = /^(\d{10,12})\.([0-9a-f]{64})$/.exec(token)
  if (!m) return false
  const exp = Number(m[1])
  const sec = Math.floor(now / 1000)
  // 만료됐거나, 발급 가능한 범위보다 먼 미래면 거절
  if (exp <= sec || exp > sec + ADMIN_COOKIE_MAX_AGE + 60) return false
  try {
    const expected = await deriveToken(password, exp)
    return await safeEqual(m[2], expected)
  } catch {
    return false
  }
}

/**
 * 부품 확인(/api/verify)에서 사용자가 준 상품 링크를 서버가 열기 전 검사 (SSRF 막기).
 * 내부·사설 주소(127.*, 10.*, [::1], 0.0.0.0, [::ffff:127.0.0.1] 등)는 열지 않고,
 * 리다이렉트는 자동으로 따라가지 않고 한 번씩 같은 검사를 거친 뒤에만 따라간다.
 * 주의: 이름(도메인)이 내부 주소로 풀리는 경우는 여기서 못 막는다(Workers에서는 내부망이 없어 위험이 낮음).
 */

/** IPv4 4칸 숫자 → 막아야 하면 true */
function blockedV4(a: number, b: number): boolean {
  if (a === 0 || a === 10 || a === 127) return true // 0.0.0.0/8, 사설, 루프백
  if (a === 169 && b === 254) return true // 링크 로컬(클라우드 메타데이터)
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // 통신사 NAT
  if (a === 198 && (b === 18 || b === 19)) return true // 벤치마크용
  if (a >= 224) return true // 멀티캐스트·예약
  return false
}

function parseV4(h: string): [number, number, number, number] | null {
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return null
  const n = m.slice(1).map(Number) as [number, number, number, number]
  return n.every((x) => x <= 255) ? n : null
}

/** URL.hostname(예: "127.0.0.1", "[::1]", "example.com")이 열면 안 되는 주소인지 */
export function isBlockedHost(hostname: string): boolean {
  let h = hostname.trim().toLowerCase().replace(/\.$/, "")
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1)
  if (!h) return true
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true

  const v4 = parseV4(h)
  if (v4) return blockedV4(v4[0], v4[1])

  if (h.includes(":")) {
    // IPv6. URL 파서가 줄여 쓴 꼴로 바꿔 준다 (예: ::ffff:127.0.0.1 → ::ffff:7f00:1)
    if (h === "::" || h === "::1") return true
    // IPv4를 품은 IPv6(::ffff:…, ::…, 64:ff9b::…)는 안의 IPv4로 판단하기 어려워 모두 막는다
    if (h.startsWith("::")) return true
    if (h.startsWith("64:ff9b:")) return true
    const first = parseInt(h.split(":")[0] || "0", 16)
    if ((first & 0xfe00) === 0xfc00) return true // fc00::/7 고유 로컬
    if ((first & 0xffc0) === 0xfe80) return true // fe80::/10 링크 로컬
    if ((first & 0xff00) === 0xff00) return true // 멀티캐스트
    return false
  }

  // 숫자만 있는 이상한 꼴(URL 파서가 못 바꾼 것)은 막는다
  if (/^[0-9.]+$/.test(h) || /^0x/.test(h)) return true
  return false
}

/** 열어도 되는 링크인지 (http/https + 내부 주소 아님). 바꾼 URL 또는 이유를 돌려준다 */
export function checkFetchUrl(raw: string, base?: string): { ok: true; url: URL } | { ok: false; reason: "format" | "protocol" | "blocked" } {
  let u: URL
  try {
    u = base ? new URL(raw, base) : new URL(raw)
  } catch {
    return { ok: false, reason: "format" }
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, reason: "protocol" }
  if (u.username || u.password) return { ok: false, reason: "blocked" }
  if (isBlockedHost(u.hostname)) return { ok: false, reason: "blocked" }
  return { ok: true, url: u }
}

export const MAX_REDIRECTS = 3

/**
 * 리다이렉트를 자동으로 따라가지 않고, 한 번마다 checkFetchUrl로 다시 검사하며 연다.
 * 막힌 주소로 가거나 너무 많이 돌면 null.
 */
export async function guardedFetch(
  start: string,
  init: RequestInit,
  doFetch: (url: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<Response | null> {
  let cur = checkFetchUrl(start)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!cur.ok) return null
    const res = await doFetch(cur.url.toString(), { ...init, redirect: "manual" })
    if (res.status < 300 || res.status >= 400) return res
    const loc = res.headers.get("location")
    res.body?.cancel().catch(() => {})
    if (!loc) return null
    cur = checkFetchUrl(loc, cur.url.toString())
  }
  return null
}

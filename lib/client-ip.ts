/**
 * 횟수 셀 때 쓰는 '접속 주소' 묶음. IPv6는 집·서버 하나가 /64(주소 2^64개)를 받아서,
 * 주소 전체로 세면 주소만 바꿔 가며 한도를 피할 수 있다 → 앞 64비트(4칸)로 묶어서 센다. IPv4는 그대로.
 */
export function ipBucket(ip: string): string {
  const raw = ip.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0]
  if (!raw.includes(":")) return raw || "unknown"
  // IPv4가 섞인 IPv6 (::ffff:1.2.3.4) → IPv4로
  const v4 = raw.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (v4 && /^(::ffff:|::)/.test(raw)) return v4[1]
  const [head, tail] = raw.split("::")
  const h = head ? head.split(":") : []
  const t = tail !== undefined && tail ? tail.split(":") : []
  const full = raw.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h
  if (full.length !== 8 || full.some((x) => !/^[0-9a-f]{1,4}$/.test(x))) return raw.slice(0, 64)
  return `${full.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, "")).join(":")}::/64`
}

/** 요청의 접속 주소 묶음 (Cloudflare가 붙이는 cf-connecting-ip 우선) */
export function clientIp(headers: { get(name: string): string | null }): string {
  return ipBucket(headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown")
}

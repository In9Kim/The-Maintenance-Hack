import { createHmac, createHash } from "crypto"
import { counterStore, takeCounters, type CounterSpec } from "@/lib/verify-limit"

/**
 * 쿠팡 파트너스 상품 검색 (서버 전용). 결과 링크는 파트너스 링크로 나온다.
 * 같은 검색어는 하루 동안 KV(VERIFY_LIMIT)에 저장해 다시 부르지 않는다 (호출 한도·속도).
 */
const PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/search"

export interface CoupangItem {
  productId: number
  name: string
  price: number
  url: string
  image?: string
  rocket: boolean
}

interface KV {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
}

async function kv(): Promise<KV | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare")
    return ((getCloudflareContext().env as unknown as { VERIFY_LIMIT?: KV }).VERIFY_LIMIT) ?? null
  } catch {
    return null
  }
}

function signedDate(d = new Date()) {
  const p = (x: number) => String(x).padStart(2, "0")
  return `${String(d.getUTCFullYear()).slice(-2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
}

/** 한 사람(IP 묶음 해시) 하루 검색 횟수 */
export const SEARCH_PER_USER = 60
/** 사이트 전체 하루 쿠팡 검색 상한 (같은 검색어는 하루 저장돼서 공짜). 파트너스 API 호출 제한을 넘겨 계정이 막히지 않게.
 *  쿠팡이 정한 정확한 호출 제한은 확인 필요 → 넘으면 저장된 결과·골라 둔 상품만 보여 줌 */
export const SEARCH_GLOBAL = 3000
const SEARCH_SPEC: CounterSpec = {
  globalKey: (day) => `csg:${day}`,
  key: (day, who) => `csu:${day}:${createHash("sha256").update(`${day}|${who}`).digest("hex").slice(0, 20)}`,
  globalMax: SEARCH_GLOBAL,
}
/** 쿠팡을 실제로 부르기 전에 센다 (IP 묶음·사이트 전체). 저장소가 없으면(로컬) 통과 */
export async function allowSearch(ip: string): Promise<boolean> {
  try {
    return (await takeCounters(await counterStore(), SEARCH_SPEC, [{ who: ip, limit: SEARCH_PER_USER }])) === "ok"
  } catch {
    return true
  }
}

/** gate: 저장된 결과가 없어 쿠팡을 실제로 부를 때만 한 번 묻는다 (false면 "LIMIT" 오류). 저장된 결과는 횟수에 안 셈 */
export async function coupangSearch(keyword: string, limit = 10, gate?: () => Promise<boolean>): Promise<CoupangItem[]> {
  const q = keyword.replace(/\s+/g, " ").trim().slice(0, 50)
  if (!q) return []
  const cacheKey = `cs:${createHash("sha256").update(`${q}|${limit}`).digest("hex").slice(0, 24)}`
  const store = await kv()
  const hit = await store?.get(cacheKey).catch(() => null)
  if (hit) return JSON.parse(hit) as CoupangItem[]
  if (gate && !(await gate())) throw new Error("LIMIT")

  const ak = process.env.COUPANG_ACCESS_KEY
  const sk = process.env.COUPANG_SECRET_KEY
  if (!ak || !sk) throw new Error("쿠팡 키 없음")
  const query = `keyword=${encodeURIComponent(q)}&limit=${limit}`
  const dt = signedDate()
  const sig = createHmac("sha256", sk).update(dt + "GET" + PATH + query).digest("hex")
  const r = await fetch(`https://api-gateway.coupang.com${PATH}?${query}`, {
    headers: { Authorization: `CEA algorithm=HmacSHA256, access-key=${ak}, signed-date=${dt}, signature=${sig}` },
  })
  const j = (await r.json().catch(() => ({}))) as { rCode?: string; data?: { productData?: Record<string, unknown>[] } }
  if (r.status !== 200 || String(j.rCode) !== "0") throw new Error(`쿠팡 검색 실패 ${r.status}`)
  const items: CoupangItem[] = (j.data?.productData ?? []).map((x) => ({
    productId: Number(x.productId),
    name: String(x.productName ?? ""),
    price: Number(x.productPrice ?? 0),
    url: String(x.productUrl ?? ""),
    image: typeof x.productImage === "string" ? x.productImage : undefined,
    rocket: !!x.isRocket,
  }))
  await store?.put(cacheKey, JSON.stringify(items), { expirationTtl: 86400 }).catch(() => {})
  return items
}

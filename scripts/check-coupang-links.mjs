/**
 * 쿠팡 파트너스 링크 점검 (매주 GitHub Actions에서 실행, .github/workflows/coupang-links.yml)
 *
 *  - 검색 링크(data/coupang-search-links.json): 쿠팡 검색 페이지로 이동하는지, 검색어·파트너 표시가 맞는지
 *  - 상품 링크(data/coupang-links.json): 쿠팡 상품 페이지로 이동하는지
 *    (쿠팡이 로봇 접속을 막아 "판매 종료" 여부까지는 자동으로 알 수 없음 → 상품 링크는 옵션(itemId) 없이 상품 단위로 넣는다)
 *
 * 문제가 하나라도 있으면 종료 코드 1 → GitHub가 저장소 주인에게 실패 메일을 보낸다.
 * 실행: node scripts/check-coupang-links.mjs
 */
import { readFileSync } from "node:fs"

const read = (p) => JSON.parse(readFileSync(p, "utf8"))
const search = read("data/coupang-search-links.json").links ?? {}
const products = read("data/coupang-links.json").links ?? {}

async function location(url) {
  const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (link check)" } })
  return { status: res.status, loc: res.headers.get("location") ?? "" }
}

const problems = []
const jobs = [
  ...Object.entries(search).map(([id, s]) => async () => {
    const { status, loc } = await location(s.url)
    if (status < 300 || status >= 400) return problems.push(`${id}: 이동 안 함 (${status})`)
    let u
    try { u = new URL(loc) } catch { return problems.push(`${id}: 이동 주소 오류`) }
    if (!u.hostname.endsWith("coupang.com") || !u.pathname.startsWith("/np/search")) problems.push(`${id}: 검색 페이지가 아님 (${u.hostname}${u.pathname})`)
    else if (u.searchParams.get("q") !== s.query) problems.push(`${id}: 검색어가 다름`)
    else if (!u.searchParams.get("lptag")) problems.push(`${id}: 파트너 표시(lptag) 없음`)
  }),
  ...Object.entries(products).flatMap(([id, list]) =>
    list.map((l) => async () => {
      const { status, loc } = await location(l.url)
      if (status < 300 || status >= 400 || !/coupang\.com\/vp\/products\//.test(loc)) problems.push(`${id}: 상품 링크 이동 이상 (${status})`)
    })
  ),
]

const queue = [...jobs]
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const job = queue.shift()
      try { await job() } catch (e) { problems.push(`요청 실패: ${e.message}`) }
      await new Promise((r) => setTimeout(r, 150))
    }
  })
)

console.log(`쿠팡 링크 점검: 검색 ${Object.keys(search).length}개, 상품 ${Object.values(products).flat().length}개, 문제 ${problems.length}건`)
for (const p of problems) console.log(" - " + p)
process.exit(problems.length ? 1 : 0)

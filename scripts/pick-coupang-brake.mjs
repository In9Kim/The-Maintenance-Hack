/**
 * 브레이크 패드 상신 품번(data/brake-pad-fitment.json)마다 쿠팡 상품 하나를 골라 data/coupang-picks.json에 "pad:품번" 키로 저장한다.
 *
 * 맞는 상품 판정 (애매하면 고르지 않는다)
 *  - 상품명에 그 품번이 정확히 있어야 (SP4464 또는 같은 번호의 하드론 HP4464. 끝 글자 A 등도 같아야)
 *  - 다른 번호의 품번이 같이 적힌 상품(앞·뒤나 여러 차종 중 고르는 옵션 상품)은 제외
 *  - 상품명에 "패드"와 상신(하이큐·하드론)이 있어야, 공임·장착 서비스는 제외
 *
 * 실행: node scripts/pick-coupang-brake.mjs   (.env.local 의 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY, 값은 출력하지 않음)
 */
import { readFileSync, writeFileSync } from "node:fs"
import { env, search } from "./pick-coupang-oil.mjs"

const OUT = "data/coupang-picks.json"

/** "SP4464" → { num: "4464", suffix: "" } */
const parse = (code) => {
  const m = code.match(/^[A-Z]{2}(\d{4})([A-Z]?)$/)
  return m ? { num: m[1], suffix: m[2] } : null
}

export function padMatches(title, code) {
  const p = parse(code)
  if (!p) return false
  const t = String(title).toUpperCase()
  if (!/패드|PAD/.test(t)) return false
  if (/공임|장착|교환권|라이닝만|출장/.test(t)) return false
  // 상신 정품만 (품번만 빌려 쓴 '호환' 상품 제외)
  if (!/상신|하이큐|하드론|SANGSIN|HI-?Q|HADRON/.test(t)) return false
  const own = new RegExp(`(?<![A-Z0-9])(?:SP|HP|RP|ZP)[ -]?${p.num}${p.suffix}(?![0-9A-Z])`)
  if (!own.test(t)) return false
  // 다른 상신 품번이 같이 적혀 있으면 옵션 상품 → 제외 (같은 번호의 SP/HP는 괜찮음)
  const all = [...t.matchAll(/(?<![A-Z0-9])(?:SP|HP|RP|ZP)[ -]?(\d{4}[A-Z]?)(?![0-9])/g)].map((m) => m[1])
  if (all.some((c) => c !== p.num + p.suffix)) return false
  return true
}

async function main() {
  const ak = env("COUPANG_ACCESS_KEY")
  const sk = env("COUPANG_SECRET_KEY")
  if (!ak || !sk) throw new Error(".env.local 에 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 가 없습니다")
  const fit = JSON.parse(readFileSync("data/brake-pad-fitment.json", "utf8")).parts
  const codes = [...new Set(Object.values(fit).flatMap((list) => list.map((o) => o.sp)))]
  const out = JSON.parse(readFileSync(OUT, "utf8"))
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  let ok = 0
  for (const code of codes) {
    const q = `상신 브레이크패드 ${code}`
    let items = []
    try {
      items = (await search(q, ak, sk)).map((x) => ({ ...x, _q: q }))
    } catch (e) {
      console.log(`  (검색 실패: ${q}) ${e.message}`)
    }
    await sleep(2500)
    if (!items.some((x) => padMatches(x.productName, code))) {
      // 다른 검색어로 한 번 더 (쿠팡 검색 결과가 검색어에 따라 많이 다름)
      try {
        for (const q2 of [`${code} 브레이크패드`, `${code} 상신 하이큐 패드`]) {
          items = [...items, ...(await search(q2, ak, sk)).map((x) => ({ ...x, _q: q2 }))]
          if (items.some((x) => padMatches(x.productName, code))) break
          await sleep(2500)
        }
      } catch {}
      await sleep(2500)
    }
    const cands = items.filter((x) => padMatches(x.productName, code))
    // 하이큐(SP)가 일반 교체용이라 먼저, 그다음 로켓배송 → 검색 순위
    const isQ = (x) => new RegExp(`SP[ -]?${code.slice(2)}`).test(x.productName.toUpperCase())
    cands.sort((a, b) => (isQ(b) ? 1 : 0) - (isQ(a) ? 1 : 0) || (b.isRocket ? 1 : 0) - (a.isRocket ? 1 : 0) || a.rank - b.rank)
    const it = cands[0]
    const key = `pad:${code}`
    if (it) {
      out.picks[key] = { kind: "pad", name: it.productName, price: it.productPrice, url: it.productUrl, image: it.productImage, rocket: !!it.isRocket, productId: it.productId, query: it._q, checkedAt: today }
      ok++
      console.log(`✔ ${code} ${it.productPrice}원 ${it.productName.slice(0, 70)}`)
    } else if (out.picks[key] && padMatches(out.picks[key].name, code)) {
      ok++ // 이번 검색에 안 나왔을 뿐, 전에 고른 상품이 규칙에 맞으면 그대로 둠
      console.log(`= ${code} 전에 고른 상품 유지`)
    } else {
      delete out.picks[key]
      console.log(`✗ ${code} 맞는 상품 없음 (검색 ${items.length}개)`)
    }
    writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n")
  }
  console.log(`골라짐 ${ok} / ${codes.length}`)
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("pick-coupang-brake.mjs")) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}

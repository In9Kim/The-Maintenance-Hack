/**
 * 이미 고른 쿠팡 상품(data/coupang-picks.json)의 가격을 매일 갱신한다.
 * 상품을 새로 고르지 않는다: 고를 때 쓴 검색어로 다시 검색해서 "같은 상품(productId)"이 나오면
 * 가격·링크·로켓배송 여부와 확인 날짜(checkedAt)만 바꾼다. 검색 결과에 없으면 그대로 둔다(화면에 옛 날짜가 보임).
 * 같은 검색어는 한 번만 부른다. 실행: node scripts/refresh-coupang-prices.mjs  (키 값은 출력하지 않음)
 */
import { readFileSync, writeFileSync } from "node:fs"
import { env, search } from "./pick-coupang-oil.mjs"

const FILE = "data/coupang-picks.json"

/** 저장된 상품 id. 예전 항목은 링크의 pageKey가 상품 id */
export function productIdOf(pick) {
  if (pick.productId) return String(pick.productId)
  try {
    return new URL(pick.url).searchParams.get("pageKey")
  } catch {
    return null
  }
}

async function main() {
  const ak = env("COUPANG_ACCESS_KEY")
  const sk = env("COUPANG_SECRET_KEY")
  if (!ak || !sk) throw new Error("COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 가 없습니다")
  const data = JSON.parse(readFileSync(FILE, "utf8"))
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const byQuery = new Map()
  for (const [id, p] of Object.entries(data.picks)) if (p.query) (byQuery.get(p.query) ?? byQuery.set(p.query, []).get(p.query)).push(id)

  let updated = 0, changed = 0, missing = 0, failed = 0
  for (const [q, ids] of byQuery) {
    let items = []
    try {
      items = await search(q, ak, sk)
    } catch (e) {
      failed++
      console.log(`검색 실패 (${q}): ${e.message}`)
      if (/429|limit|초과/i.test(e.message)) break // 호출 한도면 멈추고 지금까지만 저장
    }
    for (const id of ids) {
      const p = data.picks[id]
      const pid = productIdOf(p)
      const it = items.find((x) => String(x.productId) === pid)
      if (!it) {
        missing++
        continue
      }
      if (it.productPrice !== p.price) {
        changed++
        console.log(`${id}: ${p.price} → ${it.productPrice}`)
      }
      Object.assign(data.picks[id], { price: it.productPrice, url: it.productUrl, image: it.productImage, rocket: !!it.isRocket, productId: it.productId, checkedAt: today })
      updated++
    }
    await new Promise((r) => setTimeout(r, 2500))
  }
  writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n")
  console.log(`갱신 ${updated} (가격 바뀜 ${changed}), 검색에 안 나옴 ${missing}, 검색 실패 ${failed}`)
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("refresh-coupang-prices.mjs")) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}

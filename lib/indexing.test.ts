// 실행: npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import { isIndexableMaker, latestDate, MIN_INDEXABLE_RECALLS } from "./indexing.ts"
import { displayMaker } from "./recalls/display.ts"

test("latestDate: 가장 최근 날짜, 빈 값·미래·형식 틀린 값은 무시", () => {
  const today = "2026-11-14"
  assert.equal(latestDate(["2026-11-05", "2026-11-12", null, "", undefined], today), "2026-11-12")
  assert.equal(latestDate(["2026-11-05", "2026-12-01"], today), "2026-11-05")
  assert.equal(latestDate(["2026-11-14T00:00:00Z", "2026/11/10"], today), undefined)
  assert.equal(latestDate([], today), undefined)
})

test("제작사 페이지 색인: 리콜이 충분하고 이름 주소가 있을 때만", () => {
  assert.equal(isIndexableMaker({ slug: "hyundai", count: 141 }), true)
  assert.equal(isIndexableMaker({ slug: "polestar", count: MIN_INDEXABLE_RECALLS - 1 }), false)
  assert.equal(isIndexableMaker({ slug: "maker-49728a", count: 12 }), false)
  assert.equal(isIndexableMaker({ slug: "ibion", count: MIN_INDEXABLE_RECALLS }), true)
})

test("리콜 많은 제작사는 해시가 아닌 이름 주소", () => {
  assert.equal(displayMaker("주식회사 이비온").makerSlug, "ibion")
  assert.equal(displayMaker("(유)기흥모터스").makerSlug, "giheung-motors")
  assert.equal(displayMaker("(주) 한국모터트레이딩").makerSlug, "korea-motor-trading")
  // 이름이 비슷한 다른 회사는 따로
  assert.notEqual(displayMaker("기흥인터내셔널 유한회사").makerSlug, "giheung-motors")
  assert.notEqual(displayMaker("(주)한국모터스").makerSlug, "korea-motor-trading")
})

test("검색 페이지를 만드는 차종은 모두 updatedAt(사이트맵 lastmod)이 있다", () => {
  const { cars } = JSON.parse(fs.readFileSync("data/vehicles.json", "utf8")) as {
    cars: { id: string; updatedAt?: string; is_verified?: boolean }[]
  }
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  for (const c of cars.filter((c) => c.is_verified !== false)) {
    assert.match(c.updatedAt ?? "", /^\d{4}-\d{2}-\d{2}$/, `${c.id}: updatedAt 없음/형식 오류`)
    assert.ok(c.updatedAt! <= today, `${c.id}: updatedAt이 미래 날짜`)
  }
})

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const d = JSON.parse(readFileSync(new URL("../data/sales-ranking.json", import.meta.url), "utf8"))

test("판매 순위: 순위가 1부터 이어지고 판매량은 내림차순, 출처가 있다", () => {
  for (const list of [d.domestic, d.import]) {
    list.forEach((r: { rank: number; sales: number; source: string }, i: number) => {
      assert.equal(r.rank, i + 1)
      assert.ok(Number.isInteger(r.sales) && r.sales > 0)
      if (i) assert.ok(list[i - 1].sales >= r.sales, `순서 ${r.rank}`)
      assert.match(r.source, /^https:\/\//)
    })
  }
  assert.match(d.month, /^\d{4}-\d{2}$/)
})

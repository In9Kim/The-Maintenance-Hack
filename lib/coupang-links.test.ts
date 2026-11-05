// 실행: npm test — data/coupang-links.json의 모든 링크가 소모품 규격과 정확히 맞는지
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { checkCoupangLink, type CoupangSpecLink } from "./coupang-check.ts"
import type { MaintenancePart } from "../types/index.ts"

const read = (p: string) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"))
const cars = read("data/vehicles.json").cars as { parts: MaintenancePart[] }[]
const parts = new Map(cars.flatMap((c) => c.parts).map((p) => [p.id, p]))
const links = (read("data/coupang-links.json").links ?? {}) as Record<string, CoupangSpecLink[]>

test("모든 쿠팡 규격 링크는 소모품 품번·규격·엔진과 맞아야 한다", () => {
  for (const [partId, list] of Object.entries(links)) {
    for (const link of list) {
      assert.deepEqual(checkCoupangLink(parts.get(partId), link), [], `${partId} → ${link.product}`)
    }
  }
})

test("검사 규칙", () => {
  const part = { id: "x-oil-filter", spec: "오일필터", partNumber: "26300-2J000", engine: "2.5 T-GDi" } as MaintenancePart
  const ok: CoupangSpecLink = { url: "https://link.coupang.com/a/abc", product: "현대모비스 순정 오일필터 26300-2J000", matches: "263002J000", engine: "2.5 T-GDi" }
  assert.deepEqual(checkCoupangLink(part, ok), [])
  assert.ok(checkCoupangLink(part, { ...ok, url: "https://www.coupang.com/vp/products/1" }).length) // 파트너스 링크 아님
  assert.ok(checkCoupangLink(part, { ...ok, matches: "26300-35505" }).length) // 다른 품번
  assert.ok(checkCoupangLink(part, { ...ok, engine: undefined }).length) // 엔진 불일치
  assert.ok(checkCoupangLink(undefined, ok).length)
  const oil = { id: "x-oil", spec: "SAE 0W-30 · API SP · 5.8L", engine: "G2.5" } as MaintenancePart
  const oilLink: CoupangSpecLink = { url: "https://link.coupang.com/a/x", product: "0W-30 SP 1L", matches: ["0W-30", "API SP"], engine: "G2.5" }
  assert.deepEqual(checkCoupangLink(oil, oilLink), [])
  assert.ok(checkCoupangLink(oil, { ...oilLink, matches: ["0W-30", "ACEA C5"] }).length) // 규격 하나라도 다르면 실패
})

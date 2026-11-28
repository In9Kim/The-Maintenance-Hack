import { test } from "node:test"
import assert from "node:assert/strict"
import { dueList, type MyCar } from "./my-car.ts"
import { duePartIds, dueTexts } from "./calc-due.ts"

const car = {
  id: "kia-k3-bd",
  parts: [
    { id: "kia-k3-bd-engine-oil" },
    { id: "kia-k3-bd-wiper" },
    { id: "kia-k3-bd-brake-pad" },
    { id: "kia-k3-bd-cabin-filter" },
  ],
}

const my: MyCar = {
  id: "a",
  car: {
    id: "kia-k3-bd",
    name: "기아 K3 BD",
    parts: [
      { slug: "engine-oil", name: "엔진오일", intervalKm: 10000, intervalMonths: 12 },
      { slug: "wiper", name: "와이퍼", intervalMonths: 6 },
      { slug: "brake-pad", name: "브레이크패드", intervalKm: 40000 },
      { slug: "cabin-filter", name: "에어컨 필터", intervalMonths: 12 },
    ],
  },
  km: 61500,
  kmDate: "2026-11-24",
  records: {
    "engine-oil": { date: "2026-09-01", km: 50000 }, // 11,500km 지남 → over
    wiper: { date: "2026-06-10" }, // 5.5개월 → soon
    "brake-pad": { date: "2026-01-01", km: 55000 }, // ok
    // cabin-filter: 기록 없음 → unknown
  },
}

test("지남·곧 부품만 계산기 id로", () => {
  const ids = duePartIds(dueList(my, "2026-11-24"), car)
  assert.deepEqual(new Set(ids), new Set(["kia-k3-bd-engine-oil", "kia-k3-bd-wiper"]))
})

test("갈 때 된 부품의 상태 글자 (정비 탭과 같은 글자)", () => {
  const t = dueTexts(dueList(my, "2026-11-24"), car)
  assert.deepEqual(Object.keys(t).sort(), ["kia-k3-bd-engine-oil", "kia-k3-bd-wiper"])
  assert.equal(t["kia-k3-bd-engine-oil"], "1,500km 지남")
})

test("차에 없는 부품 slug는 무시", () => {
  const ids = duePartIds([{ state: "over", part: { slug: "timing-belt", name: "타이밍벨트" } }], car)
  assert.deepEqual(ids, [])
})

test("접두어 없는 부품 id도 slug로 비교", () => {
  const ids = duePartIds([{ state: "soon", part: { slug: "x", name: "x" } }], { id: "c", parts: [{ id: "x" }] })
  assert.deepEqual(ids, ["x"])
})

test("갈 때 된 부품이 없으면 빈 목록", () => {
  assert.deepEqual(duePartIds(dueList({ ...my, records: {} }, "2026-11-24"), car), [])
})

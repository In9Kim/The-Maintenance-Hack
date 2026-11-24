import { test } from "node:test"
import assert from "node:assert/strict"
import { partDue, dueList, type MyCar } from "./my-car.ts"

const oil = { slug: "engine-oil", name: "엔진오일", intervalKm: 10000, intervalMonths: 12 }
const wiper = { slug: "wiper", name: "와이퍼", intervalMonths: 6 }
const pad = { slug: "brake-pad", name: "브레이크패드", intervalKm: 40000 }

test("기록 없으면 unknown", () => {
  assert.equal(partDue(oil, { km: 50000, records: {} }, "2026-11-24").state, "unknown")
})

test("주행거리로 지남 판정", () => {
  const r = partDue(oil, { km: 61500, records: { "engine-oil": { date: "2026-09-01", km: 50000 } } }, "2026-11-24")
  assert.equal(r.state, "over")
  assert.equal(r.text, "1,500km 지남")
})

test("개월로 곧 교체 판정 (km 기록 없어도)", () => {
  const r = partDue(wiper, { km: 0, records: { wiper: { date: "2026-06-10" } } }, "2026-11-24")
  assert.equal(r.state, "soon")
  assert.match(r.text, /이번 달|1개월 남음/)
})

test("여유 있으면 ok, 남은 km 표시", () => {
  const r = partDue(pad, { km: 30000, records: { "brake-pad": { date: "2026-01-01", km: 20000 } } }, "2026-11-24")
  assert.equal(r.state, "ok")
  assert.equal(r.text, "30,000km 남음")
})

test("급한 순서로 정렬", () => {
  const my: MyCar = {
    car: { id: "x", name: "x", parts: [pad, wiper, oil] },
    km: 61500,
    kmDate: "2026-11-24",
    records: { "engine-oil": { date: "2026-09-01", km: 50000 }, "brake-pad": { date: "2026-01-01", km: 55000 } },
  }
  assert.deepEqual(dueList(my, "2026-11-24").map((d) => d.part.slug), ["engine-oil", "brake-pad", "wiper"])
})

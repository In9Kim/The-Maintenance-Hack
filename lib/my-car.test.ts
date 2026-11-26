import { test } from "node:test"
import assert from "node:assert/strict"
import { partDue, dueList, parseGarage, upsertCar, removeCar, type MyCar } from "./my-car.ts"

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

test("예전 한 대짜리 저장값을 차고로 옮긴다", () => {
  const old = JSON.stringify({ car: { id: "kia-k3-bd", name: "K3", parts: [] }, km: 1, kmDate: "2026-01-01", records: {} })
  const g = parseGarage(null, old, () => "u1")
  assert.equal(g.cars.length, 1)
  assert.equal(g.active, "u1")
  assert.equal(g.cars[0].id, "u1")
})

test("차 추가·삭제와 지금 차 바뀜", () => {
  const a: MyCar = { id: "a", car: { id: "x", name: "x", parts: [] }, km: 0, kmDate: "2026-01-01", records: {} }
  const b: MyCar = { ...a, id: "b" }
  let g = upsertCar(upsertCar({ cars: [], active: "" }, a), b)
  assert.deepEqual([g.cars.length, g.active], [2, "b"])
  g = upsertCar(g, { ...a, km: 5 })
  assert.deepEqual([g.cars.length, g.active, g.cars[0].km], [2, "a", 5])
  g = removeCar(g, "a")
  assert.deepEqual([g.cars.length, g.active], [1, "b"])
})

test("깨진 저장값이면 빈 차고", () => {
  assert.deepEqual(parseGarage("{bad", null), { cars: [], active: "" })
})

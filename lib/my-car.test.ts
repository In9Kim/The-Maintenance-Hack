import { test } from "node:test"
import assert from "node:assert/strict"
import { partDue, dueList, parseGarage, upsertCar, removeCar, nextAction, quickRecord, makeRecord, removeRecord, type MyCar } from "./my-car.ts"

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

test("다음 할 일: 급한 부품 → 사기, 기록 없으면 주기 짧은 부품부터 묻기, 모름은 건너뜀", () => {
  const base: MyCar = { car: { id: "x", name: "x", parts: [pad, wiper, oil] }, km: 61500, kmDate: "2026-11-24", records: {} }
  const a1 = nextAction(base, [], "2026-11-24")
  assert.equal(a1.type, "ask")
  assert.equal(a1.type === "ask" && a1.due.part.slug, "wiper") // 6개월(7,500km 상당) < 엔진오일 10,000km
  const a2 = nextAction(base, ["wiper"], "2026-11-24")
  assert.equal(a2.type === "ask" && a2.due.part.slug, "engine-oil")
  const a3 = nextAction({ ...base, records: { "engine-oil": { date: "2026-09-01", km: 50000 } } }, [], "2026-11-24")
  assert.equal(a3.type, "buy")
  assert.equal(a3.type === "buy" && a3.due.part.slug, "engine-oil")
  assert.equal(nextAction({ ...base, car: { id: "x:쉐보레 트랙스", name: "쉐보레 트랙스", parts: [] } }).type, "none")
})

test("대략 답 → 기록 (그때 주행거리는 한 달 1,250km로 추정)", () => {
  assert.deepEqual(quickRecord({ km: 67000 }, 12, "2026-11-27"), { date: "2025-11-27", km: 52000 })
  assert.deepEqual(quickRecord({ km: 0 }, 6, "2026-11-27"), { date: "2026-05-27" })
  // 추정값이 0 이하면 km를 넣지 않음 (0은 '모름'과 헷갈림)
  assert.deepEqual(quickRecord({ km: 5000 }, 12, "2026-11-27"), { date: "2025-11-27" })
})

test("예전에 km:0으로 저장된 기록은 주행거리 모름으로 본다", () => {
  const r = partDue(oil, { km: 63000, records: { "engine-oil": { date: "2026-11-28", km: 0 } } }, "2026-11-28")
  assert.equal(r.state, "ok")
  assert.equal(r.text, "12개월 남음")
})

test("지금 주행거리를 모르면 기록의 km로 계산하지 않는다", () => {
  const r = partDue(oil, { km: 0, records: { "engine-oil": { date: "2026-11-01", km: 50000 } } }, "2026-11-28")
  assert.equal(r.state, "ok")
  assert.match(r.text, /개월 남음|이번 달/)
})

test("km 주기만 있는 부품은 주행거리 없이 기록해도 대략 계산 (기록 필요로 숨지 않음)", () => {
  const r = partDue(pad, { km: 0, records: { "brake-pad": { date: "2024-11-28" } } }, "2026-11-28")
  assert.notEqual(r.state, "unknown")
  assert.equal(r.state, "ok") // 24개월 × 1,250 = 30,000km / 40,000km = 0.75
  assert.equal(r.text, "약 10,000km 남음")
})

test("기록 만들기: 미래 날짜는 오늘로, km 0은 빼기", () => {
  assert.deepEqual(makeRecord("2030-11-28", 63000, "2026-11-28"), { date: "2026-11-28", km: 63000 })
  assert.deepEqual(makeRecord("2026-01-02", 0, "2026-11-28"), { date: "2026-01-02" })
  assert.deepEqual(makeRecord("2026-01-02", undefined, "2026-11-28"), { date: "2026-01-02" })
})

test("기록 지우기", () => {
  const my = { records: { a: { date: "2026-01-01" }, b: { date: "2026-02-01" } } }
  assert.deepEqual(Object.keys(removeRecord(my, "a").records), ["b"])
  assert.deepEqual(Object.keys(my.records), ["a", "b"]) // 원본은 그대로
})

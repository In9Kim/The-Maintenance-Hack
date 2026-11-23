import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { zoneOf, isElectric, bodyTypeOf } from "./car-diagram.ts"

const cars = JSON.parse(readFileSync(new URL("../data/vehicles.json", import.meta.url), "utf8")).cars

test("브레이크는 앞/뒤로 나뉜다", () => {
  assert.equal(zoneOf({ category: "brake", name: "브레이크 패드 (전)" }), "front")
  assert.equal(zoneOf({ category: "brake", name: "브레이크 패드 (후)" }), "rear")
  assert.equal(zoneOf({ category: "brake", name: "브레이크 라이닝 (후, 드럼)" }), "rear")
  assert.equal(zoneOf({ category: "filter", name: "에어컨 필터" }), "cabin")
  assert.equal(zoneOf({ category: "filter", name: "에어클리너 필터" }), "engine")
  assert.equal(zoneOf({ category: "fluid", name: "감속기 오일 (4WD, 전·후)" }), "engine")
})

test("모든 차종: 차체 종류가 있고, 부위마다 최소 한 개 부품이 엔진룸·바퀴에 들어간다", () => {
  for (const car of cars) {
    assert.ok(["sedan", "suv", "van", "truck"].includes(bodyTypeOf(car)))
    const zones = new Set(car.parts.map(zoneOf))
    assert.ok(zones.has("engine"), car.id)
    assert.ok(zones.has("front") || zones.has("rear"), car.id)
  }
})

test("전기차 판별: 테슬라·아이오닉5만", () => {
  const ev = cars.filter(isElectric).map((c: { id: string }) => c.id).sort()
  assert.deepEqual(ev, ["hyundai-ioniq5-ne", "tesla-model3-highland", "tesla-modely"])
})

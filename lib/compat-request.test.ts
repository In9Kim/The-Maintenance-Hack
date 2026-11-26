import { test } from "node:test"
import assert from "node:assert/strict"
import { parseProductInput, buildCompatRequest, type CompatCar } from "./compat-request.ts"

test("쿠팡 공유 글에서 상품명과 링크를 나눈다", () => {
  const r = parseProductInput("[쿠팡] 불스원 레인OK 쏘렌토 MQ4 와이퍼 650mm+400mm 세트\nhttps://link.coupang.com/a/bXyZ12")
  assert.equal(r.url, "https://link.coupang.com/a/bXyZ12")
  assert.equal(r.name, "불스원 레인OK 쏘렌토 MQ4 와이퍼 650mm+400mm 세트")
})
test("링크만 있으면 상품명은 없음", () => {
  assert.deepEqual(parseProductInput("https://www.coupang.com/vp/products/123?itemId=4"), { url: "https://www.coupang.com/vp/products/123?itemId=4", name: undefined })
})
test("상품명·품번만 있어도 된다", () => assert.deepEqual(parseProductInput("26300-35505"), { url: undefined, name: "26300-35505" }))

const car: CompatCar = {
  id: "kia-k3-bd", brand: "기아", model: "K3", generation: "BD (2세대)", yearRange: "2018~2024",
  engineTypes: ["G1.6 가솔린", "G1.6 T-GDi 가솔린 (GT)"],
  parts: [
    { name: "엔진오일", spec: "SAE 0W-20 · 3.6L", engine: "G1.6 가솔린" },
    { name: "엔진오일 (GT)", spec: "SAE 0W-30", engine: "G1.6 T-GDi 가솔린 (GT)" },
    { name: "에어컨 필터", spec: "차종 전용", partNumber: "97133-F2000" },
  ],
}
test("AI에 넘기는 차량 정보·근거: 고른 엔진의 규격만, 품번 포함", () => {
  const r = buildCompatRequest(car, 2021, "G1.6 가솔린")
  assert.deepEqual(r.vehicle, { manufacturer_model: "기아 K3 BD (2세대)", production_year: "2021년형", engine_spec: "G1.6 가솔린" })
  assert.match(r.reference, /엔진오일: SAE 0W-20/)
  assert.doesNotMatch(r.reference, /0W-30/)
  assert.match(r.reference, /순정 품번 97133-F2000/)
  assert.equal(r.cacheKey, "car:kia-k3-bd|2021|G1.6 가솔린")
})
test("엔진을 안 고르면 후보를 모두 적고 그렇다고 밝힌다", () => {
  assert.match(buildCompatRequest(car).vehicle.engine_spec, /엔진 미선택/)
})

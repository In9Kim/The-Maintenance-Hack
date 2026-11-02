// 실행: npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { vinBrand, vinFacts, vinModelYear } from "./vin.ts"

const NOW = new Date("2026-11-02T00:00:00+09:00")

test("10번째 자리로 연식을 확정한다", () => {
  assert.equal(vinModelYear("KNAF241BEKA856318", NOW), 2019) // K
  assert.equal(vinModelYear("KNAGM4A77G5138862", NOW), 2016) // G
  assert.equal(vinModelYear("5YJ3E1EA0RF000001", NOW), 2024) // R
  assert.equal(vinModelYear("KMHXX00XXT0000001", NOW), 2026) // T
  assert.equal(vinModelYear("KMHXX00XXV0000001", NOW), 2027) // V = 내년 모델(연식 선출시)
  assert.equal(vinModelYear("KMHXX00XX90000001", NOW), 2009) // 9
  assert.equal(vinModelYear("KMHXX00XXW0000001", NOW), 1998) // W: 2028은 너무 미래라 1998
})

test("WMI 표에 있는 제조사만 확정한다", () => {
  assert.equal(vinBrand("KNAF241BEKA856318"), "기아")
  assert.equal(vinBrand("KMHD341CBLU000001"), "현대")
  assert.equal(vinBrand("LRW3E7FA1RC000001"), "테슬라")
  assert.equal(vinBrand("ZFA00000000000001"), null) // 표에 없으면 AI에 맡김
})

test("잘못된 차대번호는 아무것도 확정하지 않는다", () => {
  assert.deepEqual(vinFacts("KNAF241BEKA85631", NOW), { brand: null, modelYear: null }) // 16자리
  assert.deepEqual(vinFacts("KNAF241BEKA85631O", NOW), { brand: null, modelYear: null }) // O 포함
})

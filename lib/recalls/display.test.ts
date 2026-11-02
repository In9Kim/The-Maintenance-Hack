// 실행: npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { displayCarName, displayMaker } from "./display.ts"

test("회사 형태 표기만 다른 제작사는 하나로 합친다", () => {
  for (const raw of ["(주)볼보자동차코리아", "㈜볼보자동차코리아", "볼보자동차코리아(주)"]) {
    assert.deepEqual(displayMaker(raw), { makerSlug: "volvo", makerName: "볼보" })
  }
  for (const raw of ["(주)재규어랜드로버코리아", "㈜재규어랜드로버코리아"]) {
    assert.equal(displayMaker(raw).makerSlug, "jaguar-land-rover")
  }
  assert.equal(displayMaker("(주)GS글로벌").makerSlug, displayMaker("㈜GS글로벌").makerSlug)
  assert.equal(displayMaker("볼보트럭코리아(주)").makerSlug, "volvo-trucks")
  assert.equal(displayMaker("케이지모빌리티 주식회사(KG Mobility Corp.)").makerSlug, "kg-mobility")
})

test("표에 없는 제작사도 회사 표기 차이는 같은 주소로", () => {
  const a = displayMaker("(주)바이크코리아")
  const b = displayMaker("바이크코리아(주)")
  assert.equal(a.makerSlug, b.makerSlug)
  assert.equal(a.makerName, "바이크코리아")
})

test("차명 오타 정규화", () => {
  assert.equal(displayCarName("펠리세이드 하이브리드"), "팰리세이드 하이브리드")
  assert.equal(displayCarName("그랜져(GN7)"), "그랜저(GN7)")
  assert.equal(displayCarName("그랜져하이브리드(GN7HEV)"), "그랜저하이브리드(GN7HEV)")
  assert.equal(displayCarName("투싼(TL)"), "투싼(TL)")
  assert.equal(displayCarName("Model 3"), "Model 3")
})

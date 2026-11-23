import { test } from "node:test"
import assert from "node:assert/strict"
import { NEAR_KINDS, keepPlace, distanceText, haversine, nearKind, type KakaoPlace } from "./near.ts"

const place = (name: string, category: string): KakaoPlace => ({
  id: "1", place_name: name, category_name: category, phone: "", address_name: "", road_address_name: "", x: "127", y: "37", place_url: "", distance: "0",
})

test("공임나라: 자동차 정비 업종만 남기고 이름만 같은 가게는 뺀다", () => {
  const k = nearKind("gongim")!
  assert.equal(keepPlace(k, place("공임나라 서울강북점", "교통,수송 > 자동차 > 자동차정비")), true)
  assert.equal(keepPlace(k, place("노트북공임나라", "가정,생활 > 컴퓨터 > 컴퓨터수리")), false)
})

test("세차장: 세차 업종만", () => {
  const k = nearKind("carwash")!
  assert.equal(keepPlace(k, place("OO 셀프세차장", "서비스,산업 > 자동차 > 세차장")), true)
  assert.equal(keepPlace(k, place("OO 주유소", "교통,수송 > 자동차 > 주유소")), false)
})

test("종류 주소는 겹치지 않는다", () => {
  assert.equal(new Set(NEAR_KINDS.map((k) => k.slug)).size, NEAR_KINDS.length)
})

test("거리 표시와 계산", () => {
  assert.equal(distanceText(940), "940m")
  assert.equal(distanceText(1234), "1.2km")
  assert.equal(distanceText(23456), "23km")
  const d = haversine(37.5665, 126.978, 37.5665, 126.988)
  assert.ok(d > 850 && d < 900, String(d))
})

test("카센터: 정비 업종만, 튜닝·학원 제외", () => {
  const k = nearKind("carcenter")!
  assert.equal(keepPlace(k, place("서광카센타", "교통,수송 > 자동차 > 자동차정비")), true)
  assert.equal(keepPlace(k, place("팩트디자인 자동차 아카데미", "교통,수송 > 자동차 > 자동차정비")), false)
  assert.equal(keepPlace(k, place("OO세차", "교통,수송 > 자동차 > 세차장")), false)
})

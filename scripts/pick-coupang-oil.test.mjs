import { test } from "node:test"
import assert from "node:assert/strict"
import { setMatches, oilMatches, viscosityOf, gradeOf, displacementOf, yearsOf, carYears, litersOf } from "./pick-coupang-oil.mjs"

const ctx = { model: "쏘나타", code: "DN8", visc: "0W-20", grade: "SP", fuel: "가솔린", disp: "1.6", carNames: ["쏘나타", "K5", "셀토스"] }

test("규격 읽기", () => {
  assert.equal(viscosityOf("SAE 0W-30 · API SP"), "0W-30")
  assert.equal(viscosityOf("0w20 SP"), "0W-20")
  assert.equal(gradeOf("0W-20 SP/GF-6A"), "SP")
  assert.equal(gradeOf("ACEA C5, C2 또는 C3"), "C5")
})

test("차종 세트: 맞는 차·점도만 통과", () => {
  assert.ok(setMatches("쏘나타 DN8 가솔린 1.6 0W-20 C6 SP 에스오일 골드 #9 합성유 순정필터 엔진오일세트", ctx))
  assert.ok(!setMatches("K5 DL3 가솔린 1.6 0W-20 SP 엔진오일세트", ctx), "다른 차")
  assert.ok(!setMatches("쏘나타 DN8 하이브리드 0W-20 SP 엔진오일세트", ctx), "다른 연료")
  assert.ok(!setMatches("쏘나타 DN8 2.5 가솔린 0W-20 엔진오일세트", ctx), "다른 배기량")
  assert.ok(!setMatches("쏘나타 DN8 5W-30 엔진오일세트", ctx), "다른 점도")
})

test("단품 오일: 점도·등급·용량, 다른 차 전용 제외", () => {
  assert.ok(oilMatches("킥스 PAO 0W-20 SP 가솔린 엔진오일 4L", ctx))
  assert.ok(!oilMatches("0W-20 SP 엔진오일 1L", ctx), "용량 부족")
  assert.ok(!oilMatches("셀토스 0W-20 SP 4L 엔진오일세트", ctx), "다른 차 전용")
  assert.ok(!oilMatches("5W-30 SP 4L", ctx))
  assert.ok(!oilMatches("[몰리그린] 0W-20 SP 4L", ctx), "모르는 브랜드")
  assert.ok(!oilMatches("도요타 TOYOTA 순정 모터 오일 SP 0W-20 4L", ctx), "다른 제조사 순정")
})

test("배기량·세대·연료 구분", () => {
  const base = { model: "아반떼", code: "AD", visc: "0W-20", grade: "SP", fuel: "가솔린", disp: "1.6", turbo: false, multi: true, codes: ["AD", "CN7"] }
  assert.ok(!setMatches("올뉴 아반떼 CN7 1.6 가솔린 0W20 엔진오일 오일필터", base), "다른 세대")
  const dn8 = { model: "쏘나타", code: "DN8", visc: "0W-20", grade: "SP", fuel: "가솔린", disp: "2.0", turbo: false, multi: true, codes: [] }
  assert.ok(!setMatches("쏘나타 DN8 1.6 터보 가솔린 0W20 5L 엔진오일 세트", dn8), "G2.0 ↔ 1.6터보")
  const tuc = { model: "투싼", code: "NX4", visc: "0W-20", grade: "SP", fuel: null, disp: null, turbo: null, multi: false, codes: [] }
  assert.ok(!setMatches("투싼 하이브리드 (NX4) 1.6터보 가솔린 엔진오일세트 0W20", tuc), "연료 모르면 하이브리드 제외")
  const dsl = { model: "쏘렌토", code: "MQ4", visc: null, grade: "C5", fuel: "디젤", disp: "2.2", turbo: false, multi: true, codes: [] }
  assert.ok(!setMatches("투싼 NX4 2.0 디젤 엔진오일 세트 5W30", dsl))
  assert.ok(setMatches("쏘렌토 MQ4 2.2 디젤 엔진오일세트 킥스 C5 0W30", dsl))
  assert.equal(displacementOf("G2.0 가솔린"), "2.0")
})

test("연식으로 세대 확인 (코드 없는 상품명)", () => {
  assert.deepEqual(yearsOf("더 뉴 싼타페 하이브리드 20-23년식 킥스"), [20, 23])
  assert.deepEqual(yearsOf("코나 23년식 이후 킥스"), [23, 99])
  assert.deepEqual(carYears("2020~현재"), [20, 99])
  const tm = { model: "싼타페", code: "TM", years: [18, 23], visc: "0W-20", grade: "SP", fuel: "하이브리드", disp: "1.6", turbo: true, multi: true, codes: ["TM", "MX5"] }
  assert.ok(setMatches("현대 더 뉴 싼타페 가솔린 하이브리드 1.6 터보 20-23년 킥스 GX7 0W20 엔진오일세트", tm))
  assert.ok(!setMatches("싼타페 MX5 1.6 하이브리드 24년식 이후 0W20 엔진오일세트", tm), "다른 세대 코드")
  assert.ok(!setMatches("싼타페 1.6 하이브리드 24년식 이후 0W20 엔진오일세트", tm), "연식 안 겹침")
  assert.equal(litersOf("킥스 0W20 1L x 6"), 6)
  assert.equal(litersOf("지크 X7 0W30 4리터"), 4)
})

test("신형 첫해만 겹치면 제외", () => {
  const tm = { model: "싼타페", code: "TM", years: [20, 23], visc: "0W-30", grade: "SP", fuel: "가솔린", disp: "2.5", turbo: true, multi: true, codes: ["TM", "MX5"] }
  assert.ok(!setMatches("디올뉴 싼타페 2.5 터보 가솔린 23-26년식 킥스 GX7 0W30 6L 엔진오일 오일필터", tm))
})

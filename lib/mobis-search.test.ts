import { test } from "node:test"
import assert from "node:assert/strict"
import { isMobisBrand, mobisKeyword } from "./mobis-search.ts"

test("mobisKeyword: 확인된 검색어는 띄어쓰기 포함, 오일·액류는 없음", () => {
  assert.deepEqual(mobisKeyword({ name: "엔진오일 + 오일필터 (1.6 가솔린)", category: "oil" }), { word: "오일 필터", verified: true })
  assert.deepEqual(mobisKeyword({ name: "브레이크 패드 (전)", category: "brake" }), { word: "패드 키트", verified: true })
  assert.equal(mobisKeyword({ name: "브레이크 디스크 (전)", category: "brake" })?.word, "디스크")
  assert.equal(mobisKeyword({ name: "에어컨 필터 (캐빈)", category: "filter" })?.word, "에어컨")
  assert.equal(mobisKeyword({ name: "에어클리너 필터", category: "filter" })?.word, "클리너")
  assert.equal(mobisKeyword({ name: "브레이크액", category: "fluid" }), null)
})

test("isMobisBrand: 현대·기아·제네시스만", () => {
  assert.ok(isMobisBrand("기아"))
  assert.ok(!isMobisBrand("테슬라"))
  assert.ok(!isMobisBrand("KG모빌리티"))
})

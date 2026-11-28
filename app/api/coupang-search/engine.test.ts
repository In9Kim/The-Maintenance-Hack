// 실행: npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { enginesIn, filterByEngine, ourEngine } from "./engine.ts"

test("enginesIn: 하이브리드는 T-GDi가 같이 있어도 하이브리드만", () => {
  assert.deepEqual(enginesIn("기아 쏘렌토 MQ4 1.6 터보 하이브리드 0W20 5L 세트"), ["hybrid"])
  assert.deepEqual(enginesIn("쏘렌토 MQ4 2.5 T 터보 가솔린 합성 엔진오일세트"), ["gasoline"])
  assert.deepEqual(enginesIn("쏘렌토 MQ4 D2.2 디젤 엔진오일 C5"), ["diesel"])
  assert.deepEqual(enginesIn("쏘렌토 MQ4 엔진오일 필터"), [])
})

test("ourEngine: 부품 괄호 먼저, 없으면 등록한 엔진", () => {
  assert.equal(ourEngine("엔진오일 + 오일필터 (디젤)"), "diesel")
  assert.equal(ourEngine("엔진오일 + 오일필터 (가솔린)", "D2.2 디젤"), "gasoline")
  assert.equal(ourEngine("엔진오일 + 오일필터", "G2.5 T-GDi 가솔린"), "gasoline")
  assert.equal(ourEngine("브레이크 패드 (전)"), null)
})

test("filterByEngine: 다른 엔진만 적힌 상품은 빼고, 엔진 말이 없는 상품은 남김", () => {
  const items = [
    { name: "쏘렌토 MQ4 1.6 터보 하이브리드 오일 세트" },
    { name: "쏘렌토 MQ4 2.5 가솔린 오일세트" },
    { name: "쏘렌토 MQ4 오일필터" },
    { name: "쏘렌토 MQ4 디젤 엔진오일 세트" },
  ]
  assert.deepEqual(filterByEngine(items, "diesel").map((x) => x.name), ["쏘렌토 MQ4 오일필터", "쏘렌토 MQ4 디젤 엔진오일 세트"])
  assert.equal(filterByEngine(items, null).length, 4)
  assert.equal(filterByEngine([items[0]], "diesel").length, 1)
})

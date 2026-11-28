import { test } from "node:test"
import assert from "node:assert/strict"
import { parseSavedQuote, serializeQuote, shortCarLabel, garageChips, QUOTE_SAVED_TTL } from "./quote-saved.ts"

const result = { readable: true, shop: "오토큐", items: [{ name: "엔진오일" }], summary: "" }

test("저장한 견적서 결과를 다시 읽는다", () => {
  const s = serializeQuote({ carId: "kia-sorento-mq4", year: "2022", engine: "", result }, 1000)!
  const v = parseSavedQuote<typeof result>(s, ["kia-sorento-mq4"], 2000)
  assert.equal(v?.carId, "kia-sorento-mq4")
  assert.equal(v?.year, "2022")
  assert.deepEqual(v?.result, result)
})

test("오래된 결과·목록에 없는 차·모양이 다른 값은 버린다", () => {
  const s = serializeQuote({ carId: "kia-sorento-mq4", year: "", engine: "", result }, 0)!
  assert.equal(parseSavedQuote(s, ["kia-sorento-mq4"], QUOTE_SAVED_TTL + 1), null)
  assert.equal(parseSavedQuote(s, ["hyundai-avante-cn7"], 10), null)
  assert.equal(parseSavedQuote("{not json", ["kia-sorento-mq4"], 10), null)
  assert.equal(parseSavedQuote(JSON.stringify({ at: 0, carId: "kia-sorento-mq4", result: {} }), ["kia-sorento-mq4"], 10), null)
  assert.equal(parseSavedQuote(null, ["kia-sorento-mq4"], 10), null)
})

test("사진(data:image)이 섞인 결과는 저장하지 않는다", () => {
  assert.equal(serializeQuote({ carId: "a", year: "", engine: "", result: { items: [], img: "data:image/jpeg;base64,AAAA" } }), null)
})

test("차종 이름을 휴대폰 너비에 맞게 줄인다", () => {
  assert.equal(shortCarLabel("쏘렌토 MQ4 · 2020~현재"), "쏘렌토 MQ4 · 20~")
  assert.equal(shortCarLabel("K5 DL3 · 2020~2023"), "K5 DL3 · 20~23")
  assert.equal(shortCarLabel("레이"), "레이")
})

test("등록한 차 중 목록에 있는 차만, 같은 차는 한 번만 칩으로", () => {
  const chips = garageChips(
    [
      { id: "1", car: { id: "kia-sorento-mq4", name: "기아 쏘렌토 MQ4" }, year: 2022, engine: "D2.2 디젤" },
      { id: "2", car: { id: "x:쉐보레 올란도", name: "쉐보레 올란도" } },
      { id: "3", car: { id: "kia-carnival-ka4", name: "기아 카니발 KA4" } },
      { id: "4", car: { id: "kia-sorento-mq4", name: "기아 쏘렌토 MQ4" }, year: 2022, engine: "D2.2 디젤" },
    ],
    ["kia-sorento-mq4", "kia-carnival-ka4"],
  )
  assert.deepEqual(chips.map((c) => c.key), ["1", "3"])
  assert.equal(chips[0].year, "2022")
  assert.equal(chips[1].year, "")
})

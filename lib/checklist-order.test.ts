import { test } from "node:test"
import assert from "node:assert/strict"
import { splitChecklistParts, cardIntervalText } from "./checklist-order.ts"

const parts = [
  { id: "c-brake-front", name: "브레이크 패드 (전)" },
  { id: "c-wiper", name: "와이퍼 블레이드 (전면)" },
  { id: "c-oil", name: "엔진오일 + 오일필터 (가솔린)" },
  { id: "c-battery", name: "배터리 (12V)" },
  { id: "c-cabin", name: "에어컨 필터 (캐빈)" },
  { id: "c-air", name: "에어클리너 필터" },
  { id: "c-plug", name: "점화플러그 (4개)" },
]
const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

test("내 차가 없으면 많이 찾는 4개를 정해진 순서로", () => {
  const { top, rest } = splitChecklistParts(parts)
  assert.deepEqual(ids(top), ["c-oil", "c-cabin", "c-air", "c-wiper"])
  assert.deepEqual(ids(rest), ["c-brake-front", "c-battery", "c-plug"])
})

test("내 차가 있고 갈 때 된 부품이 있으면 그 부품만 dueIds 순서로 위에", () => {
  const { top, rest } = splitChecklistParts(parts, { hasMyCar: true, dueIds: ["c-plug", "c-oil", "없는-id"] })
  assert.deepEqual(ids(top), ["c-plug", "c-oil"])
  assert.equal(rest.length, parts.length - 2)
  assert.ok(!rest.some((p) => p.id === "c-plug" || p.id === "c-oil"))
})

test("내 차가 있는데 갈 때 된 부품이 0개면 많이 찾는 부품으로", () => {
  const { top } = splitChecklistParts(parts, { hasMyCar: true, dueIds: [] })
  assert.deepEqual(ids(top), ["c-oil", "c-cabin", "c-air", "c-wiper"])
})

test("내 차가 없으면 dueIds가 와도 쓰지 않는다", () => {
  const { top } = splitChecklistParts(parts, { hasMyCar: false, dueIds: ["c-plug"] })
  assert.equal(top[0].id, "c-oil")
})

test("주소 ?part= 로 미리 체크된 부품은 내 차가 없어도 맨 위에 (접힌 목록에 숨지 않게)", () => {
  const { top, rest } = splitChecklistParts(parts, { pinIds: ["c-brake-front"] })
  assert.deepEqual(ids(top), ["c-brake-front"])
  assert.ok(!rest.some((p) => p.id === "c-brake-front"))
})

test("데이터에 없는 인기 부품은 건너뛴다", () => {
  const { top, rest } = splitChecklistParts([parts[0], parts[2], parts[3]])
  assert.deepEqual(ids(top), ["c-oil"])
  assert.deepEqual(ids(rest), ["c-brake-front", "c-battery"])
})

test("교체 주기 한 줄", () => {
  assert.equal(cardIntervalText("15,000km 또는 12개월"), "15,000km·12개월마다")
  assert.equal(cardIntervalText("24개월"), "24개월마다")
  assert.equal(cardIntervalText(null), null)
})

import { test } from "node:test"
import assert from "node:assert/strict"
import { buildQuotePrompt, QUOTE_SCHEMA, type QuoteCarPart } from "./quote-analyze.ts"

const car = { id: "kia-k3-bd", brand: "기아", model: "K3", generation: "BD (2세대)", yearRange: "2018~2024", engineTypes: ["G1.6 가솔린", "G1.6 T-GDi 가솔린 (GT)"], parts: [] }
const parts: QuoteCarPart[] = [
  { id: "oil", name: "엔진오일", spec: "0W-20", engine: "G1.6 가솔린", coupangPrice: 38000, laborCost: 12000, dealerPartPrice: 60000, dealerLaborCost: 27000 },
  { id: "oil-gt", name: "엔진오일 (GT)", spec: "0W-30", engine: "G1.6 T-GDi 가솔린 (GT)", coupangPrice: 45000, laborCost: 12000, dealerPartPrice: 70000, dealerLaborCost: 27000 },
  { id: "disc", name: "브레이크 디스크 (전)", spec: "좌우 세트", coupangPrice: 61000, laborCost: 40000, dealerPartPrice: 120000, dealerLaborCost: 60000 },
]

test("고른 엔진의 소모품만 근거로 넘긴다", () => {
  const p = buildQuotePrompt(car, parts, 2019, "G1.6 가솔린")
  assert.match(p, /id=oil \|/)
  assert.doesNotMatch(p, /id=oil-gt/)
  assert.match(p, /id=disc/)
  assert.match(p, /2019년형/)
})
test("개인정보를 출력하지 말라는 지시가 들어 있다", () => assert.match(buildQuotePrompt(car, parts), /이름·전화번호·차량번호/))
test("출력 형식: 판정은 세 가지뿐", () => {
  assert.deepEqual(QUOTE_SCHEMA.properties.items.items.properties.verdict.enum, ["gongim", "center", "ask"])
})

test("quoteSearchWord: 작업·위치 말은 빼고 부품 이름만", async () => {
  const { quoteSearchWord } = await import("./quote-analyze.ts")
  assert.equal(quoteSearchWord("프론트 하부암(좌/우) 교환 요망"), "로어암")
  assert.equal(quoteSearchWord("쇽업소버 교환"), "쇼바")
  assert.equal(quoteSearchWord("프론트하부암어셈블리"), "로어암")
  assert.equal(quoteSearchWord("프론트속업소버어셈블리"), "쇼바")
  assert.equal(quoteSearchWord("라디에이터호스어셈블리2EA(상&하)"), "라디에이터호스")
  assert.equal(quoteSearchWord("엔진브라켓어셈블리SET"), "엔진미미")
  assert.equal(quoteSearchWord("워터펌프교체"), "워터펌프")
  assert.equal(quoteSearchWord("라디에이터 호스, 워터 호스 교환"), "라디에이터 호스")
  assert.equal(quoteSearchWord("미션오일 4L 교환 권장"), "미션오일")
})

test("needsSpecCheck: 미션오일·ATF는 규격 확인", async () => {
  const { needsSpecCheck } = await import("./quote-analyze.ts")
  assert.equal(needsSpecCheck("미션오일"), true)
  assert.equal(needsSpecCheck("오토미션 ATF 교환"), true)
  assert.equal(needsSpecCheck("엔진오일"), false)
})

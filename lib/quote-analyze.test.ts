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

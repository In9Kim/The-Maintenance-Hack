import { test } from "node:test"
import assert from "node:assert/strict"
import { orderCoupangItems } from "./coupang-order.ts"

const items = [
  { productId: 1, price: 60200, name: "하이브리드 세트" },
  { productId: 2, price: 61040, name: "가솔린 세트" },
  { productId: 3, price: 30000, name: "오일" },
  { productId: 4, price: 70000, name: "디젤 세트" },
  { productId: 5, price: 20000, name: "기타" },
]

test("골라 둔 상품이 4번째에 있어도 맨 앞에 나온다", () => {
  const out = orderCoupangItems(items, 4)
  assert.equal(out.length, 3)
  assert.equal(out[0].productId, 4)
  // 나머지는 상위 2개를 가격순
  assert.deepEqual(out.slice(1).map((x) => x.productId), [1, 2])
})

test("골라 둔 상품이 없으면 상위 3개를 가격순", () => {
  assert.deepEqual(orderCoupangItems(items, null).map((x) => x.productId), [3, 1, 2])
  assert.deepEqual(orderCoupangItems(items, 99).map((x) => x.productId), [3, 1, 2])
})

test("productId가 문자열이어도 같은 상품으로 본다", () => {
  const out = orderCoupangItems([{ productId: "7", price: 1 }, { productId: "8", price: 2 }], 8)
  assert.equal(out[0].productId, "8")
})

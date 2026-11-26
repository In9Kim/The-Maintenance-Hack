import { test } from "node:test"
import assert from "node:assert/strict"
import { addItem, hasItem, parseShopLists, phoneScript, removeItem } from "./shop-list.ts"

test("parseShopLists: 깨진 값은 빈 목록, 이름 없는 항목은 버림", () => {
  assert.deepEqual(parseShopLists(null), {})
  assert.deepEqual(parseShopLists("{"), {})
  assert.deepEqual(parseShopLists("[]"), {})
  assert.deepEqual(parseShopLists(JSON.stringify({ a: [{ name: "엔진오일" }, { name: "  " }, 3, null], b: "x" })), { a: [{ name: "엔진오일" }] })
})

test("addItem/removeItem: slug가 있으면 slug로, 없으면 이름으로 같은 항목 판단", () => {
  let l = addItem([], { slug: "engine-oil", name: "엔진오일" })
  l = addItem(l, { slug: "engine-oil", name: "엔진오일 (다른 이름)" })
  l = addItem(l, { name: " 하부암 " })
  l = addItem(l, { name: "하부암" })
  assert.equal(l.length, 2)
  assert.equal(l[1].name, "하부암")
  assert.ok(hasItem(l, { name: "하부암" }))
  l = removeItem(l, { slug: "engine-oil", name: "x" })
  assert.deepEqual(l, [{ name: "하부암" }])
})

test("phoneScript: 차와 부품 이름이 들어감", () => {
  const s = phoneScript("기아 K3 2019년형 가솔린 1.6", [{ name: "엔진오일" }, { name: "브레이크 디스크" }])
  assert.match(s, /K3 2019년형/)
  assert.match(s, /엔진오일, 브레이크 디스크/)
})

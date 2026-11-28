import { test } from "node:test"
import assert from "node:assert/strict"
import { packLiters, oilNeedText } from "./oil-pack.ts"

test("상품명에서 용량 읽기", () => {
  assert.equal(packLiters("지크 X9 5W30 4L"), 4)
  assert.equal(packLiters("킥스 G1 5W-30 1L x 6개"), 6)
  assert.equal(packLiters("모빌1 0W20 1L 4개"), 4)
  assert.equal(packLiters("엔진오일 5W30"), null)
})

test("모자라는 양을 계산 (4L에 필요량 5.8L면 1.8L 더)", () => {
  assert.equal(oilNeedText(5.8, "지크 4L"), "필요량은 5.8L인데 이 상품은 4L라 1.8L 더 필요해요.")
  assert.equal(oilNeedText(4.2, "1L x 6개"), "필요량은 4.2L라 이 상품 하나면 돼요.")
  assert.equal(oilNeedText(5, "엔진오일"), "필요량은 5L예요. 용량이 모자라면 모자란 만큼 더 사세요.")
})

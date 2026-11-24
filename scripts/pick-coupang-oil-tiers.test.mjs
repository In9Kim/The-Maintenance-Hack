import { test } from "node:test"
import assert from "node:assert/strict"
import { totalLiters, specOk } from "./pick-coupang-oil-tiers.mjs"

test("용량 계산", () => {
  assert.equal(totalLiters("킥스 GX7 SP 0W-20 4L+1L"), 5)
  assert.equal(totalLiters("모빌1 0W-20 1L 4개"), 4)
  assert.equal(totalLiters("지크 X7 0W30 4리터"), 4)
})

test("규격 표기 확인", () => {
  assert.ok(specOk("킥스 PAO 0W-20 SP 4L", { visc: "0W-20", diesel: false }))
  assert.ok(specOk("킥스 0W-20 4L", { visc: "0W-20", diesel: false }), "가솔린은 등급 없어도 통과 (화면에 확인 필요 표시)")
  assert.ok(!specOk("헬리우스 0W20 DPF 디젤 C5 1L", { visc: "0W-20", diesel: false }), "가솔린 자리에 디젤 전용")
  assert.ok(specOk("킥스 D1 C3 5W-30 6L 디젤", { visc: "5W-30", diesel: true }))
  assert.ok(!specOk("킥스 SP 5W-30 4L", { visc: "5W-30", diesel: true }))
})

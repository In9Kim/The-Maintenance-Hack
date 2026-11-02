// 실행: npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { CONFIRM_NOTICE, softenText, withConfirmNotice } from "./compat-wording.ts"

test("단정 표현을 걷어낸다", () => {
  assert.equal(softenText("확정 호환 부품입니다"), "호환 가능성 높음 부품입니다")
  assert.equal(
    softenText("2019년식 K3에 완벽히 호환되는 순정 품번입니다."),
    "2019년식 K3에 호환되는 순정 품번입니다."
  )
  assert.equal(softenText("100% 일치합니다."), "일치합니다.")
  assert.equal(
    softenText("규격이 맞습니다. 안심하고 구매하셔도 좋습니다."),
    "규격이 맞습니다."
  )
  for (const bad of ["완벽", "100%", "안심하고", "확정 호환"]) {
    assert.equal(softenText(`이 부품은 ${bad} 장착 가능`).includes(bad), false, bad)
  }
})

test("결론에는 항상 확인 안내가 붙는다", () => {
  const out = withConfirmNotice("해당 부품은 2019년식 올 뉴 K3 1.6 GDi 차량에 완벽히 호환되는 순정 품번이므로 안심하고 구매를 결정하셔도 좋습니다.")
  assert.equal(out.endsWith(CONFIRM_NOTICE), true)
  assert.equal(/완벽|안심/.test(out), false)
  // 이미 안내가 있으면 중복으로 붙이지 않음
  const once = withConfirmNotice(`호환 가능성이 높습니다. ${CONFIRM_NOTICE}`)
  assert.equal(once.split(CONFIRM_NOTICE).length - 1, 1)
  assert.equal(withConfirmNotice(""), CONFIRM_NOTICE)
})

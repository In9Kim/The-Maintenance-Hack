// 실행: npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { matchHome, matchCare, matchQuote, matchNear, matchMore } from "./nav-match.ts"

const TABS = { 홈: matchHome, 정비: matchCare, 견적서: matchQuote, 정비소: matchNear, 더보기: matchMore }

/** 주소마다 불 켜지는 탭이 정확히 하나여야 함 */
const lit = (p: string) => Object.entries(TABS).filter(([, m]) => m(p)).map(([k]) => k)

test("주소별로 맞는 탭 하나에만 불", () => {
  const cases: [string, string][] = [
    ["/", "홈"],
    ["/cars", "홈"],
    ["/cars/kia-k3-bd", "홈"],
    ["/cars/kia-k3-bd/engine-oil", "홈"],
    ["/cars/kia-k3-bd/maintenance-schedule", "홈"],
    ["/inbox", "홈"],
    ["/my", "정비"],
    ["/cars/kia-k3-bd/recalls", "정비"],
    ["/quote", "견적서"],
    ["/near", "정비소"],
    ["/near/carwash", "정비소"],
    ["/more", "더보기"],
    ["/info", "더보기"],
    ["/privacy", "더보기"],
    ["/check", "더보기"],
    ["/recalls", "더보기"],
    ["/recalls/maker/kia", "더보기"],
    ["/calculator", "더보기"],
    ["/shop-card", "더보기"],
  ]
  for (const [p, tab] of cases) assert.deepEqual(lit(p), [tab], p)
})

test("차 리콜 페이지는 '홈'이 아니라 '정비'", () => {
  assert.equal(matchHome("/cars/kia-k3-bd/recalls"), false)
  assert.equal(matchCare("/cars/kia-k3-bd/recalls"), true)
})

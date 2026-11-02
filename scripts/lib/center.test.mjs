// 실행: npm test
// 원문은 자동차리콜센터 리콜현황 게시판(2026-11-03 확인) 목록·상세 HTML
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { normDate, parseCenterDetail, parseCenterList, parseCenterTotal, splitCarNames } from "./center.mjs"

const fx = (name) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8")

test("목록에서 리콜 ID·제목·시정 시작일·중대리콜 여부를 읽는다", () => {
  const html = fx("carkr-list.html")
  const rows = parseCenterList(html)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    recallId: "6413",
    ctype: "O",
    title: "[현대] 아반떼 등 2차종 - 운전석 에어백 인플레이터 관련 리콜",
    date: "2026-10-14",
    serious: false,
  })
  assert.equal(rows[1].recallId, "6379")
  assert.equal(rows[1].serious, true)
  assert.equal(rows[1].title.includes("중대리콜"), false)
  assert.equal(parseCenterTotal(html), 4542)
})

test("상세 표를 읽고 차명별 생산기간을 나눈다", () => {
  const r = parseCenterDetail(fx("carkr-detail-6379.html"))
  assert.equal(r.maker, "현대자동차(주)")
  assert.equal(r.startDate, "2026-09-21")
  assert.equal(r.count, 10566)
  assert.equal(r.part, "원동기(동력발생장치) 기타")
  assert.equal(r.fix, "개선된 저압연료라인 어셈블리 교환 및 점검 후 필요 시 교환")
  assert.equal(r.reason.endsWith("리콜"), true)
  assert.equal(r.reason.includes("대상차량별"), false)
  assert.deepEqual(r.items, [
    { name: "G80 (RG3)", from: "2020-03-10", to: "2021-12-30" },
    // 원문 "2020.07. 29"처럼 띄어 쓴 날짜도 읽는다
    { name: "GV70 (JK)", from: "2020-07-29", to: "2024-05-02" },
  ])
})

test("차명별 생산기간이 없으면 전체 생산기간을 쓴다", () => {
  const r = parseCenterDetail(fx("carkr-detail-6408.html"))
  assert.equal(r.maker, "폭스바겐그룹코리아 주식회사")
  assert.deepEqual(r.items, [{ name: "Atlas 2.0 TSI 4M", from: "2025-02-11", to: "2026-05-08" }])
  assert.equal(r.startDate, "2026-10-15")
  assert.equal(r.count, 2335)
  assert.equal(r.fix, "소프트웨어 업데이트")
})

test("표가 없으면 null", () => {
  assert.equal(parseCenterDetail("<html><body>오류</body></html>"), null)
})

test("보조 함수", () => {
  assert.deepEqual(splitCarNames("아반떼 (HD), i30 (FD)"), ["아반떼 (HD)", "i30 (FD)"])
  assert.deepEqual(splitCarNames("코나(SX2), 코나 하이브리드(SX2, HEV)"), ["코나(SX2)", "코나 하이브리드(SX2, HEV)"])
  assert.equal(normDate("2020.07. 29"), "2020-07-29")
  assert.equal(normDate("2026-10-14 "), "2026-10-14")
  assert.equal(normDate(""), null)
})

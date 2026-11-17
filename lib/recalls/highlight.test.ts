// 실행: npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import type { Recall } from "./types.ts"
import { daysBefore, groupRecalls, isMajorRecall, majorRecallGroups, partLabel, recallCars } from "./highlight.ts"

const r = (o: Partial<Recall>): Recall => ({
  id: o.id ?? Math.random().toString(36).slice(2),
  maker: "x",
  makerName: o.makerName ?? "현대자동차",
  makerSlug: o.makerSlug ?? "hyundai",
  startDate: o.startDate ?? "2026-11-10",
  reason: o.reason ?? "기타 결함",
  fix: null,
  items: o.items ?? [{ name: "아반떼(CN7)", from: "2024-01-01", to: "2024-06-30" }],
  firstSeen: "2026-11-10",
  ...o,
})

test("주요 리콜: 주요 브랜드 + (중대 | 1,000대 이상 | 안전 결함)", () => {
  assert.equal(isMajorRecall(r({ count: 255, reason: "휠 고정용 너트 체결 불량으로 주행 중 휠 이탈 가능성" })), true)
  assert.equal(isMajorRecall(r({ count: 2141, reason: "버튼 커버 고정력 부족" })), true)
  assert.equal(isMajorRecall(r({ count: 10, serious: true })), true)
  assert.equal(isMajorRecall(r({ count: 21, reason: "오디오 소프트웨어 오류로 소리 안 남" })), false)
  // 소형 수입사·이륜차는 안전 결함이라도 첫 화면에서 제외
  assert.equal(isMajorRecall(r({ makerSlug: "maker-abc123", count: 5000, reason: "브레이크 호스 손상" })), false)
  assert.equal(isMajorRecall(r({ makerSlug: "bike-one", count: 87, serious: true })), false)
})

test("같은 날 같은 제작사는 한 묶음, 대수 합계·중대 여부, 최신순", () => {
  const g = groupRecalls([
    r({ startDate: "2026-11-16", makerSlug: "fl-auto", makerName: "에프엘오토코리아", count: 403 }),
    r({ startDate: "2026-11-16", makerSlug: "fl-auto", makerName: "에프엘오토코리아", count: 2141, serious: true }),
    r({ startDate: "2026-11-11", count: 255 }),
  ])
  assert.equal(g.length, 2)
  assert.equal(g[0].makerSlug, "fl-auto")
  assert.equal(g[0].count, 2544)
  assert.equal(g[0].serious, true)
  assert.equal(g[0].recalls[0].count, 2141) // 묶음 안은 대수 많은 순
  assert.equal(groupRecalls([r({ count: null })])[0].count, null)
})

test("시작 예정·기간 밖 리콜 제외, limit", () => {
  const today = "2026-11-18"
  const all = [
    r({ startDate: "2026-11-23", count: 5000 }), // 시작 예정
    r({ startDate: "2026-11-11", count: 5000 }),
    r({ startDate: "2026-08-01", count: 5000 }), // 90일 밖
    r({ startDate: "2026-10-01", count: 5000, makerSlug: "kia" }),
  ]
  const { groups, total } = majorRecallGroups(all, today, { days: 90, limit: 1 })
  assert.equal(total, 2)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].startDate, "2026-11-11")
  assert.equal(daysBefore("2026-03-01", 1), "2026-02-28")
})

test("소수 대상 리콜은 안전 문구가 있어도 제외 (대수를 모르면 포함)", () => {
  assert.equal(isMajorRecall(r({ count: 4, reason: "체결 불량으로 주행 중 휠 이탈" })), false)
  assert.equal(isMajorRecall(r({ count: 120, reason: "브레이크 호스 손상" })), true)
  assert.equal(isMajorRecall(r({ count: null, reason: "브레이크 호스 손상" })), true)
})

test("차명·장치 요약", () => {
  const two = r({
    items: [
      { name: "아반떼(CN7)", from: "", to: "" },
      { name: "아반떼(CN7)", from: "", to: "" },
      { name: "코나(SX2)", from: "", to: "" },
    ],
  })
  assert.equal(recallCars(two), "아반떼(CN7) 외 1개 차명")
  assert.equal(recallCars(r({})), "아반떼(CN7)")
  assert.equal(partLabel("원동기(동력발생장치) 기타"), "원동기")
  assert.equal(partLabel("제동장치 기타"), "제동장치")
  assert.equal(partLabel(null), "")
})

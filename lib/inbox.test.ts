import { test } from "node:test"
import assert from "node:assert/strict"
import { prune, hasUnread, ago, INBOX_MAX, INBOX_DAYS } from "./inbox-core.ts"

const DAY = 24 * 60 * 60 * 1000
const now = Date.UTC(2026, 10, 28, 3, 0, 0) // 2026-11-28 12:00 KST

test("90일 지난 알림은 빠짐", () => {
  const items = [
    { at: now - 10 * DAY },
    { at: now - (INBOX_DAYS + 1) * DAY },
    { at: now - INBOX_DAYS * DAY },
  ]
  const r = prune(items, now)
  assert.equal(r.length, 2)
  assert.ok(r.every((x) => x.at >= now - INBOX_DAYS * DAY))
})

test("50개 넘으면 최신 50개만, 최신순", () => {
  const items = Array.from({ length: 60 }, (_, i) => ({ at: now - i * 60000 })).reverse()
  const r = prune(items, now)
  assert.equal(r.length, INBOX_MAX)
  assert.equal(r[0].at, now)
  assert.equal(r[INBOX_MAX - 1].at, now - (INBOX_MAX - 1) * 60000)
})

test("안 읽은 알림 판정", () => {
  assert.equal(hasUnread([], 0), false)
  assert.equal(hasUnread([{ at: now }], 0), true)
  assert.equal(hasUnread([{ at: now }], now), false)
  assert.equal(hasUnread([{ at: now - 1000 }, { at: now + 1 }], now), true)
})

test("받은 시각 문구", () => {
  assert.equal(ago(now - 10 * 1000, now), "방금")
  assert.equal(ago(now + 5000, now), "방금") // 폰 시계가 조금 틀려도
  assert.equal(ago(now - 5 * 60000, now), "5분 전")
  assert.equal(ago(now - 3 * 3600000, now), "3시간 전")
  assert.equal(ago(now - 3 * DAY, now), "3일 전")
  assert.equal(ago(now - 29 * DAY, now), "29일 전")
  assert.equal(ago(Date.UTC(2026, 8, 1, 0, 0, 0), now), "9월 1일")
})

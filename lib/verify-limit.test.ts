import { test } from "node:test"
import assert from "node:assert/strict"
import { kstDay, userKey, checkLimit, PER_USER } from "./verify-limit.ts"

test("한국 시간 자정 기준으로 날짜가 바뀐다", () => {
  assert.equal(kstDay(Date.parse("2026-11-24T14:59:00Z")), "2026-11-24")
  assert.equal(kstDay(Date.parse("2026-11-24T15:00:00Z")), "2026-11-25")
})

test("IP 원문은 키에 남지 않고, 날짜가 바뀌면 키도 바뀐다", () => {
  const a = userKey("1.2.3.4", "2026-11-24")
  assert.ok(!a.includes("1.2.3.4"))
  assert.notEqual(a, userKey("1.2.3.4", "2026-11-25"))
})

test("KV가 없는 환경(로컬)은 제한 없이 통과", async () => {
  assert.deepEqual(await checkLimit("1.2.3.4"), { ok: true, remaining: PER_USER })
})

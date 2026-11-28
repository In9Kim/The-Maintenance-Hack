import { test } from "node:test"
import assert from "node:assert/strict"
import { kstDay, userKey, checkLimit, PER_USER, takeCounters, refundCounters, REFUND_MAX, type CounterSpec } from "./verify-limit.ts"

/** 메모리 KV (테스트용) */
function memKV() {
  const m = new Map<string, string>()
  return { m, get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) }
}
const SPEC: CounterSpec = { globalKey: (d) => `g:${d}`, key: (d, w) => `k:${d}:${w}`, globalMax: 5 }
const DAY = "2026-11-28"
const guest = [
  { who: "d:dev1", limit: 1 },
  { who: "ip:1.2.3.4", limit: 3 },
]

test("AI 부르기 전에 세고, 한도를 넘으면 아무것도 세지 않는다", async () => {
  const kv = memKV()
  assert.equal(await takeCounters(kv, SPEC, guest, DAY), "ok")
  assert.deepEqual(await takeCounters(kv, SPEC, guest, DAY), { over: "d:dev1" })
  assert.equal(kv.m.get(`g:${DAY}`), "1")
  assert.equal(kv.m.get(`k:${DAY}:ip:1.2.3.4`), "1")
})

test("실패하면 기기 횟수만 돌려주고 IP·전체 횟수는 그대로 (상한 유지)", async () => {
  const kv = memKV()
  await takeCounters(kv, SPEC, guest, DAY)
  await refundCounters(kv, SPEC, guest, {}, DAY)
  assert.equal(kv.m.get(`k:${DAY}:d:dev1`), "0")
  assert.equal(kv.m.get(`k:${DAY}:ip:1.2.3.4`), "1")
  assert.equal(kv.m.get(`g:${DAY}`), "1")
  // 같은 IP로 실패를 계속 반복해도 IP 한도(3)에서 멈춘다
  let calls = 1
  for (let i = 0; i < 10; i++) {
    if ((await takeCounters(kv, SPEC, guest, DAY)) !== "ok") break
    calls++
    await refundCounters(kv, SPEC, guest, {}, DAY)
  }
  assert.equal(calls, 3)
})

test("개인 횟수는 하루 REFUND_MAX번까지만 돌려준다", async () => {
  const kv = memKV()
  const user = [{ who: "u:abc", limit: 100 }]
  for (let i = 0; i < REFUND_MAX + 2; i++) {
    await takeCounters(kv, SPEC, user, DAY)
    await refundCounters(kv, SPEC, user, {}, DAY)
  }
  assert.equal(kv.m.get(`k:${DAY}:u:abc`), "2")
})

test("AI를 아예 안 부른 실패만 전체 횟수도 돌려준다", async () => {
  const kv = memKV()
  await takeCounters(kv, SPEC, guest, DAY)
  await refundCounters(kv, SPEC, guest, { aiCalled: false }, DAY)
  assert.equal(kv.m.get(`g:${DAY}`), "0")
})

test("전체 한도에 닿으면 global", async () => {
  const kv = memKV()
  kv.m.set(`g:${DAY}`, "5")
  assert.equal(await takeCounters(kv, SPEC, guest, DAY), "global")
})

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

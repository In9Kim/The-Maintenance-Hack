// 실행: npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { cleanGenInput, GEN_GLOBAL, GEN_PER_USER, refundGenUser, takeGen, type GenKV } from "./limit.ts"

function memKV(): GenKV & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, get: async (k) => data.get(k) ?? null, put: async (k, v) => void data.set(k, v) }
}

test("takeGen: 계정 하루 한도, 날이 바뀌면 다시", async () => {
  const kv = memKV()
  const now = Date.UTC(2026, 10, 28, 3)
  for (let i = 0; i < GEN_PER_USER; i++) assert.equal(await takeGen(kv, "a", now), "ok")
  assert.equal(await takeGen(kv, "a", now), "user")
  assert.equal(await takeGen(kv, "b", now), "ok")
  assert.equal(await takeGen(kv, "a", now + 86400_000), "ok")
})

test("takeGen: 사이트 전체 상한, 실패 환불은 계정 몫만", async () => {
  const kv = memKV()
  const now = Date.UTC(2026, 10, 28, 3)
  for (let i = 0; i < GEN_GLOBAL; i++) {
    assert.equal(await takeGen(kv, `u${i}`, now), "ok")
  }
  assert.equal(await takeGen(kv, "new", now), "global")
  await refundGenUser(kv, "u0", now)
  assert.equal(await takeGen(kv, "u0", now), "global")
})

test("takeGen: KV가 없으면 통과", async () => {
  assert.equal(await takeGen(null, "a"), "ok")
})

test("cleanGenInput: 객체가 아니면 null, 문자열만 길이 잘라서", () => {
  assert.equal(cleanGenInput(null), null)
  assert.equal(cleanGenInput("x"), null)
  assert.equal(cleanGenInput([1]), null)
  const c = cleanGenInput({ brand: "기아", model: "x".repeat(500), engineType: 3, vin: "knaxx123" })
  assert.ok(c)
  assert.equal(c.model.length, 60)
  assert.equal(c.engineType, "")
  assert.equal(c.vin, undefined)
  assert.equal(cleanGenInput({ vin: "kna-pb81bbnk12345" })?.vin, "KNAPB81BBNK12345")
})

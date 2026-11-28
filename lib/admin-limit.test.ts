// 실행: npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { adminFail, adminLocked, adminReset, MAX_FAILS, type AdminKV } from "./admin-limit.ts"

function memKV(): AdminKV {
  const data = new Map<string, string>()
  return { get: async (k) => data.get(k) ?? null, put: async (k, v) => void data.set(k, v) }
}

test("관리자 로그인: MAX_FAILS번 틀리면 막히고, IP마다 따로", async () => {
  const kv = memKV()
  for (let i = 0; i < MAX_FAILS - 1; i++) await adminFail(kv, "1.1.1.1")
  assert.equal(await adminLocked(kv, "1.1.1.1"), false)
  await adminFail(kv, "1.1.1.1")
  assert.equal(await adminLocked(kv, "1.1.1.1"), true)
  assert.equal(await adminLocked(kv, "2.2.2.2"), false)
  await adminReset(kv, "1.1.1.1")
  assert.equal(await adminLocked(kv, "1.1.1.1"), false)
})

test("KV가 없으면 막지 않음", async () => {
  assert.equal(await adminLocked(null, "x"), false)
})

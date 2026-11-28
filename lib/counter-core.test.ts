import { test } from "node:test"
import assert from "node:assert/strict"
import { runOp, takeKeys, refundKeys, type TakeOp, type RefundOp } from "./counter-core.ts"
import * as viaKV from "./verify-limit.ts"

function memKV() {
  const m = new Map<string, string>()
  return { m, get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) }
}
const take: TakeOp = { kind: "take", gk: "g", globalMax: 3, items: [{ key: "d", limit: 1 }, { key: "ip", limit: 2 }], ttl: 60 }
const refund: RefundOp = { kind: "refund", personal: ["d"], refundMax: 2, ttl: 60 }

test("Durable Object 쪽 계산과 KV 쪽 계산이 같은 결과", async () => {
  const a = memKV()
  const b = memKV()
  const steps: (TakeOp | RefundOp)[] = [take, take, refund, take, take, refund, refund, take, { ...refund, globalKey: "g" }, take, take]
  for (const op of steps) {
    const ra = op.kind === "take" ? await takeKeys(a, op) : (await refundKeys(a, op), null)
    const rb = op.kind === "take" ? await viaKV.takeKeys(b, op) : (await viaKV.refundKeys(b, op), null)
    assert.deepEqual(ra, rb)
  }
  assert.deepEqual([...a.m.entries()].sort(), [...b.m.entries()].sort())
})

test("한도·전체 상한·돌려주기 상한", async () => {
  const kv = memKV()
  assert.equal(await runOp(kv, take), "ok")
  assert.deepEqual(await runOp(kv, take), { index: 0 })
  await runOp(kv, refund)
  assert.equal(await runOp(kv, take), "ok")
  // IP 한도 2에 닿음
  await runOp(kv, refund)
  assert.deepEqual(await runOp(kv, take), { index: 1 })
  // 전체 상한
  const g = memKV()
  g.m.set("g", "3")
  assert.equal(await runOp(g, take), "global")
})

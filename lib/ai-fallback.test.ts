// 실행: npm test — AI 호출 순서: Claude 먼저, 실패하면 Gemini
import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"

const calls: string[] = []
const realFetch = globalThis.fetch
let claudeStatus = 200

beforeEach(() => {
  calls.length = 0
  process.env.ANTHROPIC_API_KEY = "test-anthropic"
  process.env.GEMINI_API_KEY = "test-gemini"
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.includes("api.anthropic.com")) {
      calls.push("claude")
      if (claudeStatus !== 200) return new Response('{"error":{"message":"credit balance is too low"}}', { status: claudeStatus })
      return Response.json({ content: [{ type: "text", text: '{"from":"claude"}' }] })
    }
    calls.push("gemini")
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"from":"gemini"}' }], role: "model" } }] })
  }) as typeof fetch
})

test("Claude 키가 있으면 Claude가 답한다", async () => {
  claudeStatus = 200
  const { decodeVin } = await import("./gemini.ts")
  const r = (await decodeVin("KNAF241BEKA856318")) as unknown as { from: string }
  assert.equal(r.from, "claude")
  assert.deepEqual(calls, ["claude"])
})

test("Claude가 실패(크레딧 소진 등)하면 Gemini로 넘어간다", async () => {
  claudeStatus = 400
  const { decodeVin } = await import("./gemini.ts")
  const r = (await decodeVin("KNAF241BEKA856318")) as unknown as { from: string }
  assert.equal(r.from, "gemini")
  assert.deepEqual(calls, ["claude", "gemini"])
  globalThis.fetch = realFetch
})

import { test } from "node:test"
import assert from "node:assert/strict"
import { ItemExtractor, parseSse } from "./quote-stream.ts"

test("항목이 완성될 때마다 꺼냄 (한 글자씩 받아도, 문자열 안의 괄호·따옴표는 무시)", () => {
  const json = JSON.stringify({
    readable: true,
    shop: "기아 오토큐",
    items: [
      { name: "엔진오일 {교환}", reason: 'He said "ok" ] }' },
      { name: "에어컨 필터", reason: "a\\b" },
    ],
    summary: "끝 {x}",
  })
  const ex = new ItemExtractor<{ name: string }>()
  const got: string[] = []
  for (const ch of json) for (const it of ex.push(ch)) got.push(it.name)
  assert.deepEqual(got, ["엔진오일 {교환}", "에어컨 필터"])
  assert.equal(JSON.parse(ex.full).summary, "끝 {x}")
})

test("빈 items", () => {
  const ex = new ItemExtractor()
  assert.deepEqual(ex.push('{"readable":false,"shop":"","items":[],"summary":"x"}'), [])
})

test("SSE에서 글자와 끝 이유만 꺼내고, 덜 온 줄은 남김", () => {
  const a = parseSse(
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"{\\"a\\""}}\n\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\ndata: {"type":"content_bl',
  )
  assert.deepEqual(a.texts, ['{"a"'])
  assert.equal(a.stop, "end_turn")
  assert.equal(a.rest, 'data: {"type":"content_bl')
})

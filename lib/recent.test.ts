import { test } from "node:test"
import assert from "node:assert/strict"
import { pushRecent, type RecentItem } from "./recent.ts"

const it = (href: string, t = 0): RecentItem => ({ href, title: href, t })

test("같은 주소는 맨 앞으로, 중복 없음", () => {
  const out = pushRecent([it("/a"), it("/b"), it("/c")], it("/b", 9))
  assert.deepEqual(out.map((x) => x.href), ["/b", "/a", "/c"])
  assert.equal(out[0].t, 9)
})

test("최대 개수만 남김", () => {
  let list: RecentItem[] = []
  for (let i = 0; i < 12; i++) list = pushRecent(list, it(`/${i}`), 8)
  assert.equal(list.length, 8)
  assert.equal(list[0].href, "/11")
})

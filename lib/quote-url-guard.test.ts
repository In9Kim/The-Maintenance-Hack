import { test } from "node:test"
import assert from "node:assert/strict"
import { checkFetchUrl, guardedFetch, isBlockedHost } from "./quote-url-guard.ts"

const host = (u: string) => new URL(u).hostname

test("내부·사설 주소는 막는다 (URL 파서가 바꾼 꼴 포함)", () => {
  for (const u of [
    "http://localhost/",
    "http://127.0.0.1/",
    "http://0.0.0.0/",
    "http://[::1]/",
    "http://[::]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:10.0.0.1]/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "http://10.1.2.3/",
    "http://172.16.0.1/",
    "http://192.168.0.1/",
    "http://169.254.169.254/",
    "http://100.64.0.1/",
    "http://2130706433/", // 127.0.0.1을 숫자 하나로
    "http://0x7f.1/",
    "http://foo.localhost/",
  ]) {
    assert.equal(isBlockedHost(host(u)), true, u)
  }
})

test("공개 주소는 연다", () => {
  for (const u of ["https://www.coupang.com/vp/products/1", "https://smartstore.naver.com/x", "http://8.8.8.8/", "http://[2606:4700::1111]/", "http://172.32.0.1/"]) {
    assert.equal(isBlockedHost(host(u)), false, u)
  }
})

test("http/https가 아니거나 형식이 틀리면 거른다", () => {
  assert.deepEqual(checkFetchUrl("ftp://example.com/"), { ok: false, reason: "protocol" })
  assert.deepEqual(checkFetchUrl("not a url"), { ok: false, reason: "format" })
  assert.equal(checkFetchUrl("http://user:pw@example.com/").ok, false)
})

const res = (status: number, location?: string) => new Response(status >= 300 && status < 400 ? null : "ok", { status, headers: location ? { location } : {} })

test("공개 주소에서 내부 주소로 리다이렉트하면 따라가지 않는다", async () => {
  const seen: string[] = []
  const r = await guardedFetch("https://example.com/a", {}, async (url, init) => {
    seen.push(url)
    assert.equal(init.redirect, "manual")
    return url.includes("example.com") ? res(302, "http://[::1]/admin") : res(200)
  })
  assert.equal(r, null)
  assert.deepEqual(seen, ["https://example.com/a"])
})

test("공개 주소끼리 리다이렉트는 따라가고, 너무 많으면 멈춘다", async () => {
  const ok = await guardedFetch("https://example.com/a", {}, async (url) => (url.endsWith("/a") ? res(301, "/b") : res(200)))
  assert.equal(ok?.status, 200)
  let n = 0
  const loop = await guardedFetch("https://example.com/a", {}, async () => (n++, res(302, "/a")))
  assert.equal(loop, null)
  assert.equal(n, 4)
})

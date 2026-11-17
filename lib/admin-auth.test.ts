// 실행: npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { checkAdminPassword, generateAdminToken, safeEqual, verifyAdminToken } from "./admin-auth.ts"

test("safeEqual: 같은 값만 true (길이가 달라도 오류 없이 false)", async () => {
  assert.equal(await safeEqual("abc", "abc"), true)
  assert.equal(await safeEqual("abc", "abd"), false)
  assert.equal(await safeEqual("abc", "abcd"), false)
  assert.equal(await safeEqual("", ""), true)
})

test("관리자 비밀번호·토큰 확인", async () => {
  const prev = process.env.ADMIN_PASSWORD
  try {
    process.env.ADMIN_PASSWORD = "test-pass-1"
    assert.equal(await checkAdminPassword("test-pass-1"), true)
    assert.equal(await checkAdminPassword("test-pass-2"), false)
    assert.equal(await checkAdminPassword(undefined), false)
    assert.equal(await checkAdminPassword(12345), false)

    const token = await generateAdminToken()
    assert.equal(await verifyAdminToken(token), true)
    assert.equal(await verifyAdminToken(token.slice(0, -1) + (token.endsWith("0") ? "1" : "0")), false)
    assert.equal(await verifyAdminToken(""), false)

    delete process.env.ADMIN_PASSWORD
    assert.equal(await checkAdminPassword(""), false)
    assert.equal(await verifyAdminToken(token), false)
  } finally {
    if (prev === undefined) delete process.env.ADMIN_PASSWORD
    else process.env.ADMIN_PASSWORD = prev
  }
})

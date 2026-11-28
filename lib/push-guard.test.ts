import { test } from "node:test"
import assert from "node:assert/strict"
import { isPushEndpoint } from "./push-guard.ts"

test("브라우저 푸시 서버 주소만 받는다", () => {
  assert.equal(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"), true)
  assert.equal(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc"), true)
  assert.equal(isPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=abc"), true)
  assert.equal(isPushEndpoint("https://web.push.apple.com/QGx"), true)
  assert.equal(isPushEndpoint("https://api.push.apple.com/3/device/x"), true)
})

test("다른 주소·http·흉내 낸 주소는 막는다", () => {
  assert.equal(isPushEndpoint("https://attacker.example/1"), false)
  assert.equal(isPushEndpoint("http://fcm.googleapis.com/fcm/send/abc"), false)
  assert.equal(isPushEndpoint("https://fcm.googleapis.com.attacker.example/x"), false)
  assert.equal(isPushEndpoint("https://evilpush.apple.com.example/x"), false)
  assert.equal(isPushEndpoint("https://fcm.googleapis.com:8443/x"), false)
  assert.equal(isPushEndpoint("https://a@fcm.googleapis.com/x"), false)
  assert.equal(isPushEndpoint("아무거나"), false)
})

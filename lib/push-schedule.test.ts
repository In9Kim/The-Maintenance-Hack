import { test } from "node:test"
import assert from "node:assert/strict"
import { createECDH, createDecipheriv, hkdfSync, randomBytes, generateKeyPairSync, createPublicKey, verify } from "node:crypto"
import { buildPush } from "./web-push.ts"
import { pushSchedule, pushMessage } from "./push-schedule.ts"

const part = (slug: string, name: string, intervalKm?: number, intervalMonths?: number) => ({ slug, name, intervalKm, intervalMonths }) as never
const car = (records: Record<string, { date: string; km?: number }>, km = 50_000, kmDate = "2026-11-01") =>
  ({ id: "c1", car: { id: "k3-bd", name: "기아 K3", parts: [part("oil", "엔진오일", 10_000, 12), part("wiper", "와이퍼", undefined, 12), part("pad", "브레이크 패드", 40_000)] }, km, kmDate, records }) as never

test("개월 주기: 마지막 교체일 + 주기의 80%에 알린다", () => {
  const items = pushSchedule({ cars: [car({ wiper: { date: "2026-01-01" } })], active: "c1" }, "2026-02-01")
  assert.equal(items.length, 1)
  assert.equal(items[0].name, "와이퍼")
  assert.equal(items[0].date, "2026-10-20") // 12 × 30.44 × 0.8 ≈ 292일
})

test("km 주기: 그동안 달린 속도로 날짜를 추정하고, 개월 주기와 둘 중 이른 날", () => {
  // 2026-05-01에 40,000km에서 오일 교체 → 11-01에 50,000km (184일에 10,000km) → 8,000km 지점은 이미 지남 → 오늘
  const items = pushSchedule({ cars: [car({ oil: { date: "2026-05-01", km: 40_000 } })], active: "c1" }, "2026-11-28")
  assert.equal(items[0].date, "2026-11-28")
})

test("기록 없는 부품은 알리지 않고, 새로 갈면 key가 바뀐다", () => {
  const a = pushSchedule({ cars: [car({ wiper: { date: "2026-01-01" } })], active: "c1" }, "2026-02-01")
  const b = pushSchedule({ cars: [car({ wiper: { date: "2026-11-01" } })], active: "c1" }, "2026-11-02")
  assert.equal(a.length, 1)
  assert.notEqual(a[0].key, b[0].key)
})

test("알림은 날짜가 된 것 중 안 보낸 것만, 여러 개면 한 통으로", () => {
  const items = [
    { key: "a", name: "엔진오일", car: "기아 K3", date: "2026-11-20" },
    { key: "b", name: "와이퍼", car: "기아 K3", date: "2026-11-28" },
    { key: "c", name: "패드", car: "기아 K3", date: "2026-12-30" },
  ]
  const m = pushMessage(items, {}, "2026-11-28")!
  assert.equal(m.title, "엔진오일 외 1개, 교체할 때가 다가와요")
  assert.deepEqual(m.keys, ["a", "b"])
  assert.equal(pushMessage(items, { a: "2026-11-20", b: "2026-11-28" }, "2026-11-28"), null)
})

test("보내는 알림은 브라우저 키로 풀린다 (RFC 8291 aes128gcm)", async () => {
  // 받는 쪽(브라우저) 키
  const ua = createECDH("prime256v1")
  ua.generateKeys()
  const auth = randomBytes(16)
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
  const jwk = privateKey.export({ format: "jwk" })
  const priv = { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, d: jwk.d }
  const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/test", keys: { p256dh: ua.getPublicKey().toString("base64url"), auth: auth.toString("base64url") } }
  const { endpoint, headers: h, body } = await buildPush(sub, { title: "엔진오일, 교체할 때가 다가와요" }, priv, "https://jungbihack.com")
  assert.equal(endpoint, sub.endpoint)
  assert.equal(h["Content-Encoding"], "aes128gcm")

  // VAPID 서명이 공개 키로 검증되고, aud는 푸시 서버 주소
  const m = h.Authorization.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)!
  const claims = JSON.parse(Buffer.from(m[2], "base64url").toString())
  assert.equal(claims.aud, "https://fcm.googleapis.com")
  const pub = createPublicKey({ key: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y }, format: "jwk" })
  assert.ok(verify("sha256", Buffer.from(`${m[1]}.${m[2]}`), { key: pub, dsaEncoding: "ieee-p1363" }, Buffer.from(m[3], "base64url")))

  // 풀기: 헤더(salt 16 | rs 4 | idlen 1 | keyid) + 암호문
  const buf = Buffer.from(body)
  const salt = buf.subarray(0, 16)
  const idlen = buf[20]
  const asPub = buf.subarray(21, 21 + idlen)
  const ct = buf.subarray(21 + idlen)
  const ecdh = ua.computeSecret(asPub)
  const ikm = Buffer.from(hkdfSync("sha256", ecdh, auth, Buffer.concat([Buffer.from("WebPush: info\0"), ua.getPublicKey(), asPub]), 32))
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16))
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12))
  const d = createDecipheriv("aes-128-gcm", cek, nonce)
  d.setAuthTag(ct.subarray(ct.length - 16))
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()])
  const text = plain.subarray(0, plain.lastIndexOf(2)).toString("utf8")
  assert.equal(JSON.parse(text).title, "엔진오일, 교체할 때가 다가와요")
})

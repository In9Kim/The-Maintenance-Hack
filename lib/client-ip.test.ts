import { test } from "node:test"
import assert from "node:assert/strict"
import { ipBucket, clientIp } from "./client-ip.ts"

test("IPv6는 앞 64비트로 묶는다", () => {
  assert.equal(ipBucket("2001:db8:1234:5678:aaaa:bbbb:cccc:dddd"), "2001:db8:1234:5678::/64")
  assert.equal(ipBucket("2001:0db8:1234:5678:0000:0000:0000:0001"), "2001:db8:1234:5678::/64")
  assert.equal(ipBucket("2001:db8:1234:5678::1"), "2001:db8:1234:5678::/64")
  assert.equal(ipBucket("2001:db8::1"), "2001:db8:0:0::/64")
  assert.equal(ipBucket("2001:DB8:1234:5678:FFFF::9"), "2001:db8:1234:5678::/64")
})

test("IPv4·섞인 주소·이상한 값", () => {
  assert.equal(ipBucket("1.2.3.4"), "1.2.3.4")
  assert.equal(ipBucket("::ffff:1.2.3.4"), "1.2.3.4")
  assert.equal(ipBucket(""), "unknown")
  assert.equal(ipBucket("unknown"), "unknown")
})

test("cf-connecting-ip 먼저", () => {
  const h = new Map([["cf-connecting-ip", "2400:1:2:3:4:5:6:7"], ["x-forwarded-for", "9.9.9.9"]])
  assert.equal(clientIp({ get: (k) => h.get(k) ?? null }), "2400:1:2:3::/64")
  assert.equal(clientIp({ get: (k) => (k === "x-forwarded-for" ? "5.6.7.8, 1.1.1.1" : null) }), "5.6.7.8")
})

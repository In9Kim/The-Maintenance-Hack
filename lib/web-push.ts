/**
 * Web Push 보내기 요청 만들기 (표준 RFC 8291 aes128gcm 암호화 + RFC 8292 VAPID 서명). Web Crypto만 써서 워커에서 돈다.
 * (공개 라이브러리 중 워커용은 예전 방식 aesgcm만 써서 아이폰 알림이 안 될 수 있어 직접 구현)
 */

export interface PushSub {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

const enc = new TextEncoder()

function b64u(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ""
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function unb64u(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, bytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8))
}

/** RFC 8291: 받는 브라우저 키로 내용을 암호화 (레코드 하나) */
export async function encryptPayload(sub: PushSub, plain: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const uaPub = unb64u(sub.keys.p256dh)
  const auth = unb64u(sub.keys.auth)
  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey))
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256))
  const ikm = await hkdf(auth, ecdh, concat(enc.encode("WebPush: info\0"), uaPub, asPub), 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16)
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12)
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"])
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(plain, new Uint8Array([2]))))
  const rs = new Uint8Array([0, 0, 0x10, 0]) // 4096
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct)
}

/** RFC 8292: VAPID 서명 (ES256 JWT) */
export async function vapidAuth(endpoint: string, privateJWK: JsonWebKey, contact: string, now = Date.now()): Promise<string> {
  const aud = new URL(endpoint).origin
  const header = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })))
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: contact })))
  const key = await crypto.subtle.importKey("jwk", { ...privateJWK, key_ops: ["sign"], ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"])
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`))
  const pub = concat(new Uint8Array([4]), unb64u(privateJWK.x!), unb64u(privateJWK.y!))
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${b64u(pub)}`
}

export async function buildPush(sub: PushSub, payload: unknown, privateJWK: JsonWebKey | string, contact: string, ttl = 43_200) {
  const jwk = typeof privateJWK === "string" ? (JSON.parse(privateJWK) as JsonWebKey) : privateJWK
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(payload)))
  return {
    endpoint: sub.endpoint,
    body,
    headers: {
      Authorization: await vapidAuth(sub.endpoint, jwk, contact),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttl),
      Urgency: "normal",
    },
  }
}

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs"

const KINDS = ["oil", "air", "cabin", "fuel", "pad", "disc", "lining", "spark", "wiper", "battery", "fluid"]
const photos: Record<string, Record<string, unknown>> = JSON.parse(
  readFileSync(new URL("../data/part-photos.json", import.meta.url), "utf8"),
).photos

test("종류 키는 11종 안에만 있다", () => {
  for (const k of Object.keys(photos)) assert.ok(KINDS.includes(k), `모르는 종류: ${k}`)
})

test("lib/part-photos.ts의 PartPhotoKind가 11종과 같다", () => {
  const src = readFileSync(new URL("./part-photos.ts", import.meta.url), "utf8")
  const union = src.match(/export type PartPhotoKind =([^\n]+)/)?.[1] ?? ""
  const got = [...union.matchAll(/"(\w+)"/g)].map((m) => m[1])
  assert.deepEqual(got, KINDS)
})

test("모든 사진에 파일 2개(480·128)와 저작자·라이선스 표기가 있다", () => {
  for (const [k, p] of Object.entries(photos)) {
    assert.equal(p.local, `/parts/${k}.webp`, k)
    assert.equal(p.localSmall, `/parts/${k}-128.webp`, k)
    for (const f of [p.local, p.localSmall] as string[]) {
      const u = new URL(`../public${f}`, import.meta.url)
      assert.ok(existsSync(u), `파일 없음: ${f}`)
      assert.ok(statSync(u).size > 300, `파일이 비었음: ${f}`)
    }
    assert.ok(statSync(new URL(`../public${p.localSmall}`, import.meta.url)).size < 20_000, `128px 파일이 너무 큼: ${k}`)
    assert.ok(typeof p.title === "string" && p.title.startsWith("File:"), k)
    assert.ok(typeof p.page === "string" && p.page.startsWith("https://commons.wikimedia.org/"), k)
    assert.ok(typeof p.author === "string" && p.author.length > 0, k)
    assert.ok(typeof p.label === "string" && p.label.length > 0, k)
    const lic = p.license as string
    assert.match(lic, /^(CC BY(-SA)? [\d.]+|CC0|Public domain)/, k)
    // BY / BY-SA는 저작자 표시 필수, PD·CC0는 표시 안 해도 됨
    assert.equal(p.credit, /^CC BY/.test(lic), `${k}: credit 값이 라이선스와 안 맞음`)
    // 정사각형으로 맞추려고 원본을 고쳤으므로 변경 사항 기록이 있어야 함 (BY-SA 변경 표시)
    assert.ok(typeof p.edited === "string" && p.edited.length > 0, `${k}: edited 없음`)
  }
})

test("public/parts/ 파일 수가 JSON 항목 수의 2배다", () => {
  const dir = new URL("../public/parts/", import.meta.url)
  // 사진을 하나도 안 쓰면(2026-11-28 결정: 기존 아이콘 유지) 폴더 자체가 없음
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".webp")) : []
  assert.equal(files.length, Object.keys(photos).length * 2)
})

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"

const cars = JSON.parse(readFileSync(new URL("../data/vehicles.json", import.meta.url), "utf8")).cars
const photos = JSON.parse(readFileSync(new URL("../data/car-photos.json", import.meta.url), "utf8")).photos

test("모든 차종에 사진이 있고, 파일과 저작자·라이선스 표기가 있다", () => {
  for (const car of cars) {
    const p = photos[car.id]
    assert.ok(p, `사진 없음: ${car.id}`)
    for (const f of [p.local, p.localSmall]) assert.ok(existsSync(new URL(`../public${f}`, import.meta.url)), `파일 없음: ${f}`)
    assert.ok(p.author && p.page.startsWith("https://commons.wikimedia.org/"), car.id)
    assert.match(p.license, /^(CC BY(-SA)? [\d.]+|CC0|Public domain)/, car.id)
  }
})

/**
 * 엔진오일 데이터 자동 검사 — 출처 없는 값, 엔진 구분이 안 된 값을 잡아낸다.
 * PENDING은 아직 취급설명서로 다시 확인하지 못한 차종. 확인해서 고치면 목록에서 빼고, 새로 늘리지 않는다.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import raw from "../data/vehicles.json" with { type: "json" }

type Part = { id: string; category: string; spec: string; source?: string; engine?: string }
type Car = { id: string; engineTypes: string[]; parts: Part[] }
const cars = ((raw as { cars?: Car[] }).cars ?? (raw as unknown as Car[])) as Car[]

const PENDING = new Set<string>([
  "kia-carnival-ka4",
  "kia-k5-dl3",
  "hyundai-tucson-nx4",
  "hyundai-avante-cn7",
  "hyundai-grandeur-gn7",
  "hyundai-santafe-mx5",
])

const oils = (c: Car) => c.parts.filter((p) => p.category === "oil")

test("엔진오일은 출처(취급설명서)가 있어야 한다", () => {
  const missing = cars.flatMap((c) => (PENDING.has(c.id) ? [] : oils(c).filter((p) => !p.source).map((p) => p.id)))
  assert.deepEqual(missing, [], `출처 없는 엔진오일: ${missing.join(", ")}`)
})

test("엔진이 여러 개인 차는 엔진오일도 엔진별로 나뉘어야 한다 (전기차 제외)", () => {
  const bad = cars
    .filter((c) => !PENDING.has(c.id) && oils(c).length > 0 && c.engineTypes.length > 1)
    .filter((c) => oils(c).length > 1 ? oils(c).some((p) => !p.engine) : true)
    .map((c) => c.id)
  assert.deepEqual(bad, [], `엔진 구분이 안 된 차: ${bad.join(", ")}`)
})

test("엔진오일 규격에 점도 또는 ACEA 등급, 용량(L)이 있어야 한다", () => {
  const bad = cars.flatMap((c) =>
    oils(c).filter((p) => !/\d{1,2}W-?\d{2}|ACEA|C[235]/.test(p.spec) || !/\d(?:\.\d)?\s*L\b/.test(p.spec)).map((p) => p.id)
  )
  assert.deepEqual(bad, [], `규격이 빈약한 엔진오일: ${bad.join(", ")}`)
})

test("PENDING 목록은 실제로 문제가 있는 차만 (고친 차는 빼기)", () => {
  const stale = [...PENDING].filter((id) => {
    const c = cars.find((x) => x.id === id)
    return c && oils(c).every((p) => p.source) && (c.engineTypes.length < 2 || oils(c).every((p) => p.engine))
  })
  assert.deepEqual(stale, [], `이미 고쳐진 차가 PENDING에 남아 있음: ${stale.join(", ")}`)
})

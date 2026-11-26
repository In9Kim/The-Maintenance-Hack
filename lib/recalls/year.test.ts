import { test } from "node:test"
import assert from "node:assert/strict"
import { recallsForYear, type CarRecallAlert } from "./year.ts"

const a: CarRecallAlert = {
  name: "K3",
  r: [
    ["new", "2025-05-01", "2023-03-01", "2024-02-28"],
    ["old", "2020-01-01", "2018-01-01", "2019-06-30"],
    ["nodate", "2021-01-01", "", ""],
  ],
}

test("연식 없으면 전부", () => assert.equal(recallsForYear(a).length, 3))
test("2024년형: 생산 기간 겹치는 리콜만 (+생산일 모르는 것)", () =>
  assert.deepEqual(recallsForYear(a, 2024).map((x) => x[0]), ["new", "nodate"]))
test("2019년형: 옛 리콜만", () => assert.deepEqual(recallsForYear(a, 2019).map((x) => x[0]), ["old", "nodate"]))

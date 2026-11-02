// 실행: npm test  (Node 22 내장 테스트 러너, 타입 표기는 Node가 자동으로 무시)
// 테스트 데이터는 실제 공공데이터(한국교통안전공단_자동차결함 리콜현황 2023~2025)의 차명·생산기간을 옮겨 왔습니다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { RECALL_MATCH_RULES, itemMatchesCar, matchRecallsForCar, splitRecallName } from "./match.ts"
import type { Recall } from "./types.ts"

const KIA = "기아 주식회사"
const HMC = "현대자동차(주)"
const TESLA = "테슬라코리아 유한회사"

const hit = (carId: string, maker: string, name: string, from = "2023-01-01", to = "2023-12-31") =>
  itemMatchesCar(maker, { name, from, to }, RECALL_MATCH_RULES[carId])

test("차명에서 세대 코드를 뽑는다", () => {
  assert.deepEqual(splitRecallName("쏘렌토 하이브리드(MQ4 HEV PE)"), { base: "쏘렌토하이브리드", code: "MQ4" })
  assert.deepEqual(splitRecallName("K5 (DL3 PE)"), { base: "k5", code: "DL3" })
  assert.deepEqual(splitRecallName("Model 3"), { base: "model3", code: null })
})

test("세대 코드가 같으면 매칭 (페이스리프트·하이브리드 포함)", () => {
  assert.equal(hit("kia-sorento-mq4", KIA, "쏘렌토(MQ4)"), true)
  assert.equal(hit("kia-sorento-mq4", KIA, "쏘렌토 (MQ4 PE)"), true)
  assert.equal(hit("kia-sorento-mq4", KIA, "쏘렌토 하이브리드(MQ4 HEV PE)"), true)
  assert.equal(hit("kia-k5-dl3", KIA, "K5 (DL3 PE)"), true)
  assert.equal(hit("hyundai-grandeur-gn7", HMC, "그랜저하이브리드(GN7 HEV)"), true)
  assert.equal(hit("kia-carnival-ka4", KIA, "카니발 하이브리드(KA4 HEV)"), true)
})

test("세대 코드가 다르면 매칭하지 않음 (이전 세대)", () => {
  assert.equal(hit("kia-sorento-mq4", KIA, "쏘렌토(XM)", "2010-07-05", "2014-08-21"), false)
  assert.equal(hit("kia-k5-dl3", KIA, "K5 하이브리드(TF HEV)", "2011-05-03", "2013-11-25"), false)
  assert.equal(hit("hyundai-tucson-nx4", HMC, "투싼(TL)", "2018-01-15", "2020-09-28"), false)
  assert.equal(hit("kia-carnival-ka4", KIA, "카니발 (YP)", "2019-01-03", "2020-07-17"), false)
})

test("다른 파생 모델이나 다른 제작사는 매칭하지 않음", () => {
  // 아반떼 N은 같은 CN7이지만 별도 모델이라 일반 아반떼 페이지에 붙이지 않는다
  assert.equal(hit("hyundai-avante-cn7", HMC, "아반떼N (CN7 N)"), false)
  assert.equal(hit("hyundai-avante-cn7", HMC, "아반떼(CN7)"), true)
  // 제작사가 다르면 이름이 같아도 아님
  assert.equal(hit("kia-k5-dl3", HMC, "K5(DL3)"), false)
})

test("세대 코드가 없는 테슬라는 양산 시작일 이후 생산분만 매칭", () => {
  // 하이랜드 이후 생산분
  assert.equal(hit("tesla-model3-highland", TESLA, "Model 3", "2024-04-16", "2024-08-20"), true)
  // 구형과 기간이 겹치면 불확실 → 매칭 안 함
  assert.equal(hit("tesla-model3-highland", TESLA, "Model 3", "2021-01-14", "2024-07-10"), false)
  assert.equal(hit("tesla-model3-highland", TESLA, "모델 3", "2019-10-09", "2022-01-08"), false)
  // Model Y 주니퍼 이전 생산분
  assert.equal(hit("tesla-modely", TESLA, "Model Y", "2024-10-19", "2024-11-09"), false)
  assert.equal(hit("tesla-modely", TESLA, "Model Y", "2025-03-01", "2025-05-01"), true)
  // Model 3 페이지에 Model Y가 붙으면 안 됨
  assert.equal(hit("tesla-model3-highland", TESLA, "Model Y", "2024-05-25", "2024-09-23"), false)
})

test("규칙 없는 차종은 아무것도 매칭하지 않고, 해당 줄만 남긴다", () => {
  const recall: Recall = {
    id: "2025-01-24-abc123",
    maker: KIA,
    makerName: "기아",
    makerSlug: "kia",
    startDate: "2025-01-24",
    reason: "테스트",
    fix: null,
    firstSeen: "2025-01-24",
    items: [
      { name: "쏘렌토 (MQ4 PE)", from: "2023-07-24", to: "2024-06-18" },
      { name: "카니발 (KA4)", from: "2023-07-24", to: "2024-06-18" },
    ],
  }
  assert.equal(matchRecallsForCar("unknown-car", [recall]).length, 0)
  const sorento = matchRecallsForCar("kia-sorento-mq4", [recall])
  assert.equal(sorento.length, 1)
  assert.deepEqual(
    sorento[0].items.map((i) => i.name),
    ["쏘렌토 (MQ4 PE)"]
  )
})

test("국토부 보도자료처럼 세대 코드 없는 현대·기아 차명은 양산 시작일 이후 생산분만 매칭", () => {
  // 2026-08-06 보도자료: 투싼 '23.07.24.~'26.03.16. → NX4
  assert.equal(hit("hyundai-tucson-nx4", "현대자동차㈜", "투싼", "2023-07-24", "2026-03-16"), true)
  assert.equal(hit("hyundai-tucson-nx4", "현대자동차㈜", "투싼 하이브리드", "2023-11-17", "2026-03-16"), true)
  // 그랜저 '22.10.21.~: 이전 세대(IG)와 겹칠 수 있어 매칭하지 않음
  assert.equal(hit("hyundai-grandeur-gn7", "현대자동차㈜", "그랜저", "2022-10-21", "2025-05-13"), false)
  assert.equal(hit("hyundai-grandeur-gn7", "현대자동차㈜", "그랜저 하이브리드", "2022-11-21", "2026-01-15"), false)
  // 카니발 '20.07.23.~: KA4 초기 생산이지만 YP 단종 시점과 가까워 보수적으로 매칭하지 않음
  assert.equal(hit("kia-carnival-ka4", "기아㈜", "카니발", "2020-07-23", "2026-01-10"), false)
  // 아반떼 하이브리드 '23.02.08.~ → CN7
  assert.equal(hit("hyundai-avante-cn7", "현대자동차㈜", "아반떼 하이브리드", "2023-02-08", "2026-01-06"), true)
})

test("세대 코드가 HEV와 붙어 있어도 읽는다", () => {
  assert.deepEqual(splitRecallName("그랜저하이브리드(GN7HEV)"), { base: "그랜저하이브리드", code: "GN7" })
  assert.equal(hit("hyundai-grandeur-gn7", HMC, "그랜저하이브리드(GN7HEV)"), true)
})

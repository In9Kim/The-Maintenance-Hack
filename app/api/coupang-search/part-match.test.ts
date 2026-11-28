// 실행: npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { matchPartKind, partKind } from "./part-match.ts"

const names = (list: { name: string }[]) => list.map((x) => x.name)

test("partKind: 많이 찾는 부품만 알아봄", () => {
  assert.equal(partKind("엔진오일 + 오일필터 (디젤)"), "engine-oil")
  assert.equal(partKind("에어클리너 필터"), "air-filter")
  assert.equal(partKind("에어컨 필터"), "cabin-filter")
  assert.equal(partKind("와이퍼 블레이드"), "wiper")
  assert.equal(partKind("브레이크 패드 (전)"), null)
})

test("엔진오일: 오일필터·필터 셋트·다른 세대 오일은 빼고 오일 세트만", () => {
  const list = [
    { name: "리얼스톤 현대 기아 호환 엔진오일필터 26300-35505" },
    { name: "보쉬 엔진오일교환 필터 셋트 뉴SM5 가솔린, LPG 오일필터+에어필터 O1186+A2021" },
    { name: "보쉬 오일필터 에어필터 세트 O1186+A3042 QM6 2.0 LPe GDe LPG 가솔린" },
    { name: "모닝어반JA 1.0 가솔린 엔진오일세트 킥스 GX5 5W30 3L O0356-A3030" },
    { name: "지크 SK엔무브 X8 엔진오일" },
    { name: "기아 더뉴 K3 BD 순정 엔진오일세트" },
  ]
  assert.deepEqual(names(matchPartKind(list, "engine-oil", "K3", "BD")), ["기아 더뉴 K3 BD 순정 엔진오일세트", "지크 SK엔무브 X8 엔진오일"])
})

test("에어클리너: 엔진오일·워셔액·오일 세트는 빼고 단품만", () => {
  const list = [
    { name: "불스원 Rain OK 에탄올 3in1 발수코팅 워셔액" },
    { name: "지크 SK엔무브 X8 엔진오일" },
    { name: "쏘렌토MQ4 2.2 디젤 순정 엔진오일 필터 세트 / 에어크리너+오일필터" },
    { name: "쏘렌토MQ4 2.2디젤/2.5가솔린터보 에어크리너 28113L1000" },
    { name: "쏘렌토MQ4 디젤 에어클리너 오일필터 세트" },
    { name: "기아 4세대 쏘렌토 MQ4 2.2 디젤 킥스 GX7 5W30 6L 엔진오일 오일필터 에어크리너 세트" },
  ]
  assert.deepEqual(names(matchPartKind(list, "air-filter", "쏘렌토", "MQ4")), ["쏘렌토MQ4 2.2디젤/2.5가솔린터보 에어크리너 28113L1000"])
})

test("와이퍼: 다른 세대 코드 상품은 빼고, 이 차 이름이 있는 상품을 앞으로", () => {
  const list = [
    { name: "레인윙스 차량용 하이브리드 와이퍼 블레이드 운전석 + 조수석 세트" },
    { name: "1+1 기아 올뉴 더뉴 K3 GT 전차종 와이퍼 블레이드" },
    { name: "1+1 기아 더뉴 K5 DL3 전차종 하이브리드 와이퍼 블레이드" },
    { name: "럭스블레이드 실리콘 와이퍼 세트, K3 BD (18년~현재)" },
  ]
  assert.deepEqual(names(matchPartKind(list, "wiper", "K3", "BD")), [
    "럭스블레이드 실리콘 와이퍼 세트, K3 BD (18년~현재)",
    "1+1 기아 올뉴 더뉴 K3 GT 전차종 와이퍼 블레이드",
    "레인윙스 차량용 하이브리드 와이퍼 블레이드 운전석 + 조수석 세트",
  ])
})

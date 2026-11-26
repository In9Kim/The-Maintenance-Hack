import { test } from "node:test"
import assert from "node:assert/strict"
import { wiperLengths, wiperMatches, filterMatches, partNumbersOf } from "./pick-coupang-parts.mjs"

const sorento = { model: "쏘렌토", alias: ["소렌토"], code: "MQ4", years: [20, 99], fuel: null, multiFuel: true, pns: [] }
const avante = { model: "아반떼", alias: ["아반테"], code: "CN7", years: [20, 99], fuel: null, multiFuel: true, pns: [] }

test("와이퍼 길이 읽기", () => {
  assert.deepEqual(wiperLengths("운전석 650mm · 조수석 400mm (구매 전 기존 블레이드 길이 확인)"), [650, 400])
  assert.equal(wiperLengths("전 엔진 공통 (길이는 기존 블레이드로 확인)"), null)
})

test("순정 품번 읽기", () => assert.deepEqual(partNumbersOf("kw=97133-L1100"), ["97133L1100"]))

test("와이퍼: 길이 둘 다 + 세트면 통과, 리필·다른 차·한쪽 길이는 탈락", () => {
  const w = { model: "투싼", alias: [], lengths: [650, 400] }
  assert.equal(wiperMatches("올뉴투싼 현대모비스 나노 발수코팅 앞유리 와이퍼 650mm+400mm 1세트", w), true)
  assert.equal(wiperMatches("현대모비스 투싼TL 와이퍼 리필고무 세트 650-400 현대모비스부품몰", w), false)
  assert.equal(wiperMatches("뉴카렌스 (06년~13년) 레인프로 실리콘 발수코팅 와이퍼 2개1세트 650mm+400mm", w), false)
  assert.equal(wiperMatches("올뉴말리부 3M 와이퍼블레이드 윈도우브러쉬 650mm+450mm세트", w), false)
  assert.equal(wiperMatches("하이브리드 와이퍼 650mm 600mm 550mm 500mm 450mm 400mm 선택", w), false)
})

test("테슬라처럼 전용 와이퍼는 차 이름 필수", () => {
  const w = { model: "Model 3", alias: ["모델3"], lengths: [650, 475], dedicated: true }
  assert.equal(wiperMatches("범용 와이퍼 650mm+475mm 세트", w), false)
  assert.equal(wiperMatches("테슬라 모델3 하이랜드 전용 와이퍼 650mm+475mm 세트", w), true)
})

test("에어컨필터: 차종·세대 맞으면 통과, 다른 연료 전용·세대 불명은 탈락", () => {
  const c = { ...sorento, kind: "cabin" }
  assert.equal(filterMatches("기어가 숯 알갱이 활성탄 쏘렌토 MQ4 (20년3월~현재) 에어컨필터, 1개, 쏘렌토MQ4 H32L", c), true)
  assert.equal(filterMatches("필립스 PM0.3 쏘렌토 MQ4 아반떼 CN7 싼타페 MX5 스포티지 NQ5 그랜저 GN7 K5 DL3 자동차 에어컨 필터", c), true)
  assert.equal(filterMatches("(기아) [1+1+1] 신아 자동차 에어컨 활성탄필터, 3개, 쏘렌토(MQ4) 하이브리드(2020~)", c), false)
  assert.equal(filterMatches("다보니 PM 2.5 초미세먼지 차단 쏘렌토 에어컨필터", c), false)
  assert.equal(filterMatches("대한카필터 PM1.0 활성탄 에어컨필터, KC118, 2개", c), false)
})

test("에어클리너: 단품만, 오일필터 세트·에어컨필터는 탈락", () => {
  const a = { ...avante, kind: "air" }
  assert.equal(filterMatches("아반떼 CN7 1.6 가솔린 엔진 에어필터 AF026-1 [에어크리너]", a), false) // 연료가 여럿인 차인데 가솔린 전용
  assert.equal(filterMatches("아반떼CN7 1.6 가솔린 에어필터+오일필터 28113-AA100+26350-2M000", { ...a, fuel: "가솔린" }), false)
  assert.equal(filterMatches("아반떼 CN7 1.6 가솔린 엔진 에어필터 AF026-1 [에어크리너]", { ...a, fuel: "가솔린", disps: ["1.6"] }), true)
  assert.equal(filterMatches("아반떼 CN7 에어컨필터 활성탄", a), false)
})

test("순정 품번이 있으면 품번으로만 판정", () => {
  const c = { ...sorento, model: "싼타페", code: "TM", kind: "cabin", pns: ["97133L1100"] }
  assert.equal(filterMatches("모비스 순정 에어컨필터 97133-L1100 싼타페TM", c), true)
  assert.equal(filterMatches("싼타페 TM 활성탄 에어컨필터", c), false)
})

const others = ["그랜저", "그랜져", "K5", "레이", "쏘나타", "소나타", "투싼", "카니발", "쏘렌토", "소렌토", "K8", "스타리아", "싼타페", "산타페", "스포티지", "아반떼", "아반테"]
test("와이퍼: 다른 세대·우리 데이터의 다른 차·옵션 상품은 탈락", () => {
  assert.equal(wiperMatches("아반떼HD 3M 와이퍼블레이드 윈도우브러쉬 600mm+450mm세트", { model: "아반떼", alias: ["아반테"], code: "CN7", lengths: [600, 450], others: others.filter((x) => !/아반/.test(x)) }), false)
  assert.equal(wiperMatches("불스원 레인OK 그랜저IG 그라파이트코팅 와이퍼 650mm+450mm 세트", { model: "쏘나타", alias: ["소나타"], code: "DN8", lengths: [650, 450], others: others.filter((x) => !/나타/.test(x)) }), false)
  assert.equal(wiperMatches("레이븐 팰리세이드 하이브리드 와이퍼 운전석+조수석 세트 650+500", { model: "팰리세이드", alias: [], code: "LX2", lengths: [650, 500], others }), true)
})
test("필터: 여러 차 옵션 상품·10개 묶음·다른 배기량은 탈락", () => {
  const base = { model: "쏘렌토", alias: ["소렌토"], code: "MQ4", years: [20, 99], multiFuel: true, pns: [], others: others.filter((x) => !/렌토/.test(x)) }
  assert.equal(filterMatches("소나타DN8 K5/DL3 쏘렌토MQ4 카니발KA4 K8/GL3 스타리아 엔진 에어크리너", { ...base, kind: "air" }), false)
  assert.equal(filterMatches("쏘렌토 MQ4 활성탄 에어컨 필터 순정 호환품, 10개", { ...base, kind: "cabin" }), false)
  assert.equal(filterMatches("그랜저IG 2.4 가솔린 엔진 에어필터 AF014 [에어크리너]", { ...base, model: "그랜저", alias: [], code: "IG", fuel: "가솔린", kind: "air", disps: [], others: [] }), false)
})

test("붙어 쓴 다른 차 이름도 잡는다 (셀토스·카렌스·트랙스)", () => {
  const w = { model: "아반떼", alias: ["아반테"], code: "CN7", lengths: [600, 450], others: ["셀토스", "레이", "투싼"] }
  assert.equal(wiperMatches("현대모비스 셀토스 발수코팅 와이퍼 운전석 600mm 조수석 450mm 세트", w), false)
  assert.equal(wiperMatches("뉴카렌스 와이퍼 650mm 400mm 2개입 SET", { ...w, model: "K3", alias: [], code: "BD", lengths: [650, 400] }), false)
  assert.equal(wiperMatches("레이 와이퍼 익스트림 하이브리드 2개 1세트 550mm 400mm", { ...w, model: "캐스퍼", alias: [], code: "AX1", lengths: [550, 400] }), false)
})
test("긴 차 이름은 붙어 있어도 잡고(코란도투리스모), G70은 GV70과 구분", () => {
  const w = { model: "아반떼", alias: [], code: "CN7", lengths: [600, 450], others: [] }
  assert.equal(wiperMatches("불스원 레인OK 코란도투리스모 그라파이트코팅 와이퍼 600mm+450mm 세트", w), false)
  assert.equal(wiperMatches("현대모비스 G70 와이퍼 세트 650-450 순정", { ...w, model: "GV70", code: "JK1", lengths: [650, 450] }), false)
})

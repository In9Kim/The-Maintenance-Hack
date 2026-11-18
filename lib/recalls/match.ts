/**
 * 리콜 ↔ 우리 차종 매칭 규칙
 *
 * 원칙: 확실할 때만 매칭한다. 애매하면 매칭하지 않고 전체 목록(/recalls)에만 둔다.
 *
 *  1) 제작사가 맞아야 한다 (예: 기아 차종이면 "기아 주식회사")
 *  2) 차명이 우리 차종 이름과 맞아야 한다. 이름 앞뒤에 허용하는 말은 "더 뉴", "하이브리드" 같은
 *     표기 정도이고, "아반떼N"처럼 다른 파생 모델이 되는 글자가 붙으면 매칭하지 않는다.
 *  3) 세대 확인
 *     - 차명 괄호 안에 세대 코드가 있으면 그것만 본다. "쏘렌토(MQ4)" → MQ4 이면 매칭, "쏘렌토(XM)" → 불일치
 *     - 세대 코드가 없으면(테슬라, 국토부 보도자료 표 등) 생산기간 시작일이 그 세대 양산 시작일(sop) 이후일 때만 매칭.
 *       이전 세대와 생산기간이 겹치면(예: 2021~2024 생산분) 해당 세대 포함 여부가 불확실하므로 매칭하지 않는다.
 *       sop가 없는 차종은 코드 없는 차명을 매칭하지 않는다.
 *
 * 규칙이 없는 차종(사용자 요청으로 AI가 만든 차종 등)은 아무 리콜도 매칭하지 않는다.
 */
import type { Recall, RecallItem } from "./types"

export interface RecallMatchRule {
  /** 제작자 원문에 대한 정규식 */
  maker: RegExp
  /** 차명 별칭 (공백 제거·소문자 기준) */
  names: string[]
  /** 세대 코드 (대문자). 차명 괄호 안 첫 단어와 비교 */
  genCode?: string
  /** 같은 세대를 다르게 적는 코드 (예: GV70은 "JK1"과 "JK"가 섞여 나옴) */
  altGenCodes?: string[]
  /** 세대 코드가 없는 차명을 위한 양산 시작일 (보수적으로 실제보다 약간 늦게 잡음) */
  sop?: string
  /** 세대 코드가 없는 차명을 위한 생산 종료일 — 생산기간 끝이 이 날 이후면(다음 세대와 겹치면) 매칭 안 함 */
  eop?: string
  /** 괄호 안 전체에 대한 추가 조건 (예: 부분변경 "TM PE"만, 변경 전 "TM"은 제외) */
  codeRe?: RegExp
}

/** 차명에서 차종 이름 앞뒤로 붙어도 같은 차로 보는 말 */
const ALLOWED_EXTRA = new Set([
  "",
  "더뉴",
  "디올뉴",
  "올뉴",
  "뉴",
  "하이브리드",
  "플러그인하이브리드",
  "hybrid",
  "hev",
  "phev",
])

export const RECALL_MATCH_RULES: Record<string, RecallMatchRule> = {
  // sop: 세대 코드 없이 차명만 나오는 경우(국토부 보도자료 표 등)를 위한 양산 시작일.
  //      이전 세대 생산이 확실히 끝난 뒤로 보수적으로 잡음 → 이 날짜 이후 생산분만 매칭
  "kia-sorento-mq4": { maker: /^기아/, names: ["쏘렌토", "sorento"], genCode: "MQ4", sop: "2020-04-01" },
  "kia-carnival-ka4": { maker: /^기아/, names: ["카니발", "carnival"], genCode: "KA4", sop: "2020-09-01" },
  "kia-k5-dl3": { maker: /^기아/, names: ["k5"], genCode: "DL3", sop: "2020-01-01" },
  "hyundai-tucson-nx4": { maker: /^현대자동차/, names: ["투싼", "tucson"], genCode: "NX4", sop: "2020-10-01" },
  "hyundai-avante-cn7": { maker: /^현대자동차/, names: ["아반떼", "avante", "elantra"], genCode: "CN7", sop: "2020-05-01" },
  "hyundai-grandeur-gn7": { maker: /^현대자동차/, names: ["그랜저", "grandeur"], genCode: "GN7", sop: "2022-12-01" },
  // 싼타페 TM 부분변경(더 뉴 싼타페, 2020.06~2023.07). 변경 전 TM(2018~2020)은 엔진·규격이 달라 제외
  "hyundai-santafe-tm": {
    maker: /^현대자동차/,
    names: ["싼타페", "santafe"],
    genCode: "TM",
    codeRe: /^TM\s*PE\b/i,
    sop: "2020-06-01",
    eop: "2023-07-31",
  },
  "hyundai-santafe-mx5": { maker: /^현대자동차/, names: ["싼타페", "santafe"], genCode: "MX5", sop: "2023-08-01" },
  // 테슬라 리콜 차명에는 세대 표기가 없어서 생산 시작일로만 판단
  // Model 3 하이랜드: 상하이 양산 2023년 9월 → 2023-10-01 이후 생산분만
  "tesla-model3-highland": { maker: /^테슬라/, names: ["model3", "모델3"], sop: "2023-10-01" },
  // Model Y 주니퍼: 상하이 양산 2025년 1월 → 2025-02-01 이후 생산분만
  "tesla-modely": { maker: /^테슬라/, names: ["modely", "모델y"], sop: "2025-02-01" },
  // ── 2026-11-18 추가 차종 (취급설명서 기준 세대와 맞춤) ──
  // 쏘나타·팰리세이드는 리콜 표기에 부분변경 구분이 없어 세대 전체를 매칭 (엔진 구성은 같은 계열)
  "hyundai-sonata-dn8": { maker: /^현대자동차/, names: ["쏘나타", "sonata"], genCode: "DN8", sop: "2023-05-01" },
  "hyundai-kona-sx2": { maker: /^현대자동차/, names: ["코나", "kona"], genCode: "SX2", sop: "2023-02-01" },
  "hyundai-palisade-lx2": { maker: /^현대자동차/, names: ["팰리세이드", "palisade"], genCode: "LX2", sop: "2022-08-01", eop: "2025-03-31" },
  "hyundai-casper-ax1": { maker: /^현대자동차/, names: ["캐스퍼", "casper"], genCode: "AX1", codeRe: /^AX1(?!\s*(EV|KV)\b)/i, sop: "2021-10-01" },
  // 그랜저 IG는 부분변경 전후 엔진이 달라 PE만
  "hyundai-grandeur-ig": { maker: /^현대자동차/, names: ["그랜저", "grandeur"], genCode: "IG", codeRe: /^IG\s*PE\b/i, sop: "2019-12-01", eop: "2022-10-31" },
  "hyundai-avante-ad": { maker: /^현대자동차/, names: ["아반떼", "avante", "elantra"], genCode: "AD", sop: "2018-10-01", eop: "2020-04-30" },
  "hyundai-staria-us4": { maker: /^현대자동차/, names: ["스타리아", "staria"], genCode: "US4", sop: "2021-05-01" },
  // 아이오닉5 부분변경: "NE1 PE"와 "NE PE"가 섞여 나옴. 변경 전 "(NE)"는 제외
  "hyundai-ioniq5-ne": { maker: /^현대자동차/, names: ["아이오닉5", "ioniq5"], genCode: "NE1", altGenCodes: ["NE"], codeRe: /^NE1?\s*PE\b/i, sop: "2024-04-01" },
  "kia-sportage-nq5": { maker: /^기아/, names: ["스포티지", "sportage"], genCode: "NQ5", sop: "2021-07-01" },
  "kia-seltos-sp2": { maker: /^기아/, names: ["셀토스", "seltos"], genCode: "SP2", sop: "2022-08-01", eop: "2025-12-31" },
  // 레이는 2011년부터 TAM 한 코드라 이전 연식 리콜도 붙음 (엔진 같은 계열). 전기차는 제외
  "kia-ray-tam": { maker: /^기아/, names: ["레이", "ray"], genCode: "TAM", codeRe: /^TAM(?!\s*EV)/i, sop: "2022-09-01" },
  "kia-morning-ja": { maker: /^기아/, names: ["모닝", "morning", "picanto"], genCode: "JA", sop: "2020-06-01" },
  "kia-k8-gl3": { maker: /^기아/, names: ["k8"], genCode: "GL3", sop: "2021-04-01" },
  "kia-niro-sg2": { maker: /^기아/, names: ["니로", "niro"], genCode: "SG2", codeRe: /^SG2(?!\s*EV)/i, sop: "2022-02-01" },
  // 차명은 소문자로 비교하므로 "봉고Ⅲ" → "봉고ⅲ"
  "kia-bongo3-pu": { maker: /^기아/, names: ["봉고ⅲ", "봉고3", "봉고iii", "bongo3", "bongoiii"], genCode: "PU", codeRe: /^PU(?!\s*EV)/i },
  // 제네시스: 부분변경(PE) 리콜은 제외
  "genesis-g80-rg3": { maker: /^현대자동차|^제네시스/, names: ["g80", "제네시스g80"], genCode: "RG3", codeRe: /^RG3(?!\s*(PE|EV)\b)/i, sop: "2020-04-01", eop: "2023-11-30" },
  "genesis-gv80-jx1": { maker: /^현대자동차|^제네시스/, names: ["gv80", "제네시스gv80"], genCode: "JX1", altGenCodes: ["JX"], codeRe: /^JX1?\b(?!\s*(PE|EV)\b)/i, sop: "2020-02-01", eop: "2023-07-31" },
  "genesis-gv70-jk1": { maker: /^현대자동차|^제네시스/, names: ["gv70", "제네시스gv70"], genCode: "JK1", altGenCodes: ["JK"], codeRe: /^JK1?\b(?!\s*(PE|EV)\b)/i, sop: "2021-01-01", eop: "2024-02-29" },
  // 토레스는 리콜 차명에 세대 코드가 없음. "토레스(VAN)"·"토레스EVX"는 규칙상 자동 제외
  "kgm-torres-j100": { maker: /^케이지모빌리티|^KG|^쌍용/i, names: ["토레스", "torres"], sop: "2022-07-01" },
}

const norm = (s: string) => s.toLowerCase().replace(/[\s·\-_]/g, "")

/** "쏘렌토 하이브리드(MQ4 HEV PE)" → { base: "쏘렌토하이브리드", code: "MQ4" } */
export function splitRecallName(name: string): { base: string; code: string | null } {
  const m = name.match(/[(（]\s*([^)）]*)[)）]/)
  const inside = m ? m[1].trim() : ""
  // "GN7 HEV" → GN7, 공백 없이 붙은 "GN7HEV" → GN7 (영문 1~3자 + 숫자 1~2자리가 세대 코드)
  const first = inside ? inside.split(/\s+/)[0].toUpperCase() : ""
  const code = first ? (first.match(/^[A-Z]{1,3}\d{1,2}/)?.[0] ?? first) : null
  const base = norm(name.replace(/[(（][^)）]*[)）]/g, ""))
  return { base, code: code || null }
}

function nameMatches(base: string, names: string[]): boolean {
  return names.some((alias) => {
    const i = base.indexOf(alias)
    if (i < 0) return false
    const before = base.slice(0, i)
    const after = base.slice(i + alias.length)
    return ALLOWED_EXTRA.has(before) && ALLOWED_EXTRA.has(after)
  })
}

/** 리콜 대상 한 줄이 이 차종에 해당하는지 */
export function itemMatchesCar(maker: string, item: RecallItem, rule: RecallMatchRule): boolean {
  if (!rule.maker.test(maker)) return false
  const { base, code } = splitRecallName(item.name)
  const inside = item.name.match(/[(（]\s*([^)）]*)[)）]/)?.[1].trim() ?? ""
  if (!nameMatches(base, rule.names)) return false

  if (code) {
    // 세대 코드가 적혀 있으면 그것으로만 판단 (다른 세대면 불일치)
    const codes = rule.genCode ? [rule.genCode, ...(rule.altGenCodes ?? [])] : []
    return codes.includes(code) && (!rule.codeRe || rule.codeRe.test(inside))
  }
  // 세대 코드가 없으면 생산기간이 이 세대 양산 기간 안일 때만
  if (!rule.sop || !/^\d{4}-\d{2}-\d{2}$/.test(item.from)) return false
  if (rule.eop && !(/^\d{4}-\d{2}-\d{2}$/.test(item.to) && item.to <= rule.eop)) return false
  return item.from >= rule.sop
}

/** 이 차종에 해당하는 리콜만 (해당 줄만 남겨서) 돌려준다 */
export function matchRecallsForCar(carId: string, recalls: Recall[]): Recall[] {
  const rule = RECALL_MATCH_RULES[carId]
  if (!rule) return []
  const out: Recall[] = []
  for (const r of recalls) {
    const items = r.items.filter((it) => itemMatchesCar(r.maker, it, rule))
    if (items.length) out.push({ ...r, items })
  }
  return out
}

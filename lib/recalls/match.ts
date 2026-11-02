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
 *     - 세대 코드가 없으면(테슬라 등) 생산기간 시작일이 그 세대 양산 시작일(sop) 이후일 때만 매칭.
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
  /** 세대 코드가 없는 차명을 위한 양산 시작일 (보수적으로 실제보다 약간 늦게 잡음) */
  sop?: string
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
  "kia-sorento-mq4": { maker: /^기아/, names: ["쏘렌토", "sorento"], genCode: "MQ4" },
  "kia-carnival-ka4": { maker: /^기아/, names: ["카니발", "carnival"], genCode: "KA4" },
  "kia-k5-dl3": { maker: /^기아/, names: ["k5"], genCode: "DL3" },
  "hyundai-tucson-nx4": { maker: /^현대자동차/, names: ["투싼", "tucson"], genCode: "NX4" },
  "hyundai-avante-cn7": { maker: /^현대자동차/, names: ["아반떼", "avante", "elantra"], genCode: "CN7" },
  "hyundai-grandeur-gn7": { maker: /^현대자동차/, names: ["그랜저", "grandeur"], genCode: "GN7" },
  "hyundai-santafe-mx5": { maker: /^현대자동차/, names: ["싼타페", "santafe"], genCode: "MX5" },
  // 테슬라 리콜 차명에는 세대 표기가 없어서 생산 시작일로만 판단
  // Model 3 하이랜드: 상하이 양산 2023년 9월 → 2023-10-01 이후 생산분만
  "tesla-model3-highland": { maker: /^테슬라/, names: ["model3", "모델3"], sop: "2023-10-01" },
  // Model Y 주니퍼: 상하이 양산 2025년 1월 → 2025-02-01 이후 생산분만
  "tesla-modely": { maker: /^테슬라/, names: ["modely", "모델y"], sop: "2025-02-01" },
}

const norm = (s: string) => s.toLowerCase().replace(/[\s·\-_]/g, "")

/** "쏘렌토 하이브리드(MQ4 HEV PE)" → { base: "쏘렌토하이브리드", code: "MQ4" } */
export function splitRecallName(name: string): { base: string; code: string | null } {
  const m = name.match(/[(（]\s*([^)）]*)[)）]/)
  const inside = m ? m[1].trim() : ""
  const code = inside ? inside.split(/\s+/)[0].toUpperCase() : null
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
  if (!nameMatches(base, rule.names)) return false

  if (code) {
    // 세대 코드가 적혀 있으면 그것으로만 판단 (다른 세대면 불일치)
    return !!rule.genCode && code === rule.genCode
  }
  // 세대 코드가 없으면 생산 시작일이 양산 시작일 이후일 때만
  if (!rule.sop || !/^\d{4}-\d{2}-\d{2}$/.test(item.from)) return false
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

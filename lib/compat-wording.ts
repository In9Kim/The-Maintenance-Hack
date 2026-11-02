/**
 * 호환성 판정 문구 완화 (AI 프롬프트 + 이 후처리 이중 안전장치)
 *
 * AI가 단정 표현을 써도, 예전에 캐시된 결과에 단정 표현이 남아 있어도
 * 화면에 나가기 전에 여기서 순화하고 결론에 확인 안내를 항상 붙인다.
 */
import type { CompatibilityResult } from "@/lib/gemini"

export const CONFIRM_NOTICE = "구매 전 차량 설명서·품번으로 확인하세요."

const SOFTEN: [RegExp, string][] = [
  [/확정\s*호환/g, "호환 가능성 높음"],
  [/완벽(?:히|하게|한|하)?\s*/g, ""],
  [/100\s*%\s*/g, ""],
  [/틀림없이\s*|무조건\s*/g, ""],
  // "안심하고 구매하셔도 좋습니다" 같은 문장 꼬리 → 제거 (안내 문구로 대체)
  [/[^.!?。]*안심하고\s*(?:구매|교체|사용|장착)[^.!?。]*(?:하셔도|해도|하시면|결정)[^.!?。]*[.!?。]?\s*/g, ""],
  [/안심하고\s*/g, ""],
]

export function softenText(text: string): string {
  let s = text ?? ""
  for (const [re, to] of SOFTEN) s = s.replace(re, to)
  return s.replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim()
}

/** 결론에 확인 안내가 없으면 붙인다 */
export function withConfirmNotice(conclusion: string): string {
  const s = softenText(conclusion)
  if (s.includes("설명서") && s.includes("품번")) return s
  return s ? `${s.replace(/[.!?。]?$/, ".")} ${CONFIRM_NOTICE}` : CONFIRM_NOTICE
}

export function softenResult(r: CompatibilityResult): CompatibilityResult {
  return {
    ...r,
    parts_analysis: (r.parts_analysis ?? []).map((p) => ({ ...p, reason: softenText(p.reason) })),
    expert_tips: (r.expert_tips ?? []).map(softenText).filter(Boolean),
    conclusion: withConfirmNotice(r.conclusion ?? ""),
  }
}

/** 쿠팡 규격 링크 검사 (별칭 import 없는 순수 함수 — node 테스트에서 바로 불러 씀) */
import type { MaintenancePart } from "@/types"

export interface CoupangSpecLink {
  /** 쿠팡 파트너스 링크 (https://link.coupang.com/...) */
  url: string
  /** 상품 이름 (화면에 작게 표시) */
  product: string
  /** 맞는 근거: 순정 품번 또는 규격 문구 (차종 데이터에 있는 값). 여러 개면 모두 들어 있어야 함 (예: ["0W-30", "API SP"]) */
  matches: string | string[]
  /** 엔진이 나뉜 소모품이면 해당 엔진 (차종 데이터의 part.engine과 같아야 함) */
  engine?: string
}

const squash = (s: string) => s.replace(/[\s-]/g, "").toUpperCase()

/** 링크 한 건이 소모품 데이터와 맞는지 검사. 문제가 있으면 이유 목록 */
export function checkCoupangLink(part: MaintenancePart | undefined, link: CoupangSpecLink): string[] {
  const problems: string[] = []
  if (!part) return ["차종 데이터에 없는 소모품 ID"]
  let host = ""
  try {
    host = new URL(link.url).hostname
  } catch {
    problems.push("주소 형식 오류")
  }
  if (host && host !== "link.coupang.com") problems.push(`쿠팡 파트너스 링크가 아님 (${host})`)
  if (!link.product?.trim()) problems.push("상품 이름 없음")
  const wanted = (Array.isArray(link.matches) ? link.matches : [link.matches ?? ""]).filter((m) => squash(m))
  if (!wanted.length) problems.push("맞는 근거(matches) 없음")
  const haystack = squash(`${part.partNumber ?? ""} ${part.spec}`)
  for (const m of wanted) if (!haystack.includes(squash(m))) problems.push(`근거 "${m}"가 소모품 품번·규격에 없음`)
  if ((link.engine ?? "") !== (part.engine ?? "")) problems.push("엔진이 소모품과 다름")
  return problems
}

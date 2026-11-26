/**
 * 순정 품번은 정비핵에 옮겨 싣지 않고(모비스 이용약관 제10조·제13조), 사용자가 현대모비스
 * '부품 간단 검색'에서 직접 찾도록 검색어만 알려 준다.
 *
 * 모비스 검색은 부품명의 띄어쓰기까지 맞아야 나온다 ("오일 필터" 7건, "오일필터" 0건 — 2026-11-24 확인).
 * verified=true 는 그날 실제로 결과가 나온 검색어, false 는 부품명 규칙으로 고른 짧은 단어.
 */
import type { PartCategory } from "@/types"

export const MOBIS_SEARCH_URL = "https://www.mobis-as.com/simple_search_part.do"

export const isMobisBrand = (brand: string) => /^(현대|기아|제네시스)$/.test(brand)

export function mobisKeyword(part: { name: string; category: PartCategory }): { word: string; verified: boolean } | null {
  const n = part.name
  if (part.category === "fluid") return null // 오일·액은 품번보다 규격으로 고르는 게 맞음
  if (part.category === "oil" || /오일필터|오일 필터/.test(n)) return { word: "오일 필터", verified: true }
  if (/패드/.test(n)) return { word: "패드 키트", verified: true }
  if (/디스크/.test(n)) return { word: "디스크", verified: false }
  if (/에어컨|캐빈/.test(n)) return { word: "에어컨", verified: false }
  if (/에어클리너|에어 클리너|에어필터|에어 필터/.test(n)) return { word: "클리너", verified: false }
  if (part.category === "spark") return { word: "플러그", verified: false }
  if (part.category === "wiper") return { word: "와이퍼", verified: false }
  if (part.category === "battery") return { word: "배터리", verified: false }
  return null
}

/** 모비스 모델 목록은 "쏘렌토 20", "K3 18"처럼 '차 이름 + 그 모델이 나온 해 두 자리' */
export const MOBIS_MODEL_TIP = "모델 목록은 '쏘렌토 20'처럼 차 이름 뒤에 그 모델이 나온 해가 붙어 있어요. 내 차 연식과 같거나 바로 앞 숫자를 고르세요."

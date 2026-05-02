import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { COUPANG_AFFILIATE_ID } from "@/lib/config"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR") + "원"
}

export function formatPriceCompact(price: number): string {
  if (price >= 10000) {
    const man = Math.floor(price / 10000)
    const remainder = price % 10000
    if (remainder === 0) return `${man}만원`
    return `${man}만 ${remainder.toLocaleString("ko-KR")}원`
  }
  return formatPrice(price)
}

/**
 * 쿠팡 파트너스 검색 URL을 생성합니다.
 * NEXT_PUBLIC_COUPANG_AFFILIATE_ID 환경변수가 설정되면 어필리에이트 파라미터가 포함됩니다.
 * Phase 2에서 Partners API 딥링크로 업그레이드 예정.
 */
export function getCoupangSearchUrl(keyword: string): string {
  const params = new URLSearchParams({ q: keyword })

  if (COUPANG_AFFILIATE_ID !== "YOUR_AFFILIATE_ID") {
    params.set("affiliate", "biz_click")
    params.set("subId", COUPANG_AFFILIATE_ID)
  }

  return `https://www.coupang.com/np/search?${params.toString()}`
}

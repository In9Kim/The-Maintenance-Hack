/**
 * 쿠팡 파트너스 설정
 *
 * 1. https://partners.coupang.com 에서 파트너스 가입
 * 2. 마이페이지 > API 연동에서 accessKey 발급
 * 3. 아래 값을 발급받은 ID로 교체하거나 .env.local에 설정:
 *    NEXT_PUBLIC_COUPANG_AFFILIATE_ID=AF_YOUR_ACTUAL_ID
 *
 * Phase 2에서 Partners API로 실시간 딥링크 생성으로 업그레이드 예정.
 */
export const COUPANG_AFFILIATE_ID =
  process.env.NEXT_PUBLIC_COUPANG_AFFILIATE_ID ?? "YOUR_AFFILIATE_ID"

/** 공임나라 예약 페이지 */
export const GONGIM_RESERVATION_URL = "https://www.gongim.com/"

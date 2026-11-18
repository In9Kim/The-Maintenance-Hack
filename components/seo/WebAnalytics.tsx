import Script from "next/script"

/**
 * Cloudflare Web Analytics (무료, 쿠키 없음). 방문자 수·유입 경로·인기 페이지를 대시보드에서 본다.
 * 토큰은 Cloudflare 대시보드 > Web Analytics > 사이트 추가 후 나오는 JS 코드의 "token" 값.
 * 공개되는 값이라 코드에 둬도 된다 (환경변수가 있으면 그 값 우선). 비어 있으면 아무것도 넣지 않는다.
 */
const CF_BEACON_TOKEN = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN || "7fbbf8d528b24ad99fae0da337936411"

export function WebAnalytics() {
  if (!CF_BEACON_TOKEN) return null
  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      data-cf-beacon={JSON.stringify({ token: CF_BEACON_TOKEN, spa: true })}
    />
  )
}

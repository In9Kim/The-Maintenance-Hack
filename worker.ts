/**
 * Worker 진입점. OpenNext 워커를 감싸서, 예전 주소(workers.dev 운영 주소)와 www로 들어오면
 * 캐시·미들웨어보다 먼저 jungbihack.com으로 301 이동시킨다.
 * (enableCacheInterception 때문에 미리 만든 페이지는 middleware.ts를 거치지 않고 나가므로 여기서 처리)
 * 미리보기 주소(overhaul-… 등)는 그대로 둔다.
 */
import handler from "./.open-next/worker.js"
import { runDailyPush, type KV } from "./lib/push-store"

const CANONICAL_HOST = "jungbihack.com"
const OLD_HOSTS = new Set(["maintenance-hack.wwe9459.workers.dev", "www.jungbihack.com"])

/**
 * 보안 헤더 (워커가 그리는 모든 응답: 페이지·API). 정적 파일(_next/static, 이미지)은 워커를 거치지 않아 public/_headers에 같은 값.
 * CSP는 처음엔 '보고만'(Report-Only): 애드센스·카카오 지도가 부르는 출처가 자주 바뀌어서 바로 막으면 광고·지도가 깨질 수 있음.
 * 브라우저 콘솔에 위반이 안 보이면 Content-Security-Policy로 바꾼다. 다른 사이트가 iframe으로 감싸는 것(frame-ancestors)은 지금부터 막는다.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // Next가 넣는 인라인 스크립트(하이드레이션)·layout.tsx의 내 차 표시 스크립트 때문에 'unsafe-inline'
  "script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.adtrafficquality.google https://fundingchoicesmessages.google.com https://static.cloudflareinsights.com https://dapi.kakao.com https://*.daumcdn.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  // 쿠팡 상품 사진·차 사진·지도 타일 출처가 여러 곳이라 https 이미지는 허용
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cloudflareinsights.com https://*.kakao.com https://*.daumcdn.net https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.adtrafficquality.google",
  "frame-src 'self' https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ")

const SECURITY_HEADERS: Record<string, string> = {
  // 지금 바로 지키는 것: 다른 사이트의 iframe 안에 못 넣게, 플러그인·<base> 바꿔치기 금지
  "Content-Security-Policy": "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
  "Content-Security-Policy-Report-Only": CSP_REPORT_ONLY,
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // 위치는 근처 정비소 지도에서만 씀. 카메라·마이크는 안 씀 (견적서 사진은 파일 고르기라 해당 없음)
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
}
const HSTS = "max-age=31536000; includeSubDomains"

function withSecurityHeaders(res: Response, https: boolean): Response {
  if (res.status === 101) return res
  const out = new Response(res.body, res)
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!out.headers.has(k)) out.headers.set(k, v)
  if (https) out.headers.set("Strict-Transport-Security", HSTS)
  return out
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url)
    const host = url.hostname.toLowerCase()
    if (OLD_HOSTS.has(host)) {
      return Response.redirect(`https://${CANONICAL_HOST}${url.pathname}${url.search}`, 301)
    }
    // http로 들어오면 https로 (운영 도메인·workers.dev만. 로컬 wrangler 미리보기 http://localhost는 그대로)
    if (url.protocol === "http:" && (host === CANONICAL_HOST || host.endsWith(".workers.dev"))) {
      return Response.redirect(`https://${host}${url.pathname}${url.search}`, 301)
    }
    const res = await handler.fetch(request, env, ctx)
    return withSecurityHeaders(res, url.protocol === "https:")
  },
  // 매일 09:00(한국 시간) 교체 시기 알림 보내기 (wrangler.jsonc triggers.crons)
  async scheduled(_event: unknown, env: { VERIFY_LIMIT?: KV; VAPID_PRIVATE_KEY?: string }, ctx: { waitUntil(p: Promise<unknown>): void }) {
    if (!env.VERIFY_LIMIT || !env.VAPID_PRIVATE_KEY) return
    ctx.waitUntil(runDailyPush(env.VERIFY_LIMIT, env.VAPID_PRIVATE_KEY).then((r) => console.log(JSON.stringify({ push: r }))))
  },
}

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js"
// 하루 횟수 세기 (wrangler.jsonc durable_objects LIMITS)
export { LimitCounter } from "./lib/limit-counter"

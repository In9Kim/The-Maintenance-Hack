/**
 * Worker 진입점. OpenNext 워커를 감싸서, 예전 주소(workers.dev 운영 주소)와 www로 들어오면
 * 캐시·미들웨어보다 먼저 jungbihack.com으로 301 이동시킨다.
 * (enableCacheInterception 때문에 미리 만든 페이지는 middleware.ts를 거치지 않고 나가므로 여기서 처리)
 * 미리보기 주소(overhaul-… 등)는 그대로 둔다.
 */
import handler from "./.open-next/worker.js"

const CANONICAL_HOST = "jungbihack.com"
const OLD_HOSTS = new Set(["maintenance-hack.wwe9459.workers.dev", "www.jungbihack.com"])

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url)
    if (OLD_HOSTS.has(url.hostname.toLowerCase())) {
      return Response.redirect(`https://${CANONICAL_HOST}${url.pathname}${url.search}`, 301)
    }
    return handler.fetch(request, env, ctx)
  },
}

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js"

import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache"

// 모든 공개 페이지는 빌드 때 미리 만들어지는 정적 페이지(SSG)라
// R2(유료 카드 등록 필요) 없이 정적 자산 캐시만 사용합니다.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
})

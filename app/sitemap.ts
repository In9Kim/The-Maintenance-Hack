import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo"
import { sitePages } from "@/lib/site-pages"

/** 페이지 목록과 lastmod 규칙은 lib/site-pages.ts (RSS와 공용) */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitePages().map((p) => ({
    url: `${SITE_URL}${p.path}`,
    ...(p.lastModified ? { lastModified: p.lastModified } : {}),
    priority: p.priority,
  }))
}

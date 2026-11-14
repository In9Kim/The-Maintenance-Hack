import { SITE_URL } from "@/lib/seo"
import { sitePages } from "@/lib/site-pages"
import { buildRss, latestItems, type RssItem } from "@/lib/rss"

// 빌드 때 한 번 만든다 (리콜 데이터가 바뀌면 자동 재배포로 갱신). 날짜는 데이터 기준이라 요청 시각과 무관
export const dynamic = "force-static"

/** 최근 리콜 페이지(제작사·차종별)와 차종 페이지 중 최근에 바뀐 30개 */
const LIMIT = 30
const KINDS = new Set(["maker", "car-recalls", "car"])

export function GET() {
  const items: RssItem[] = sitePages()
    .filter((p) => KINDS.has(p.kind) && p.lastModified && p.title)
    .map((p) => ({
      title: p.title!,
      link: `${SITE_URL}${p.path}`,
      date: p.lastModified!,
      description: p.description || p.title!,
    }))

  const xml = buildRss(
    {
      title: "정비핵 · 최근 자동차 리콜·차종 정비 정보",
      link: `${SITE_URL}/`,
      description: "제작사·차종별 최근 자동차 리콜과 차종별 소모품 규격·정비 비용 페이지 업데이트",
      selfUrl: `${SITE_URL}/rss.xml`,
    },
    latestItems(items, LIMIT)
  )
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } })
}

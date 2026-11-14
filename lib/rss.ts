/**
 * RSS 2.0 만들기. 데이터 파일을 읽지 않는 순수 함수만 둔다 (npm test로 검사).
 * 날짜는 모두 데이터의 날짜(YYYY-MM-DD)에서 나오며 요청·빌드 시각은 쓰지 않는다.
 */

export interface RssItem {
  title: string
  /** 절대 주소 */
  link: string
  /** 페이지 내용이 바뀐 날 (YYYY-MM-DD) */
  date: string
  description: string
}

export interface RssChannel {
  title: string
  link: string
  description: string
  /** 피드 자신의 주소 (atom:link rel="self") */
  selfUrl: string
}

export const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!)

/** "2026-11-05" → "Wed, 04 Nov 2026 15:00:00 GMT" (한국시간 자정, RFC 822) */
export const rfc822 = (ymd: string) => new Date(`${ymd}T00:00:00+09:00`).toUTCString()

/** 최근 날짜 순(같은 날은 넣은 순서 유지)으로 limit개 */
export function latestItems(items: RssItem[], limit: number): RssItem[] {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => b.it.date.localeCompare(a.it.date) || a.i - b.i)
    .slice(0, limit)
    .map(({ it }) => it)
}

export function buildRss(channel: RssChannel, items: RssItem[]): string {
  const e = escapeXml
  const lastBuild = items.reduce((m, it) => (it.date > m ? it.date : m), "")
  const body = items
    .map(
      (it) => `<item>
<title>${e(it.title)}</title>
<link>${e(it.link)}</link>
<guid isPermaLink="false">${e(`${it.link}#${it.date}`)}</guid>
<pubDate>${rfc822(it.date)}</pubDate>
<description>${e(it.description)}</description>
</item>`
    )
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${e(channel.title)}</title>
<link>${e(channel.link)}</link>
<description>${e(channel.description)}</description>
<language>ko</language>
<atom:link href="${e(channel.selfUrl)}" rel="self" type="application/rss+xml"/>
${lastBuild ? `<lastBuildDate>${rfc822(lastBuild)}</lastBuildDate>\n` : ""}${body}
</channel>
</rss>
`
}

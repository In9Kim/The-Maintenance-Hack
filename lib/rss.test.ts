// 실행: npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { buildRss, escapeXml, latestItems, rfc822, type RssItem } from "./rss.ts"

const item = (date: string, n: number): RssItem => ({
  title: `제목 ${n}`,
  link: `https://example.com/p/${n}`,
  date,
  description: `설명 ${n}`,
})

test("pubDate는 데이터 날짜(한국시간 자정)의 RFC 822", () => {
  assert.equal(rfc822("2026-11-05"), "Wed, 04 Nov 2026 15:00:00 GMT")
})

test("최근 날짜 순, 같은 날은 넣은 순서, limit개", () => {
  const items = [item("2026-11-05", 1), item("2026-11-11", 2), item("2026-11-05", 3), item("2026-10-30", 4)]
  assert.deepEqual(latestItems(items, 3).map((i) => i.title), ["제목 2", "제목 1", "제목 3"])
})

test("XML 특수문자 이스케이프, lastBuildDate는 가장 최근 항목 날짜", () => {
  assert.equal(escapeXml(`A&B <c> "d" 'e'`), "A&amp;B &lt;c&gt; &quot;d&quot; &apos;e&apos;")
  const xml = buildRss(
    { title: "피드 & 채널", link: "https://example.com/", description: "설명", selfUrl: "https://example.com/rss.xml" },
    [{ ...item("2026-11-11", 1), title: "리콜 <중대>" }, item("2026-11-05", 2)]
  )
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'))
  assert.match(xml, /<title>피드 &amp; 채널<\/title>/)
  assert.match(xml, /<title>리콜 &lt;중대&gt;<\/title>/)
  assert.match(xml, /<lastBuildDate>Tue, 10 Nov 2026 15:00:00 GMT<\/lastBuildDate>/)
  assert.equal((xml.match(/<item>/g) ?? []).length, 2)
  assert.match(xml, /<guid isPermaLink="false">https:\/\/example\.com\/p\/1#2026-11-11<\/guid>/)
})

test("항목이 없으면 lastBuildDate 생략", () => {
  const xml = buildRss({ title: "t", link: "l", description: "d", selfUrl: "s" }, [])
  assert.doesNotMatch(xml, /lastBuildDate/)
})

/**
 * 국토교통부 리콜 보도자료 파싱·검증 (네트워크 없이 테스트 가능한 순수 함수만)
 *
 * 흐름
 *   목록 HTML → parseListHtml → 리콜 보도자료만
 *   상세 HTML → findPdfUrl → PDF 텍스트 (fetch-recall-news.mjs에서 pdfjs로 추출)
 *   PDF 텍스트 → buildExtractPrompt → AI(JSON) → validateExtraction(원문 대조) → 저장
 *
 * 원칙: AI가 뽑은 숫자·날짜는 반드시 원문 텍스트에 있어야 한다. 없으면 버리거나 비운다.
 */

export const MOLIT_BASE = "https://www.molit.go.kr"
export const MOLIT_LIST_PATH = "/USR/NEWS/m_71/lst.jsp"
export const MOLIT_DETAIL_PATH = "/USR/NEWS/m_71/dtl.jsp"

/** 리콜 보도자료로 볼 제목 */
export function isRecallTitle(title) {
  return /리콜|시정조치/.test(title)
}

const decodeEntities = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&middot;/g, "·")

const stripTags = (s) => decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim()

/** 보도자료 목록 HTML → [{ id, title, date, url }] */
export function parseListHtml(html) {
  const out = []
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []
  for (const row of rows) {
    const a = row.match(/<a[^>]+href=["']([^"']*dtl\.jsp[^"']*?id=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i)
    if (!a) continue
    const date = row.match(/(20\d{2}-\d{2}-\d{2})/)?.[1] ?? null
    const id = a[2]
    out.push({
      id,
      title: stripTags(a[3]),
      date,
      url: `${MOLIT_BASE}${MOLIT_DETAIL_PATH}?id=${id}`,
    })
  }
  return out
}

/** 상세 HTML → 첨부 PDF 주소 (없으면 null) */
export function findPdfUrl(html) {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => decodeEntities(m[1]))
  const pdf = hrefs.find((h) => {
    try {
      return /\.pdf(\b|$)/i.test(decodeURIComponent(h))
    } catch {
      return /\.pdf/i.test(h)
    }
  })
  if (!pdf) return null
  return pdf.startsWith("http") ? pdf : `${MOLIT_BASE}${pdf.startsWith("/") ? "" : "/"}${pdf}`
}

/** 상세 HTML → 부제(요약 줄) */
export function parseDetailSummary(html) {
  const m = html.match(/class=["'][^"']*bd_view[^"']*["'][\s\S]*?<\/div>\s*<\/div>/i)
  const text = stripTags(m ? m[0] : html)
  return text.match(/총\s*\d+개사[^가-힣]*[\s\S]{0,80}?대/)?.[0]?.trim() ?? null
}

// ── 원문 대조 ────────────────────────────────────────────────────────────────

/** 비교용: 공백·물결·백틱 표기 차이 제거 */
const squash = (s) => s.replace(/\s+/g, "").replace(/[∼～〜~]/g, "~").replace(/[`'‘’]/g, "`")

/** "2023-07-24" → 원문 표기 후보 ["`23.07.24.", "2023. 7. 24."...] 중 하나라도 원문에 있는지 */
export function dateInText(iso, text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "")
  if (!m) return false
  const [, y, mo, d] = m
  const t = squash(text)
  const yy = y.slice(2)
  const candidates = [
    `\`${yy}.${mo}.${d}`,
    `${yy}.${mo}.${d}`,
    `${y}.${mo}.${d}`,
    `${y}.${+mo}.${+d}`,
    `${y}-${mo}-${d}`,
  ]
  return candidates.some((c) => t.includes(c))
}

/** 시정 시작일은 본문에 "7월 30일부터"처럼 연도 없이 나옴 */
export function monthDayInText(iso, text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "")
  if (!m) return false
  const t = squash(text)
  return t.includes(`${+m[2]}월${+m[3]}일`) || dateInText(iso, text)
}

/** 대수(예: 51016)가 원문에 "51,016" 또는 "51016"으로 있는지 */
export function numberInText(n, text) {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return false
  // 숫자 덩어리 단위로 비교 (2,419 안의 419 같은 부분 일치는 인정하지 않음)
  const tokens = new Set(text.match(/\d[\d,]*\d|\d/g) ?? [])
  return tokens.has(n.toLocaleString("en-US")) || tokens.has(String(n))
}

/** 보도시점 연도 (시정 시작일 연도 추정용) */
export function pressYear(text) {
  return Number(text.match(/보도시점\s*:?\s*(20\d{2})\s*\./)?.[1]) || null
}

/**
 * AI 추출 결과를 원문과 대조해 정리한다.
 *  - 생산기간(from/to)이 원문에 없는 차는 버린다
 *  - 대수가 원문에 없으면 null
 *  - 시정 시작일이 원문에 없으면 null
 *  - 차가 하나도 남지 않은 묶음은 버린다
 *  group.verified: 모든 차·숫자가 원문과 일치했는지
 */
export function validateExtraction(ai, text) {
  const groups = []
  for (const g of Array.isArray(ai?.groups) ? ai.groups : []) {
    let ok = true
    const cars = []
    for (const c of Array.isArray(g.cars) ? g.cars : []) {
      const name = String(c?.name ?? "").trim()
      if (!name || !dateInText(c.from, text) || !dateInText(c.to, text)) {
        ok = false
        continue
      }
      const count = numberInText(c.count, text) ? c.count : null
      if (c.count != null && count == null) ok = false
      cars.push({ name, from: c.from, to: c.to, count })
    }
    if (!cars.length) continue
    const startDate = monthDayInText(g.startDate, text) ? g.startDate : null
    if (g.startDate && !startDate) ok = false
    const total = numberInText(g.total, text) ? g.total : null
    if (g.total != null && total == null) ok = false
    groups.push({
      maker: String(g.maker ?? "").trim(),
      part: g.part ? String(g.part).trim() : null,
      defect: String(g.defect ?? "").replace(/\s+/g, " ").trim(),
      startDate,
      total,
      cars,
      verified: ok,
    })
  }
  return { summary: typeof ai?.summary === "string" ? ai.summary.trim() : null, groups }
}

// ── AI 프롬프트 ──────────────────────────────────────────────────────────────

export function buildExtractPrompt(text) {
  return `아래는 국토교통부 자동차 리콜(자발적 시정조치) 보도자료 PDF에서 뽑은 텍스트다.
원문에 있는 내용만 JSON으로 정리하라. 원문에 없는 숫자·날짜·차명을 만들어 내면 안 된다.

[규칙]
- groups: "대상자동차(...) 결함장치(...)" 표 하나 = 묶음 하나.
- maker: 그 표가 속한 "□ 제작사" 이름 그대로 (예: "현대자동차㈜").
- part: 결함장치 이름. defect: 결함 내용 한두 문장 (표의 * 설명이나 본문 문장).
- startDate: 본문에 나온 그 묶음의 시정조치 시작일. "7월 30일부터" → 보도시점 연도를 붙여 "YYYY-MM-DD". 없으면 null.
- total: 그 표의 "합계" 숫자 (정수). 없으면 null.
- cars: 표의 각 차명 행. name은 차명(형식) 그대로, from/to는 제작일자 범위를 "YYYY-MM-DD"로 ('23.07.24. → 2023-07-24), count는 그 행의 대상대수 정수(괄호 안 미판매 대수는 더하지 말 것).
- summary: 보도자료 부제 한 줄 (예: "총 4개사 13개 차종 512,393대 자발적 시정조치").

[출력 — JSON만]
{"summary": "...", "groups": [{"maker": "...", "part": "...", "defect": "...", "startDate": "YYYY-MM-DD"|null, "total": 0, "cars": [{"name": "...", "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "count": 0}]}]}

[보도자료 텍스트]
${text.slice(0, 30000)}`
}

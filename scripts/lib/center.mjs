/**
 * 자동차리콜센터(car.go.kr) 리콜현황 게시판 파싱 (네트워크 없이 테스트 가능한 순수 함수만)
 *
 * 국토부 보도자료는 몇 주~몇 달에 한 번만 나오지만, 리콜센터 게시판에는 제작사가 리콜을 시작할 때마다
 * 한 건씩 바로 올라온다 (언론의 "국토교통부 자동차리콜센터에 따르면…" 기사의 출처).
 *
 *  목록  POST /ri/stat/list.do   currentPageNo=N        → 5건씩, 시정 시작일이 최근인 순
 *  상세  POST /ri/stat/detail.do recallId=6413&ctype=O  → 제작사·차명·생산기간·시정 시작일·대수·결함·시정방법 표
 *
 * 상세 표가 정형화되어 있어 AI 없이 그대로 읽는다.
 */

export const CENTER_BASE = "https://www.car.go.kr"
export const CENTER_LIST_PATH = "/ri/stat/list.do"
export const CENTER_DETAIL_PATH = "/ri/stat/detail.do"

const decodeEntities = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")

/** 태그 제거. 문단·줄바꿈 태그는 줄바꿈으로 남긴다 */
function toText(html) {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr)>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
  )
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
}

/** 목록 HTML → [{ recallId, ctype, title, date, serious }] */
export function parseCenterList(html) {
  const out = []
  const re = /detailView\('(\d+)'\s*,\s*'(\w*)'\)[\s\S]*?<strong>([\s\S]*?)<\/strong>[\s\S]*?<ol>([\s\S]*?)<\/ol>/g
  for (const m of html.matchAll(re)) {
    const [, recallId, ctype, strong, ol] = m
    const date = ol.match(/(20\d{2}-\d{2}-\d{2})/)?.[1] ?? null
    const serious = /중대리콜/.test(strong)
    const title = toText(strong.replace(/<span[\s\S]*?<\/span>/gi, "")).replace(/\s+/g, " ").trim()
    out.push({ recallId, ctype: ctype || "O", title, date, serious })
  }
  return out
}

/** 목록 HTML → 전체 건수 */
export function parseCenterTotal(html) {
  const n = html.match(/전체\s*(?:<[^>]*>\s*)*([\d,]+)\s*(?:<[^>]*>\s*)*건/)?.[1]
  return n ? Number(n.replace(/,/g, "")) : null
}

/** "아반떼 (HD), i30 (FD)" → ["아반떼 (HD)", "i30 (FD)"] (괄호 안 쉼표는 나누지 않음) */
export function splitCarNames(s) {
  const out = []
  let depth = 0
  let cur = ""
  for (const ch of s) {
    if (ch === "(" || ch === "（") depth++
    if (ch === ")" || ch === "）") depth = Math.max(0, depth - 1)
    if (ch === "," && depth === 0) {
      if (cur.trim()) out.push(cur.trim())
      cur = ""
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** "2020.07. 29" / "2020-07-29" → "2020-07-29" */
export function normDate(s) {
  const m = String(s ?? "").replace(/\s+/g, "").match(/(20\d{2}|19\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
}

const NORM_NAME = (s) => s.replace(/\s+/g, "").toLowerCase()

/** 결함내용 안의 "<대상차량별 생산일자>" 줄들 → { 차명: {from,to} } */
function perCarDates(text) {
  const i = text.indexOf("대상차량별 생산일자")
  if (i < 0) return []
  const out = []
  const tail = text.slice(i).split("\n").slice(1)
  for (const line of tail) {
    const m = line.match(/^(.+?)\s*[:：]\s*([\d.\-\s/]{8,}?)\s*[~∼～〜]\s*([\d.\-\s/]{8,})/)
    if (!m) continue
    const from = normDate(m[2])
    const to = normDate(m[3])
    if (from && to) out.push({ name: m[1].trim(), from, to })
  }
  return out
}

/** 상세 HTML → 리콜 한 건. 표를 못 읽으면 null */
export function parseCenterDetail(html) {
  const table = html.match(/<table[\s\S]*?제작\(수입\)사[\s\S]*?<\/table>/i)?.[0]
  if (!table) return null
  const cells = {}
  for (const m of table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi)) {
    cells[toText(m[1]).replace(/\s+/g, "")] = toText(m[2])
  }
  const maker = cells["제작(수입)사"]?.replace(/\s+/g, " ").trim()
  const carField = cells["차명"]?.replace(/\s+/g, " ").trim()
  if (!maker || !carField) return null

  const [pFrom, pTo] = (cells["생산기간"] ?? "").split(/[~∼～〜]/)
  const from = normDate(pFrom)
  const to = normDate(pTo)
  const startDate = normDate((cells["시정기간"] ?? "").split(/[~∼～〜]/)[0])
  const count = Number((cells["대상수량"] ?? "").replace(/[^\d]/g, "")) || null
  const defectFull = cells["결함내용"] ?? ""
  const reason = defectFull
    .split(/\n?<?\s*대상차량별 생산일자/)[0]
    .replace(/\s+/g, " ")
    .trim()
  const fix = (cells["시정방법"] ?? "").replace(/\s+/g, " ").trim() || null
  const part = (cells["장치분류"] ?? "").replace(/\s+/g, " ").trim() || null

  // 차명별 생산기간이 결함내용에 따로 적혀 있으면 그걸 쓰고, 없으면 전체 생산기간을 모든 차명에 적용
  const names = splitCarNames(carField)
  const perCar = perCarDates(defectFull)
  const items = names.map((name) => {
    const hit = perCar.find((p) => NORM_NAME(p.name) === NORM_NAME(name))
    return { name, from: hit?.from ?? from ?? "", to: hit?.to ?? to ?? "" }
  })

  return { maker, carField, from, to, startDate, count, part, reason, fix, items }
}

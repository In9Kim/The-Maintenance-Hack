#!/usr/bin/env node
/**
 * 국토교통부 리콜 보도자료 수집 (GitHub Actions에서 하루 1번)
 *
 * 공공데이터 리콜 API는 연 1회 갱신이라 "새 리콜"이 거의 안 들어옴 → 매달 나오는 국토부 보도자료로 보완.
 *
 *  1) 국토부 보도자료 목록에서 제목에 '리콜'이 들어간 글 검색 (요청 1번)
 *  2) 새 글만 상세 페이지 → 첨부 PDF → 텍스트 추출 (pdfjs-dist)
 *  3) Gemini(무료 등급)로 표를 JSON으로 정리 → 원문 대조 검증(scripts/lib/news.mjs)
 *  4) data/recall_news.json 저장 + data/recalls_new.json(최근 7일 새 리콜) 갱신
 *
 * 환경변수
 *   GEMINI_API_KEY   없으면 보도자료 제목·링크만 저장하고 표 정리는 다음 실행 때 다시 시도
 *   GEMINI_MODELS    "a,b,c" (기본: gemini-3.8-flash, gemini-3.6-flash, gemini-3.5-flash-lite)
 *   NEWS_LOOKBACK_DAYS  목록 검색 기간 (기본 120일, 첫 실행은 365일)
 *
 * PDF 텍스트 추출에 pdfjs-dist가 필요: npm install --no-save pdfjs-dist@6.4.299
 */
import { writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { NEWS_FILE, addDays, hash, makerInfo, readJson, stable, todayKst, writeRecallsNew } from "./lib/common.mjs"
import {
  MOLIT_BASE,
  MOLIT_LIST_PATH,
  buildExtractPrompt,
  findPdfUrl,
  isRecallTitle,
  parseDetailSummary,
  parseListHtml,
  validateExtraction,
} from "./lib/news.mjs"

const UA = "MaintenanceHackBot/1.0 (+https://maintenance-hack.wwe9459.workers.dev; recall news, 1 request/day)"
const MODELS = (process.env.GEMINI_MODELS || "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
const MAX_NEW_PER_RUN = 12
const MAX_ATTEMPTS = 3

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 국토부 사이트는 세션 쿠키를 심고 같은 주소로 다시 보내는 방식이라, 쿠키를 기억하지 않으면 무한 리다이렉트가 됨
const cookies = new Map()

function rememberCookies(res) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : []
  for (const c of list) {
    const [pair] = c.split(";")
    const i = pair.indexOf("=")
    if (i > 0) cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
  }
}

const cookieHeader = () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; ")

async function get(url, as = "text") {
  let current = url
  for (let hop = 0; hop < 10; hop++) {
    let res
    try {
      res = await fetch(current, {
        redirect: "manual",
        headers: {
          "User-Agent": UA,
          "Accept-Language": "ko-KR,ko;q=0.9",
          ...(cookies.size ? { Cookie: cookieHeader() } : {}),
        },
        signal: AbortSignal.timeout(30_000),
      })
    } catch (err) {
      // "fetch failed"만으로는 원인을 알 수 없어 실제 원인(인증서·연결 거부·시간 초과 등)을 같이 남김
      const cause = err?.cause ? ` (${err.cause.code ?? ""} ${err.cause.message ?? err.cause})` : ""
      throw new Error(`접속 실패: ${current.slice(0, 80)} — ${err?.message ?? err}${cause}`)
    }
    rememberCookies(res)
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location"), current).href
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${current}`)
    return as === "buffer" ? new Uint8Array(await res.arrayBuffer()) : res.text()
  }
  throw new Error(`리다이렉트가 너무 많음: ${url}`)
}

async function pdfText(data) {
  // Actions에서는 프로젝트 전체 설치 없이 임시 폴더에 pdfjs만 설치하고 PDFJS_MODULE로 경로를 넘긴다
  const spec = process.env.PDFJS_MODULE
    ? pathToFileURL(process.env.PDFJS_MODULE).href
    : "pdfjs-dist/legacy/build/pdf.mjs"
  let pdfjs
  try {
    pdfjs = await import(spec)
  } catch {
    throw new Error("pdfjs-dist가 없습니다. npm install --no-save pdfjs-dist@6.4.299")
  }
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise
  let out = ""
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let lastY = null
    for (const it of content.items) {
      if (!("str" in it)) continue
      const y = it.transform?.[5]
      if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2) out += "\n"
      out += it.str
      if (y !== undefined) lastY = y
    }
    out += "\n"
  }
  return out
}

async function extractWithAi(text) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error("GEMINI_API_KEY 없음")
  let lastErr
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(90_000),
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: buildExtractPrompt(text) }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0, thinkingConfig: { thinkingLevel: "low" } },
          }),
        }
      )
      if (!res.ok) throw new Error(`${model}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
      const body = await res.json()
      const raw = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
      const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? raw)
      return { model, json }
    } catch (err) {
      lastErr = err
      console.warn(`  - ${model} 실패: ${String(err?.message ?? err).slice(0, 200)}`)
    }
  }
  throw lastErr
}

/** 보도자료 한 건 처리 → 저장할 항목 */
async function processItem(row, prevItem, firstSeen) {
  const item = {
    id: row.id,
    title: row.title,
    date: row.date,
    url: row.url,
    pdfUrl: prevItem?.pdfUrl ?? null,
    summary: prevItem?.summary ?? null,
    groups: prevItem?.groups ?? [],
    extractedBy: prevItem?.extractedBy ?? null,
    attempts: (prevItem?.attempts ?? 0) + 1,
    needsRetry: false,
    firstSeen,
  }
  try {
    const html = await get(row.url)
    item.summary = item.summary ?? parseDetailSummary(html)
    item.pdfUrl = findPdfUrl(html)
    if (!item.pdfUrl) throw new Error("첨부 PDF를 찾지 못함")
    await sleep(1000)
    const text = await pdfText(await get(item.pdfUrl, "buffer"))
    const { model, json } = await extractWithAi(text)
    const checked = validateExtraction(json, text)
    item.summary = checked.summary || item.summary
    // 사이트·recalls_new.json에서 그대로 쓰도록 고정 ID와 제작사 표시명/주소를 붙여 둔다
    item.groups = checked.groups.map((g, i) => ({
      id: `${g.startDate || row.date}-molit-${hash(`${row.id}|${i}|${g.defect}`)}`,
      ...makerInfo(g.maker || "제작사 미상"),
      ...g,
    }))
    item.extractedBy = model
    const cars = checked.groups.reduce((n, g) => n + g.cars.length, 0)
    const unverified = checked.groups.filter((g) => !g.verified).length
    console.log(`  ✓ 묶음 ${checked.groups.length}개 · 차명 ${cars}개${unverified ? ` (원문과 다른 값 있던 묶음 ${unverified}개 — 해당 값은 비움)` : ""}`)
  } catch (err) {
    item.error = String(err?.message ?? err).slice(0, 300)
    // 키가 아직 없는 건 설정 문제라 재시도 횟수를 쓰지 않는다 (키를 넣으면 다음 실행 때 정리됨)
    if (/GEMINI_API_KEY 없음/.test(item.error)) item.attempts -= 1
    item.needsRetry = item.attempts < MAX_ATTEMPTS
    console.warn(`  ! ${item.error}${item.needsRetry ? " → 다음 실행 때 다시 시도" : ""}`)
  }
  return item
}

async function main() {
  const today = todayKst()
  const prev = await readJson(NEWS_FILE, { updatedAt: null, items: [] })
  const bootstrap = !existsSync(NEWS_FILE) || prev.items.length === 0
  const lookback = parseInt(process.env.NEWS_LOOKBACK_DAYS ?? "", 10) || (bootstrap ? 365 : 120)

  const listUrl =
    `${MOLIT_BASE}${MOLIT_LIST_PATH}?search=${encodeURIComponent("리콜")}&srch_usr_titl=Y` +
    `&search_regdate_s=${addDays(today, -lookback)}&search_regdate_e=${today}&lcmspage=1`
  const rows = parseListHtml(await get(listUrl)).filter((r) => isRecallTitle(r.title))
  console.log(`국토부 리콜 보도자료 ${rows.length}건 (최근 ${lookback}일)`)
  if (!rows.length && prev.items.length) {
    // 목록이 비면 사이트 구조가 바뀌었을 수 있음 → 실패로 알림
    throw new Error("보도자료 목록을 하나도 읽지 못했습니다. 국토부 게시판 구조가 바뀌었는지 확인하세요.")
  }

  const prevById = new Map(prev.items.map((it) => [it.id, it]))
  const todo = rows.filter((r) => !prevById.has(r.id) || prevById.get(r.id).needsRetry).slice(0, MAX_NEW_PER_RUN)

  const updated = new Map(prevById)
  for (const row of todo) {
    console.log(`- ${row.date} ${row.title}`)
    const prevItem = prevById.get(row.id)
    // 처음 보는 글: 첫 실행이면 보도일, 아니면 오늘 (새 리콜로 잡힘)
    const firstSeen = prevItem?.firstSeen ?? (bootstrap ? row.date : today)
    updated.set(row.id, await processItem(row, prevItem, firstSeen))
    await sleep(1500)
  }

  const items = [...updated.values()].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id.localeCompare(a.id))
  const next = { updatedAt: today, source: `${MOLIT_BASE}${MOLIT_LIST_PATH}`, items }
  if (stable({ ...next, updatedAt: null }) !== stable({ ...prev, updatedAt: null, source: next.source })) {
    await writeFile(NEWS_FILE, JSON.stringify(next, null, 1) + "\n")
    console.log(`recall_news.json 갱신: 보도자료 ${items.length}건`)
  } else {
    console.log("recall_news.json 변경 없음")
  }

  await writeRecallsNew(today)
}

main().catch((err) => {
  console.error(String(err?.message ?? err))
  process.exit(1)
})

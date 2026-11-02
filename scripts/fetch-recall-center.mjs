#!/usr/bin/env node
/**
 * 자동차리콜센터(car.go.kr) 리콜현황 수집 (GitHub Actions에서 하루 2번)
 *
 * 왜 필요한가
 *   - 공공데이터 연간 파일은 1년에 1번 갱신
 *   - 국토부 보도자료는 몇 주~몇 달에 1번 (2026-08-06 이후 한동안 없음)
 *   - 리콜센터 게시판은 제작사가 리콜을 시작할 때마다 바로 올라옴 → 가장 빠른 공식 출처
 *
 *  1) 목록 POST /ri/stat/list.do 를 1쪽부터 넘기며 리콜 ID 수집
 *     - 처음 실행: 연간 데이터 기준일(dataAsOf) 다음 날 이후 시작한 리콜 전부
 *     - 이후 실행: 최근 RECENT_DAYS일만 (모르는 ID만 상세 조회)
 *  2) 새 ID만 상세 POST /ri/stat/detail.do → 표를 그대로 읽어 저장 (AI 사용 안 함)
 *  3) data/recall_center.json 저장 + data/recalls_new.json 갱신
 *
 * 환경변수
 *   CENTER_RECENT_DAYS  이후 실행 때 목록을 볼 기간 (기본 45일)
 *   CENTER_MAX_DETAILS  한 번에 조회할 상세 수 상한 (기본 400)
 */
import { writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import {
  CENTER_FILE,
  RECALLS_FILE,
  addDays,
  makerInfo,
  readJson,
  stable,
  todayKst,
  writeRecallsNew,
} from "./lib/common.mjs"
import { CENTER_BASE, CENTER_DETAIL_PATH, CENTER_LIST_PATH, parseCenterDetail, parseCenterList, parseCenterTotal } from "./lib/center.mjs"

const UA = "MaintenanceHackBot/1.0 (+https://maintenance-hack.wwe9459.workers.dev; recall list, twice a day)"
const RECENT_DAYS = parseInt(process.env.CENTER_RECENT_DAYS ?? "", 10) || 45
const MAX_DETAILS = parseInt(process.env.CENTER_MAX_DETAILS ?? "", 10) || 400
const MAX_PAGES = 200
/** 목록이 시작일 순으로 완전히 정렬돼 있지는 않아서, 기준일보다 오래된 쪽이 이만큼 연속으로 나오면 멈춤 */
const STOP_AFTER_OLD_PAGES = 3

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const cookies = new Map()

/** 429·503이면 잠시 쉬었다가 다시 시도 (Retry-After 우선) */
async function post(path, params, tries = 4) {
  for (let t = 1; ; t++) {
    try {
      return await request(path, params)
    } catch (err) {
      const wait = err.retryAfter ?? 15 * t
      if (!err.retryable || t >= tries) throw err
      console.warn(`  … ${err.message} → ${wait}초 뒤 다시 시도 (${t}/${tries - 1})`)
      await sleep(wait * 1000)
    }
  }
}

/** 브라우저처럼 게시판 화면을 먼저 열어 세션 쿠키를 받는다 */
async function openSession() {
  await request(CENTER_LIST_PATH, null)
  console.log(`세션 열기: 쿠키 ${cookies.size}개`)
}

async function request(path, params) {
  let url = `${CENTER_BASE}${path}`
  let body = params ? new URLSearchParams(params).toString() : undefined
  let method = params ? "POST" : "GET"
  for (let hop = 0; hop < 6; hop++) {
    let res
    try {
      res = await fetch(url, {
        method,
        redirect: "manual",
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9",
          Referer: `${CENTER_BASE}${CENTER_LIST_PATH}`,
          ...(method === "POST"
            ? { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Origin: CENTER_BASE }
            : {}),
          ...(cookies.size ? { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
        },
        body: method === "POST" ? body : undefined,
        signal: AbortSignal.timeout(30_000),
      })
    } catch (err) {
      const cause = err?.cause ? ` (${err.cause.code ?? ""} ${err.cause.message ?? err.cause})` : ""
      throw new Error(`접속 실패: ${url} — ${err?.message ?? err}${cause}`)
    }
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";")
      const i = pair.indexOf("=")
      if (i > 0) cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location"), url).href
      method = "GET"
      continue
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      const err = new Error(
        `HTTP ${res.status} ${url} [server=${res.headers.get("server") ?? "-"} retry-after=${res.headers.get("retry-after") ?? "-"}] ${text.replace(/\s+/g, " ").slice(0, 160)}`
      )
      err.retryable = res.status === 429 || res.status >= 500
      const ra = Number(res.headers.get("retry-after"))
      if (Number.isFinite(ra) && ra > 0) err.retryAfter = Math.min(ra, 120)
      throw err
    }
    return res.text()
  }
  throw new Error(`리다이렉트가 너무 많음: ${path}`)
}

function toRecall(row, d, firstSeen) {
  const info = makerInfo(d.maker)
  const startDate = d.startDate || row.date
  return {
    id: `${startDate}-carkr-${row.recallId}`,
    recallId: row.recallId,
    maker: d.maker,
    ...info,
    startDate,
    title: row.title,
    serious: row.serious,
    reason: d.reason,
    fix: d.fix,
    part: d.part,
    count: d.count,
    items: d.items,
    firstSeen,
  }
}

async function main() {
  const today = todayKst()
  const prev = await readJson(CENTER_FILE, { updatedAt: null, items: [] })
  const annual = await readJson(RECALLS_FILE, { dataAsOf: null })
  const bootstrap = !existsSync(CENTER_FILE) || prev.items.length === 0
  // 연간 데이터에 이미 있는 리콜은 받지 않음 (그 다음 날부터)
  const annualAfter = annual.dataAsOf ? addDays(annual.dataAsOf, 1) : addDays(today, -365)
  const since = bootstrap ? annualAfter : [annualAfter, addDays(today, -RECENT_DAYS)].sort().at(-1)

  // 1) 목록
  const known = new Set(prev.items.map((r) => r.recallId))
  const rows = []
  let oldStreak = 0
  let total = null
  await openSession()
  await sleep(1500)
  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await post(CENTER_LIST_PATH, { currentPageNo: String(page), ctype: "" })
    if (page === 1) total = parseCenterTotal(html)
    const list = parseCenterList(html)
    if (!list.length) {
      if (page === 1) throw new Error("리콜센터 목록을 하나도 읽지 못했습니다. 게시판 구조가 바뀌었는지 확인하세요.")
      break
    }
    const fresh = list.filter((r) => r.date && r.date >= since)
    rows.push(...fresh)
    oldStreak = fresh.length ? 0 : oldStreak + 1
    if (oldStreak >= STOP_AFTER_OLD_PAGES) break
    await sleep(1200)
  }
  const unique = [...new Map(rows.map((r) => [r.recallId, r])).values()]
  console.log(`리콜센터 목록: 전체 ${total ?? "?"}건 중 ${since} 이후 시작 ${unique.length}건 (새 글 ${unique.filter((r) => !known.has(r.recallId)).length}건)`)

  // 2) 새 글 상세
  const todo = unique.filter((r) => !known.has(r.recallId)).slice(0, MAX_DETAILS)
  const added = []
  let failed = 0
  for (const row of todo) {
    try {
      const d = parseCenterDetail(await post(CENTER_DETAIL_PATH, { recallId: row.recallId, ctype: row.ctype }))
      if (!d) throw new Error("상세 표를 읽지 못함")
      // 처음 실행이면 시작일을 처음 본 날로(과거 리콜이 '새 리콜'로 쏟아지지 않게), 이후엔 오늘
      const firstSeen = bootstrap ? [d.startDate || row.date, today].sort()[0] : today
      added.push(toRecall(row, d, firstSeen))
      console.log(`  + ${d.startDate} ${row.title}`)
    } catch (err) {
      failed++
      console.warn(`  ! ${row.recallId} ${row.title}: ${String(err?.message ?? err).slice(0, 200)}`)
    }
    await sleep(1200)
  }

  const items = [...prev.items, ...added].sort(
    (a, b) => b.startDate.localeCompare(a.startDate) || Number(b.recallId) - Number(a.recallId)
  )
  const next = { updatedAt: today, source: `${CENTER_BASE}${CENTER_LIST_PATH}`, items }
  if (stable(items) !== stable(prev.items)) {
    await writeFile(CENTER_FILE, JSON.stringify(next, null, 1) + "\n")
    console.log(`recall_center.json 갱신: ${items.length}건 (이번에 추가 ${added.length}건)`)
  } else {
    console.log("recall_center.json 변경 없음")
  }

  await writeRecallsNew(today)
  if (failed && !added.length) throw new Error(`상세 조회 ${failed}건 모두 실패`)
}

main().catch((err) => {
  console.error(String(err?.message ?? err))
  process.exit(1)
})

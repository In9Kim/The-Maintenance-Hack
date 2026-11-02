#!/usr/bin/env node
/**
 * 리콜 데이터 갱신 스크립트 (GitHub Actions에서 하루 1번 실행)
 *
 * 원본: 공공데이터포털 "한국교통안전공단_자동차결함 리콜현황" (파일데이터 → 오픈API 자동변환)
 *   https://www.data.go.kr/data/3048950/fileData.do
 *   응답 항목: 제작자, 차명, 생산기간(부터), 생산기간(까지), 리콜개시일, 리콜사유
 *
 * 만드는 파일
 *   data/recalls.json      최근 N개 연도 데이터셋을 합쳐 리콜 단위로 묶은 것 (사이트가 빌드 때 읽음)
 *   data/recalls_new.json  최근 7일 안에 새로 들어온 리콜 (블로그 글감·알림용, 이번엔 파일만)
 *
 * 사용법
 *   RECALL_API_KEY=... node scripts/fetch-recalls.mjs
 *   node scripts/fetch-recalls.mjs --csv 2025.csv --csv 2024.csv   # 키 없이 내려받은 CSV로 (로컬 확인용)
 *
 * 환경변수
 *   RECALL_API_KEY  공공데이터포털 일반 인증키 (Encoding/Decoding 어느 쪽이든 됨). 절대 커밋하지 말 것
 *   RECALL_YEARS    담을 연도 데이터셋 개수 (기본 3)
 *
 * 리콜 내용이 바뀌지 않으면 파일을 건드리지 않습니다 → 커밋·재배포가 생기지 않음.
 */
import { readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const RECALLS_FILE = path.join(ROOT, "data/recalls.json")
const NEW_FILE = path.join(ROOT, "data/recalls_new.json")

const NAMESPACE = "3048950/v1"
const DOCS_URL = `https://infuser.odcloud.kr/oas/docs?namespace=${NAMESPACE}`
const API_BASE = "https://api.odcloud.kr/api"
const YEARS = Math.max(1, parseInt(process.env.RECALL_YEARS ?? "3", 10) || 3)
const NEW_WINDOW_DAYS = 7

// ── 날짜 ─────────────────────────────────────────────────────────────────────

/** 한국 시간 기준 오늘 (YYYY-MM-DD) */
function todayKst() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

function addDays(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** "2025-01-02" / "20250102" / "2025.1.2" → "2025-01-02" (알 수 없으면 원문) */
function normDate(v) {
  const s = String(v ?? "").trim()
  let m = s.match(/^(\d{4})[-./]?(\d{1,2})[-./]?(\d{1,2})$/)
  if (m && s.length >= 8) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : s
}

// ── 제작사 이름·주소 ─────────────────────────────────────────────────────────

/** 자주 나오는 제작사는 읽기 쉬운 영문 주소를 준다 (원문 제작자명 앞부분 기준) */
const MAKER_SLUGS = [
  [/^현대자동차/, "hyundai", "현대자동차"],
  [/^기아/, "kia", "기아"],
  [/^제네시스/, "genesis", "제네시스"],
  [/^테슬라/, "tesla", "테슬라"],
  [/^비엠더블유|^BMW/i, "bmw", "BMW"],
  [/^메르세데스|^벤츠/, "mercedes-benz", "메르세데스-벤츠"],
  [/^한국지엠|^한국GM|^지엠/i, "gm-korea", "한국GM"],
  [/^르노/, "renault-korea", "르노코리아"],
  [/^케이지모빌리티|^KG/i, "kg-mobility", "KG모빌리티"],
  [/^쌍용/, "ssangyong", "쌍용자동차"],
  [/^폭스바겐/, "volkswagen", "폭스바겐"],
  [/^아우디/, "audi", "아우디"],
  [/^볼보/, "volvo", "볼보"],
  [/^포르쉐/, "porsche", "포르쉐"],
  [/^한국토요타|^토요타/, "toyota", "토요타·렉서스"],
  [/^혼다/, "honda", "혼다"],
  [/^한국닛산|^닛산/, "nissan", "닛산"],
  [/^스텔란티스|^FCA/i, "stellantis", "스텔란티스(지프·푸조 등)"],
  [/^재규어|^JLR/i, "jaguar-land-rover", "재규어·랜드로버"],
  [/^포드/, "ford", "포드"],
  [/^링컨/, "lincoln", "링컨"],
  [/^미니/, "mini", "MINI"],
  [/^스카니아/, "scania", "스카니아"],
  [/^만트럭/, "man-truck", "만트럭버스"],
  [/^다임러트럭/, "daimler-truck", "다임러트럭"],
  [/^볼보트럭|^볼보그룹/, "volvo-trucks", "볼보트럭"],
  [/^할리데이비슨/, "harley-davidson", "할리데이비슨"],
  [/^비와이디|^BYD/i, "byd", "BYD"],
  [/^폴스타/, "polestar", "폴스타"],
  [/^캐딜락/, "cadillac", "캐딜락"],
]

function cleanMakerName(maker) {
  return maker
    .replace(/\(주\)|㈜|주식회사|유한회사|유한책임회사|\(유\)/g, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function hash(s) {
  // FNV-1a 32bit → 6자리 16진수 (ID가 매번 같게 나오도록)
  let h = 0x811c9dc5
  for (const ch of s) {
    h ^= ch.codePointAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0").slice(0, 6)
}

function makerInfo(maker) {
  for (const [re, slug, name] of MAKER_SLUGS) {
    // 볼보트럭이 볼보로 잡히지 않도록 더 구체적인 패턴을 먼저 확인
    if (slug === "volvo" && /^볼보(트럭|그룹)/.test(maker)) continue
    if (re.test(maker)) return { makerSlug: slug, makerName: name }
  }
  const name = cleanMakerName(maker) || maker
  return { makerSlug: `maker-${hash(maker)}`, makerName: name }
}

// ── 원본 가져오기 ────────────────────────────────────────────────────────────

/** swagger 문서에서 연도별 데이터셋 목록을 찾아 최신순으로 */
async function listDatasets() {
  const res = await fetch(DOCS_URL)
  if (!res.ok) throw new Error(`API 명세 조회 실패: HTTP ${res.status}`)
  const doc = await res.json()
  const sets = Object.entries(doc.paths ?? {}).map(([p, v]) => {
    const summary = v?.get?.summary ?? ""
    let asOf = null
    let m = summary.match(/_(\d{8})\s*$/)
    if (m) asOf = normDate(m[1])
    else if ((m = summary.match(/(20\d{2})/))) asOf = `${m[1]}-12-31`
    return { path: p, summary, asOf }
  })
  return sets.filter((s) => s.asOf).sort((a, b) => b.asOf.localeCompare(a.asOf))
}

async function fetchDataset(ds, key) {
  // Decoding 키(+, /, = 포함)도 Encoding 키(%2B 등)도 받을 수 있게 처리
  const serviceKey = key.includes("%") ? key : encodeURIComponent(key)
  const rows = []
  for (let page = 1; page < 100; page++) {
    const url = `${API_BASE}${ds.path}?page=${page}&perPage=1000&returnType=JSON&serviceKey=${serviceKey}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${ds.summary} 조회 실패: HTTP ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300))
    const body = await res.json()
    const data = body.data ?? []
    rows.push(...data)
    if (data.length === 0 || rows.length >= (body.totalCount ?? body.matchCount ?? 0)) break
  }
  return rows
}

/** 따옴표·줄바꿈이 들어간 CSV도 읽는 작은 파서 */
function parseCsv(text) {
  const rows = []
  let row = [], field = "", quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ",") { row.push(field); field = "" }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = "" }
    else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const [head, ...body] = rows
  return body.filter((r) => r.length >= head.length).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i]])))
}

async function readCsv(file) {
  const buf = await readFile(file)
  let text
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf)
  } catch {
    text = new TextDecoder("euc-kr").decode(buf)
  }
  return parseCsv(text.replace(/^﻿/, ""))
}

// ── 묶기 ─────────────────────────────────────────────────────────────────────

function groupRecalls(rawRows) {
  const seen = new Set()
  const groups = new Map()
  for (const r of rawRows) {
    const maker = String(r["제작자"] ?? "").trim()
    const name = String(r["차명"] ?? "").trim()
    const from = normDate(r["생산기간(부터)"])
    const to = normDate(r["생산기간(까지)"])
    const startDate = normDate(r["리콜개시일"])
    const reason = String(r["리콜사유"] ?? "").replace(/\s+/g, " ").trim()
    if (!maker || !name || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) continue

    // 연도 데이터셋끼리 겹치는 줄 제거
    const rowKey = [maker, name, from, to, startDate, reason].join("|")
    if (seen.has(rowKey)) continue
    seen.add(rowKey)

    const key = [maker, startDate, reason].join("|")
    if (!groups.has(key)) {
      groups.set(key, {
        id: `${startDate}-${hash(key)}`,
        maker,
        ...makerInfo(maker),
        startDate,
        reason,
        fix: null,
        items: [],
        firstSeen: "",
      })
    }
    groups.get(key).items.push({ name, from, to })
  }
  const list = [...groups.values()]
  for (const g of list) g.items.sort((a, b) => a.name.localeCompare(b.name, "ko") || a.from.localeCompare(b.from))
  return list.sort((a, b) => b.startDate.localeCompare(a.startDate) || a.makerName.localeCompare(b.makerName, "ko") || a.id.localeCompare(b.id))
}

// ── 실행 ─────────────────────────────────────────────────────────────────────

async function readJson(file, fallback) {
  if (!existsSync(file)) return fallback
  try {
    return JSON.parse(await readFile(file, "utf8"))
  } catch {
    return fallback
  }
}

const stable = (o) => JSON.stringify(o)

async function main() {
  const csvFiles = process.argv.flatMap((a, i, arr) => (a === "--csv" && arr[i + 1] ? [arr[i + 1]] : []))
  const today = todayKst()

  let rows = []
  let datasets = []
  if (csvFiles.length) {
    for (const f of csvFiles) rows.push(...(await readCsv(f)))
    datasets = csvFiles.map((f) => {
      const m = path.basename(f).match(/(\d{8})|(20\d{2})/)
      return m ? (m[1] ? normDate(m[1]) : `${m[2]}-12-31`) : today
    })
  } else {
    const key = process.env.RECALL_API_KEY
    if (!key) throw new Error("RECALL_API_KEY 환경변수가 없습니다. (GitHub 저장소 Settings → Secrets → Actions)")
    const all = await listDatasets()
    const picked = all.slice(0, YEARS)
    if (!picked.length) throw new Error("데이터셋 목록이 비어 있습니다.")
    for (const ds of picked) {
      const part = await fetchDataset(ds, key)
      console.log(`- ${ds.summary}: ${part.length}줄`)
      rows.push(...part)
    }
    datasets = picked.map((d) => d.asOf)
  }

  const recalls = groupRecalls(rows)
  const prev = await readJson(RECALLS_FILE, { dataAsOf: null, updatedAt: null, datasets: [], recalls: [] })

  // 원본 오류로 데이터가 크게 줄면 덮어쓰지 않는다
  if (recalls.length === 0) throw new Error("받아온 리콜이 0건입니다. 기존 파일을 유지합니다.")
  if (prev.recalls.length > 50 && recalls.length < prev.recalls.length * 0.5) {
    throw new Error(`리콜 수가 ${prev.recalls.length} → ${recalls.length}건으로 급감했습니다. 기존 파일을 유지합니다.`)
  }

  // 처음 들어온 날 기록. 첫 실행(기존 데이터 없음)이면 전부 "새 리콜"로 잡히지 않게 리콜개시일로 둔다
  const prevFirstSeen = new Map(prev.recalls.map((r) => [r.id, r.firstSeen]))
  const bootstrap = prev.recalls.length === 0
  for (const r of recalls) r.firstSeen = prevFirstSeen.get(r.id) ?? (bootstrap ? r.startDate : today)

  const sortedSets = [...new Set(datasets)].sort().reverse()
  const next = { dataAsOf: sortedSets[0] ?? null, updatedAt: today, datasets: sortedSets, recalls }
  const changed = stable({ ...next, updatedAt: null }) !== stable({ ...prev, updatedAt: null })
  if (changed) {
    await writeFile(RECALLS_FILE, JSON.stringify(next, null, 1) + "\n")
    console.log(`recalls.json 갱신: ${recalls.length}건 (기준일 ${next.dataAsOf})`)
  } else {
    console.log(`recalls.json 변경 없음: ${recalls.length}건`)
  }

  // 최근 7일 새 리콜
  const since = addDays(today, -(NEW_WINDOW_DAYS - 1))
  const fresh = recalls.filter((r) => r.firstSeen >= since)
  const prevNew = await readJson(NEW_FILE, { generatedAt: null, windowDays: NEW_WINDOW_DAYS, since: null, recalls: [] })
  const nextNew = { generatedAt: today, windowDays: NEW_WINDOW_DAYS, since, dataAsOf: next.dataAsOf, recalls: fresh }
  const newChanged =
    stable(prevNew.recalls.map((r) => r.id)) !== stable(fresh.map((r) => r.id)) || !existsSync(NEW_FILE)
  if (newChanged) {
    await writeFile(NEW_FILE, JSON.stringify(nextNew, null, 1) + "\n")
    console.log(`recalls_new.json 갱신: 최근 ${NEW_WINDOW_DAYS}일 새 리콜 ${fresh.length}건`)
  } else {
    console.log(`recalls_new.json 변경 없음: ${fresh.length}건`)
  }
}

main().catch((err) => {
  console.error(String(err?.message ?? err))
  process.exit(1)
})

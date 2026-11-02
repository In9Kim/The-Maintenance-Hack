/**
 * 리콜 수집 스크립트 공통 도구
 *  - fetch-recalls.mjs       : 공공데이터포털 연간 데이터 → data/recalls.json
 *  - fetch-recall-news.mjs   : 국토교통부 리콜 보도자료 → data/recall_news.json
 * 둘 다 끝에 writeRecallsNew()를 불러 data/recalls_new.json(최근 7일 새 리콜)을 함께 만든다.
 */
import { readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
export const RECALLS_FILE = path.join(ROOT, "data/recalls.json")
export const NEWS_FILE = path.join(ROOT, "data/recall_news.json")
export const NEW_FILE = path.join(ROOT, "data/recalls_new.json")
export const NEW_WINDOW_DAYS = 7

// ── 날짜 ─────────────────────────────────────────────────────────────────────

/** 한국 시간 기준 오늘 (YYYY-MM-DD) */
export function todayKst() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

export function addDays(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
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

export function cleanMakerName(maker) {
  return maker
    .replace(/\(주\)|㈜|주식회사|유한회사|유한책임회사|\(유\)/g, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function hash(s) {
  // FNV-1a 32bit → 6자리 16진수 (ID가 매번 같게 나오도록)
  let h = 0x811c9dc5
  for (const ch of s) {
    h ^= ch.codePointAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0").slice(0, 6)
}

export function makerInfo(maker) {
  for (const [re, slug, name] of MAKER_SLUGS) {
    // 볼보트럭이 볼보로 잡히지 않도록 더 구체적인 패턴을 먼저 확인
    if (slug === "volvo" && /^볼보(트럭|그룹)/.test(maker)) continue
    if (re.test(maker)) return { makerSlug: slug, makerName: name }
  }
  const name = cleanMakerName(maker) || maker
  return { makerSlug: `maker-${hash(maker)}`, makerName: name }
}


export async function readJson(file, fallback) {
  if (!existsSync(file)) return fallback
  try {
    return JSON.parse(await readFile(file, "utf8"))
  } catch {
    return fallback
  }
}

export const stable = (o) => JSON.stringify(o)


// ── 최근 7일 새 리콜 ─────────────────────────────────────────────────────────

/** 보도자료 한 건의 리콜 묶음(group) → recalls.json과 같은 Recall 형식 */
export function newsGroupToRecall(item, group, index) {
  const maker = group.maker || "제작사 미상"
  const startDate = group.startDate || item.date
  return {
    id: group.id ?? `${startDate}-molit-${hash(`${item.id}|${index}|${group.defect}`)}`,
    maker,
    ...makerInfo(maker),
    startDate,
    reason: group.defect,
    fix: null,
    items: (group.cars ?? []).map((c) => ({ name: c.name, from: c.from, to: c.to })),
    firstSeen: item.firstSeen,
    // 아래는 보도자료 출처 정보 (연간 데이터에는 없음)
    source: "molit",
    sourceTitle: item.title,
    sourceUrl: item.url,
    part: group.part ?? null,
    count: group.total ?? null,
    verified: !!group.verified,
  }
}

/**
 * data/recalls_new.json 작성: 최근 7일 안에 처음 들어온 리콜
 *  - 연간 데이터(recalls.json)의 새 리콜
 *  - 국토부 보도자료(recall_news.json)의 새 리콜
 * id 목록이 바뀌었을 때만 파일을 다시 쓴다 (불필요한 커밋 방지)
 */
export async function writeRecallsNew(today) {
  const since = addDays(today, -(NEW_WINDOW_DAYS - 1))
  const annual = await readJson(RECALLS_FILE, { dataAsOf: null, recalls: [] })
  const news = await readJson(NEWS_FILE, { items: [] })

  const fromAnnual = annual.recalls.filter((r) => r.firstSeen >= since)
  const fromNews = news.items
    .filter((it) => it.firstSeen >= since)
    .flatMap((it) => (it.groups ?? []).map((g, i) => newsGroupToRecall(it, g, i)))
  const fresh = [...fromNews, ...fromAnnual].sort((a, b) => b.startDate.localeCompare(a.startDate))

  const prev = await readJson(NEW_FILE, { recalls: [] })
  const changed = !existsSync(NEW_FILE) || stable(prev.recalls.map((r) => r.id)) !== stable(fresh.map((r) => r.id))
  if (!changed) {
    console.log(`recalls_new.json 변경 없음: ${fresh.length}건`)
    return
  }
  const next = { generatedAt: today, windowDays: NEW_WINDOW_DAYS, since, dataAsOf: annual.dataAsOf, recalls: fresh }
  await writeFile(NEW_FILE, JSON.stringify(next, null, 1) + "\n")
  console.log(`recalls_new.json 갱신: 최근 ${NEW_WINDOW_DAYS}일 새 리콜 ${fresh.length}건 (보도자료 ${fromNews.length} · 연간 ${fromAnnual.length})`)
}

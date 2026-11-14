import recallsJson from "@/data/recalls.json"
import newsJson from "@/data/recall_news.json"
import centerJson from "@/data/recall_center.json"
import { matchRecallsForCar } from "./match"
import { displayCarName, displayMaker } from "./display"
import { latestDate } from "@/lib/indexing"
import type { Recall, RecallCenterData, RecallData, RecallNewsData, RecallNewsItem } from "./types"

/**
 * 리콜 데이터는 GitHub Actions가 하루 1번 갱신합니다.
 *  - data/recalls.json      공공데이터포털 연간 리콜현황 (scripts/fetch-recalls.mjs)
 *  - data/recall_news.json  국토교통부 리콜 보도자료 (scripts/fetch-recall-news.mjs)
 *  - data/recall_center.json 자동차리콜센터 리콜현황 게시판 (scripts/fetch-recall-center.mjs) — 가장 빠른 최신 리콜
 * 사이트는 빌드 때 이 파일들만 읽으므로 방문자 요청마다 외부 API를 부르지 않습니다.
 */
const ANNUAL = recallsJson as unknown as RecallData
const NEWS = newsJson as unknown as RecallNewsData
const CENTER = centerJson as unknown as RecallCenterData

/** 리콜센터 게시판 → 공통 Recall 형식. 연간 데이터 기준일 이후 시작한 리콜만 */
function centerRecalls(): Recall[] {
  const after = ANNUAL.dataAsOf ?? ""
  return CENTER.items
    .filter((r) => r.startDate && r.startDate > after)
    .map((r) => ({
      id: r.id,
      maker: r.maker,
      makerName: r.makerName,
      makerSlug: r.makerSlug,
      startDate: r.startDate,
      reason: r.reason,
      fix: r.fix,
      items: r.items,
      firstSeen: r.firstSeen,
      source: "carkr" as const,
      sourceTitle: r.title,
      // 상세 페이지는 POST로만 열려서 게시판 목록으로 연결 (아래 RECALL_CENTER_LIST_URL과 같은 주소)
      sourceUrl: "https://www.car.go.kr/ri/stat/list.do",
      part: r.part,
      count: r.count,
      serious: r.serious,
    }))
}

/** 보도자료의 리콜 묶음 → 공통 Recall 형식. 연간 데이터 기준일 이후 시작한 리콜만 (중복 방지) */
function newsRecalls(): Recall[] {
  const after = ANNUAL.dataAsOf ?? ""
  const out: Recall[] = []
  for (const item of NEWS.items) {
    for (const g of item.groups ?? []) {
      const startDate = g.startDate || item.date || ""
      if (!startDate || startDate <= after) continue
      out.push({
        id: g.id,
        maker: g.maker,
        makerName: g.makerName,
        makerSlug: g.makerSlug,
        startDate,
        reason: g.defect,
        fix: null,
        items: g.cars.map((c) => ({ name: c.name, from: c.from, to: c.to })),
        firstSeen: item.firstSeen,
        source: "molit",
        sourceTitle: item.title,
        sourceUrl: item.url,
        part: g.part,
        count: g.total,
      })
    }
  }
  return out
}

/** 화면·매칭용 정규화 (원본 제작자명 maker, 원문 차명 rawName은 그대로 둔다) */
function normalize(r: Recall): Recall {
  return {
    ...r,
    ...displayMaker(r.maker),
    items: r.items.map((it) => {
      const name = displayCarName(it.name)
      return name === it.name ? it : { ...it, name, rawName: it.name }
    }),
  }
}

// 보도자료와 리콜센터에 같은 리콜이 있으면(같은 제작사·같은 시정 시작일) 표가 정확한 리콜센터 쪽만 남긴다
const CENTER_RECALLS = centerRecalls()
const centerKeys = new Set(CENTER_RECALLS.map((r) => `${r.makerSlug}|${r.startDate}`))
const NEWS_RECALLS = newsRecalls().filter((r) => !centerKeys.has(`${r.makerSlug}|${r.startDate}`))

const ALL: Recall[] = [...CENTER_RECALLS, ...NEWS_RECALLS, ...ANNUAL.recalls].map(normalize).sort(
  (a, b) => b.startDate.localeCompare(a.startDate) || a.makerName.localeCompare(b.makerName, "ko")
)
const DATA: RecallData = { ...ANNUAL, recalls: ALL }

/** 자동차리콜센터에서 가져온 리콜 중 이미 시작된 최근 리콜 (시작 예정 리콜은 제외) */
export function latestCenterRecalls(limit = 6): Recall[] {
  const today = todayKst()
  return ALL.filter((r) => r.source === "carkr" && r.startDate <= today).slice(0, limit)
}

/** 최근 국토부 리콜 보도자료 (표를 정리하지 못한 글도 제목·링크는 보여줌) */
export function recallNews(limit = 6): RecallNewsItem[] {
  return NEWS.items.slice(0, limit)
}

/** 오늘(빌드 시점, 한국시간) */
const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

/** 이미 시작된 리콜 중 가장 최근 시정 시작일 (리콜센터·보도자료 포함) */
export function latestNewsDate(): string | null {
  const today = todayKst()
  const dates = [
    ...CENTER.items.map((r) => r.startDate).filter((d) => d && d <= today),
    ...NEWS.items.map((it) => it.date ?? ""),
  ].filter(Boolean)
  return dates.sort().at(-1) ?? null
}

/** 모든 리콜 페이지 공통 기준일 문구: "공공데이터 기준 2025.12.31 · 자동차리콜센터 2026.11.02 확인" */
export function dataBasisText(): string {
  const annual = ANNUAL.dataAsOf ? `공공데이터 기준 ${fmtDate(ANNUAL.dataAsOf)}` : "공공데이터 준비 중"
  if (CENTER.updatedAt) return `${annual} · 자동차리콜센터 ${fmtDate(CENTER.updatedAt)} 확인`
  const news = NEWS.items[0]?.date
  return news ? `${annual} · 국토부 발표 ${fmtDate(news)}까지 반영` : annual
}

/** 자동차리콜센터 — 차대번호·차량번호로 내 차 리콜 대상 여부 조회 (메인 화면) */
export const RECALL_CENTER_LOOKUP_URL = "https://www.car.go.kr/home/main.do"
/** 자동차리콜센터 리콜현황 (공식 원문 목록) */
export const RECALL_CENTER_LIST_URL = "https://www.car.go.kr/ri/stat/list.do"
/** 공공데이터포털 원본 데이터셋 */
export const RECALL_DATASET_URL = "https://www.data.go.kr/data/3048950/fileData.do"

/** /recalls 첫 화면에 보여줄 최근 리콜 수 */
export const RECENT_LIMIT = 60

export function recallData(): RecallData {
  return DATA
}

export function allRecalls(): Recall[] {
  return DATA.recalls
}

export function recentRecalls(limit = RECENT_LIMIT): Recall[] {
  return DATA.recalls.slice(0, limit)
}

export interface RecallMaker {
  slug: string
  name: string
  count: number
}

/** 제작사 목록 (리콜 많은 순) */
export function recallMakers(): RecallMaker[] {
  const map = new Map<string, RecallMaker>()
  for (const r of DATA.recalls) {
    const m = map.get(r.makerSlug) ?? { slug: r.makerSlug, name: r.makerName, count: 0 }
    m.count++
    map.set(r.makerSlug, m)
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"))
}

export function recallsByMaker(slug: string): Recall[] {
  return DATA.recalls.filter((r) => r.makerSlug === slug)
}

export function recallsForCar(carId: string): Recall[] {
  return matchRecallsForCar(carId, DATA.recalls)
}

/**
 * 리콜 목록 페이지 내용이 마지막으로 바뀐 날 = 그 리콜들이 우리 데이터에 처음 들어온 날(firstSeen) 중 가장 최근.
 * (매일 바뀌는 "확인일" 문구는 빼고, 리콜이 새로 붙은 날만 본다 → 사이트맵 lastmod)
 */
export function recallsUpdatedDate(recalls: Recall[]): string | undefined {
  return latestDate(recalls.map((r) => r.firstSeen))
}

/** /recalls 첫 화면: 리콜 + 표를 정리하지 못해 제목만 보여 주는 보도자료까지 */
export function recallsIndexUpdatedDate(): string | undefined {
  return latestDate([...ALL.map((r) => r.firstSeen), ...NEWS.items.map((it) => it.firstSeen)])
}

/** "2025-01-24" → "2025.01.24" */
export function fmtDate(ymd: string | null | undefined): string {
  return ymd ? ymd.replace(/-/g, ".") : "-"
}

/** 리콜사유를 메타 설명용으로 짧게 */
export function shortReason(reason: string, max = 60): string {
  const s = reason.replace(/\s+/g, " ").trim()
  return s.length > max ? `${s.slice(0, max)}…` : s
}

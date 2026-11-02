import recallsJson from "@/data/recalls.json"
import { matchRecallsForCar } from "./match"
import type { Recall, RecallData } from "./types"

/**
 * 리콜 데이터는 GitHub Actions가 하루 1번 data/recalls.json으로 갱신합니다 (scripts/fetch-recalls.mjs).
 * 사이트는 빌드 때 이 파일만 읽으므로 방문자 요청마다 외부 API를 부르지 않습니다.
 */
const DATA = recallsJson as unknown as RecallData

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

/** "2025-01-24" → "2025.01.24" */
export function fmtDate(ymd: string | null | undefined): string {
  return ymd ? ymd.replace(/-/g, ".") : "-"
}

/** 리콜사유를 메타 설명용으로 짧게 */
export function shortReason(reason: string, max = 60): string {
  const s = reason.replace(/\s+/g, " ").trim()
  return s.length > max ? `${s.slice(0, max)}…` : s
}

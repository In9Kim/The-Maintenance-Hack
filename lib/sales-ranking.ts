/**
 * 월별 신차 판매 순위 (data/sales-ranking.json, 각 사·수입자동차협회 발표를 인용한 기사 기준).
 * 순위의 차가 정비핵 데이터에 있으면 그 차종 페이지로 연결한다.
 * 세대가 바뀐 차(판매는 신형인데 데이터는 구형)는 연결하지 않는다.
 */
import raw from "@/data/sales-ranking.json"

export interface SalesRow {
  rank: number
  maker: string
  model: string
  sales: number
  prevSales: number | null
  source: string
}

interface Raw {
  month: string
  prevMonth: string
  domestic: SalesRow[]
  import: SalesRow[]
  sources: { title: string; url: string }[]
}
const DATA = raw as unknown as Raw

/** 판매 차명 → 정비핵 차종 id (현재 팔리는 세대와 같은 것만) */
const CAR_ID: Record<string, string> = {
  "기아 스포티지": "kia-sportage-nq5",
  "현대 그랜저": "hyundai-grandeur-gn7",
  "기아 쏘렌토": "kia-sorento-mq4",
  "현대 아반떼": "hyundai-avante-cn7",
  "기아 카니발": "kia-carnival-ka4",
  "기아 레이": "kia-ray-tam",
  "현대 쏘나타": "hyundai-sonata-dn8",
  "현대 스타리아": "hyundai-staria-us4",
  "기아 봉고Ⅲ": "kia-bongo3-pu",
  "기아 봉고3": "kia-bongo3-pu",
  "현대 투싼": "hyundai-tucson-nx4",
  "현대 캐스퍼": "hyundai-casper-ax1",
  "기아 K5": "kia-k5-dl3",
  "기아 K8": "kia-k8-gl3",
  "기아 니로": "kia-niro-sg2",
  "현대 코나": "hyundai-kona-sx2",
  "현대 싼타페": "hyundai-santafe-mx5",
  "KG모빌리티 토레스": "kgm-torres-j100",
}

export function salesCarId(row: Pick<SalesRow, "maker" | "model">): string | undefined {
  return CAR_ID[`${row.maker} ${row.model}`]
}

export function salesRanking() {
  return DATA
}

/** "2026-10" → "2026년 10월" */
export const monthText = (ym: string) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월`

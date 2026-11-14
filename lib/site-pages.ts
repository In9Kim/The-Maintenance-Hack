import type { Recall } from "@/lib/recalls/types"
import { carShortName, partSlug, seoCars } from "@/lib/seo"
import { isIndexableMaker, latestDate } from "@/lib/indexing"
import {
  fmtDate,
  recallMakers,
  recallsByMaker,
  recallsForCar,
  recallsIndexUpdatedDate,
  recallsUpdatedDate,
  shortReason,
} from "@/lib/recalls/data"

/**
 * 검색엔진에 내보내는 페이지 목록 (사이트맵·RSS 공용).
 * lastModified는 빌드·요청 시각이 아니라 그 페이지 데이터가 실제로 바뀐 날 (YYYY-MM-DD).
 *  - 차종·소모품 페이지: data/vehicles.json 각 차종의 updatedAt
 *  - 리콜 페이지: 그 페이지에 나오는 리콜이 데이터에 처음 들어온 날(firstSeen) 중 가장 최근
 * 알 수 없으면 undefined (lastmod 생략, RSS에서도 제외).
 */
export interface SitePage {
  path: string
  lastModified?: string
  priority: number
  kind: "home" | "calculator" | "cars" | "car" | "recalls" | "maker" | "car-recalls" | "part"
  /** RSS 항목 제목·설명 (car·maker·car-recalls만) */
  title?: string
  description?: string
}

/** 가장 최근에 데이터에 들어온 리콜 (그 페이지가 바뀐 이유) */
function newestSeen(recalls: Recall[]): Recall | undefined {
  return recalls.reduce<Recall | undefined>((a, r) => (!a || r.firstSeen > a.firstSeen ? r : a), undefined)
}

function recallSummary(recalls: Recall[]): string {
  const r = newestSeen(recalls)
  return r ? `최근 리콜(${fmtDate(r.startDate)} 시작): ${shortReason(r.reason, 80)}` : ""
}

export function sitePages(): SitePage[] {
  const cars = seoCars()
  const carsUpdated = latestDate(cars.map((c) => c.updatedAt))

  return [
    { path: "/", priority: 1, kind: "home" },
    { path: "/calculator", lastModified: carsUpdated, priority: 0.8, kind: "calculator" },
    { path: "/cars", lastModified: carsUpdated, priority: 0.9, kind: "cars" },
    ...cars.map((car): SitePage => {
      const name = carShortName(car)
      return {
        path: `/cars/${car.id}`,
        lastModified: car.updatedAt,
        priority: 0.8,
        kind: "car",
        title: `${name} 소모품 교체 비용·규격 정리`,
        description: `${name}(${car.yearRange}) 소모품 ${car.parts.length}개의 규격과 교체 비용. 공식센터 견적과 쿠팡 부품+공임나라 셀프 정비 비용을 비교합니다.`,
      }
    }),
    { path: "/recalls", lastModified: recallsIndexUpdatedDate(), priority: 0.8, kind: "recalls" },
    // 리콜이 적거나 해시 주소(maker-xxxxxx)인 제작사는 제외 (페이지는 noindex)
    ...recallMakers()
      .filter(isIndexableMaker)
      .map((m): SitePage => {
        const recalls = recallsByMaker(m.slug)
        return {
          path: `/recalls/maker/${m.slug}`,
          lastModified: recallsUpdatedDate(recalls),
          priority: 0.6,
          kind: "maker",
          title: `${m.name} 리콜 정보 (${m.count}건)`,
          description: recallSummary(recalls),
        }
      }),
    // 매칭된 리콜이 있는 차종만 (빈 페이지는 제외)
    ...cars.flatMap((car): SitePage[] => {
      const recalls = recallsForCar(car.id)
      if (!recalls.length) return []
      return [
        {
          path: `/cars/${car.id}/recalls`,
          lastModified: recallsUpdatedDate(recalls),
          priority: 0.7,
          kind: "car-recalls",
          title: `${carShortName(car)} 리콜 ${recalls.length}건 정리`,
          description: recallSummary(recalls),
        },
      ]
    }),
    ...cars.flatMap((car) =>
      car.parts.map(
        (p): SitePage => ({ path: `/cars/${car.id}/${partSlug(car, p)}`, lastModified: car.updatedAt, priority: 0.7, kind: "part" })
      )
    ),
  ]
}

import type { MetadataRoute } from "next"
import { seoCars, partSlug, SITE_URL } from "@/lib/seo"
import { isIndexableMaker, latestDate } from "@/lib/indexing"
import {
  recallMakers,
  recallsByMaker,
  recallsForCar,
  recallsIndexUpdatedDate,
  recallsUpdatedDate,
} from "@/lib/recalls/data"

/**
 * lastModified는 빌드·요청 시각이 아니라 그 페이지 데이터가 실제로 바뀐 날 (YYYY-MM-DD).
 *  - 차종·소모품 페이지: data/vehicles.json 각 차종의 updatedAt
 *  - 리콜 페이지: 그 페이지에 나오는 리콜이 데이터에 처음 들어온 날(firstSeen) 중 가장 최근
 * 알 수 없으면 lastmod를 생략한다 (매번 바뀌는 값은 구글이 무시함).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const cars = seoCars()
  const carsUpdated = latestDate(cars.map((c) => c.updatedAt))
  const entry = (path: string, lastModified: string | undefined, priority: number) => ({
    url: `${SITE_URL}${path}`,
    ...(lastModified ? { lastModified } : {}),
    priority,
  })

  return [
    entry("/", undefined, 1),
    entry("/calculator", carsUpdated, 0.8),
    entry("/cars", carsUpdated, 0.9),
    ...cars.map((car) => entry(`/cars/${car.id}`, car.updatedAt, 0.8)),
    entry("/recalls", recallsIndexUpdatedDate(), 0.8),
    // 리콜이 적거나 해시 주소(maker-xxxxxx)인 제작사는 제외 (페이지는 noindex)
    ...recallMakers()
      .filter(isIndexableMaker)
      .map((m) => entry(`/recalls/maker/${m.slug}`, recallsUpdatedDate(recallsByMaker(m.slug)), 0.6)),
    // 매칭된 리콜이 있는 차종만 (빈 페이지는 사이트맵에서 제외)
    ...cars.flatMap((car) => {
      const recalls = recallsForCar(car.id)
      return recalls.length ? [entry(`/cars/${car.id}/recalls`, recallsUpdatedDate(recalls), 0.7)] : []
    }),
    ...cars.flatMap((car) => car.parts.map((p) => entry(`/cars/${car.id}/${partSlug(car, p)}`, car.updatedAt, 0.7))),
  ]
}

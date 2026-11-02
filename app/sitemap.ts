import type { MetadataRoute } from "next"
import { seoCars, partSlug, SITE_URL } from "@/lib/seo"
import { latestNewsDate, recallData, recallMakers, recallsForCar } from "@/lib/recalls/data"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const cars = seoCars()
  const { updatedAt } = recallData()
  const latest = [updatedAt, latestNewsDate()].filter(Boolean).sort().pop()
  const recallUpdated = latest ? new Date(`${latest}T00:00:00+09:00`) : now
  return [
    { url: `${SITE_URL}/`, lastModified: now, priority: 1 },
    { url: `${SITE_URL}/calculator`, lastModified: now, priority: 0.8 },
    { url: `${SITE_URL}/cars`, lastModified: now, priority: 0.9 },
    ...cars.map((car) => ({ url: `${SITE_URL}/cars/${car.id}`, lastModified: now, priority: 0.8 })),
    // 리콜 정보: 데이터가 바뀐 날을 lastModified로
    { url: `${SITE_URL}/recalls`, lastModified: recallUpdated, priority: 0.8 },
    ...recallMakers().map((m) => ({ url: `${SITE_URL}/recalls/maker/${m.slug}`, lastModified: recallUpdated, priority: 0.6 })),
    // 매칭된 리콜이 있는 차종만 (빈 페이지는 사이트맵에서 제외)
    ...cars
      .filter((car) => recallsForCar(car.id).length > 0)
      .map((car) => ({ url: `${SITE_URL}/cars/${car.id}/recalls`, lastModified: recallUpdated, priority: 0.7 })),
    ...cars.flatMap((car) =>
      car.parts.map((p) => ({ url: `${SITE_URL}/cars/${car.id}/${partSlug(car, p)}`, lastModified: now, priority: 0.7 }))
    ),
  ]
}

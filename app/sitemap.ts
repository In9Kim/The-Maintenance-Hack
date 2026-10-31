import type { MetadataRoute } from "next"
import { seoCars, partSlug, SITE_URL } from "@/lib/seo"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const cars = seoCars()
  return [
    { url: `${SITE_URL}/`, lastModified: now, priority: 1 },
    { url: `${SITE_URL}/calculator`, lastModified: now, priority: 0.8 },
    { url: `${SITE_URL}/cars`, lastModified: now, priority: 0.9 },
    ...cars.map((car) => ({ url: `${SITE_URL}/cars/${car.id}`, lastModified: now, priority: 0.8 })),
    ...cars.flatMap((car) =>
      car.parts.map((p) => ({ url: `${SITE_URL}/cars/${car.id}/${partSlug(car, p)}`, lastModified: now, priority: 0.7 }))
    ),
  ]
}

import type { Metadata } from "next"
import Link from "next/link"
import { seoCars, carShortName, SITE_URL } from "@/lib/seo"
import { Breadcrumbs } from "@/components/seo/Shared"

export const metadata: Metadata = {
  title: "차종별 소모품 교체 비용 · 규격 총정리 | 정비핵",
  description:
    "현대·기아·테슬라 인기 차종의 엔진오일, 필터, 브레이크 패드, 배터리 교체 비용과 규격을 차종별로 정리했습니다. 공식센터 견적과 셀프 구매+공임나라 비용을 비교해 보세요.",
  alternates: { canonical: `${SITE_URL}/cars` },
}

export default function CarsIndexPage() {
  const cars = seoCars()
  const brands = Array.from(new Set(cars.map((c) => c.brand)))

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs items={[{ href: "/", label: "정비핵" }, { label: "차종별 정비 비용" }]} />
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl">차종별 소모품 교체 비용</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        내 차를 골라 소모품 규격과 공식센터 대비 절약 금액을 확인하세요.
      </p>

      {brands.map((brand) => (
        <section key={brand} className="mb-8">
          <h2 className="mb-3 text-lg font-bold">{brand}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {cars
              .filter((c) => c.brand === brand)
              .map((car) => (
                <li key={car.id}>
                  <Link
                    href={`/cars/${car.id}`}
                    className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
                  >
                    <div className="font-semibold">{carShortName(car)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {car.yearRange} · 소모품 {car.parts.length}종
                    </div>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  seoCars,
  getSeoCar,
  carShortName,
  partSlug,
  partTitleName,
  partCost,
  intervalText,
  calculatorHref,
  SITE_URL,
} from "@/lib/seo"
import { formatPrice } from "@/lib/utils"
import { Breadcrumbs, JsonLd, PartnersDisclosure } from "@/components/seo/Shared"

export const dynamicParams = false

export function generateStaticParams() {
  return seoCars().map((car) => ({ carId: car.id }))
}

type Props = { params: Promise<{ carId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const car = getSeoCar((await params).carId)
  if (!car) return {}
  const name = carShortName(car)
  return {
    title: `${name} 소모품 교체 비용 · 규격 총정리 (엔진오일·필터·브레이크) | 정비핵`,
    description: `${name}(${car.yearRange}) 엔진오일, 에어컨 필터, 브레이크 패드 등 소모품 규격과 교체 비용. 공식센터 견적 대비 쿠팡 부품+공임나라 셀프 정비 시 절약 금액을 비교합니다.`,
    alternates: { canonical: `${SITE_URL}/cars/${car.id}` },
  }
}

export default async function CarPage({ params }: Props) {
  const car = getSeoCar((await params).carId)
  if (!car) notFound()

  const name = carShortName(car)
  const totals = car.parts.reduce(
    (acc, p) => {
      const c = partCost(p)
      return { self: acc.self + c.self, dealer: acc.dealer + c.dealer }
    },
    { self: 0, dealer: 0 }
  )

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "정비핵" },
          { href: "/cars", label: "차종별 정비 비용" },
          { label: name },
        ]}
      />

      <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{name} 소모품 교체 비용</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {car.generation} · {car.yearRange} · {car.engineTypes.join(" / ")}
      </p>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">공식센터 예상 (전체)</div>
          <div className="mt-1 text-lg font-bold">{formatPrice(totals.dealer)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">쿠팡 부품 + 공임나라</div>
          <div className="mt-1 text-lg font-bold text-primary">{formatPrice(totals.self)}</div>
        </div>
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-4">
          <div className="text-xs text-muted-foreground">절약 가능</div>
          <div className="mt-1 text-lg font-bold text-primary">{formatPrice(Math.max(totals.dealer - totals.self, 0))}</div>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-bold">항목별 규격과 비용</h2>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">항목</th>
              <th className="px-3 py-2 font-medium">규격</th>
              <th className="px-3 py-2 font-medium">교체 주기</th>
              <th className="px-3 py-2 text-right font-medium">공식센터</th>
              <th className="px-3 py-2 text-right font-medium">셀프 구매</th>
            </tr>
          </thead>
          <tbody>
            {car.parts.map((part) => {
              const c = partCost(part)
              return (
                <tr key={part.id} className="border-t border-border">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/cars/${car.id}/${partSlug(car, part)}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {part.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{part.spec}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{intervalText(part) ?? "-"}</td>
                  <td className="px-3 py-2.5 text-right">{formatPrice(c.dealer)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-primary">{formatPrice(c.self)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <Link
          href={calculatorHref(car)}
          className="inline-flex rounded-lg border border-primary/50 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
        >
          내 정비 항목만 골라 계산하기 →
        </Link>
      </div>

      <PartnersDisclosure />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${name} 소모품 교체 비용`,
          itemListElement: car.parts.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: `${name} ${partTitleName(p)} 교체 비용`,
            url: `${SITE_URL}/cars/${car.id}/${partSlug(car, p)}`,
          })),
        }}
      />
    </div>
  )
}

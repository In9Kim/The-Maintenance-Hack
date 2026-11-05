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
import { recallsForCar } from "@/lib/recalls/data"
import { engineGroups } from "@/lib/engines"
import { coupangLinksFor } from "@/lib/coupang-links"
import { OutboundLink } from "@/components/seo/OutboundLink"
import type { CarModel, MaintenancePart } from "@/types"

function totalsOf(parts: MaintenancePart[]) {
  return parts.reduce(
    (acc, p) => {
      const c = partCost(p)
      return { self: acc.self + c.self, dealer: acc.dealer + c.dealer }
    },
    { self: 0, dealer: 0 }
  )
}

/** 규격 옆 "이 규격 제품 보기" — 규격이 정확히 맞는 상품을 넣어 둔 소모품만 (data/coupang-links.json) */
function SpecLinks({ car, part }: { car: CarModel; part: MaintenancePart }) {
  const links = coupangLinksFor(part)
  if (!links.length) return null
  return (
    <div className="mt-1 space-y-0.5">
      {links.map((l) => (
        <OutboundLink
          key={l.url}
          href={l.url}
          target="coupang"
          carId={car.id}
          partId={part.id}
          sponsored
          className="block text-xs font-semibold text-primary hover:underline"
        >
          이 규격 제품 보기 ↗ <span className="font-normal text-muted-foreground">{l.product}</span>
        </OutboundLink>
      ))}
    </div>
  )
}

function PartsTable({ car, parts }: { car: CarModel; parts: MaintenancePart[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">항목</th>
            <th className="px-3 py-2 font-medium">규격</th>
            <th className="px-3 py-2 font-medium">교체 주기</th>
            <th className="px-3 py-2 text-right font-medium">공식센터</th>
            <th className="px-3 py-2 text-right font-medium">쿠팡 부품 + 공임나라</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((part) => {
            const c = partCost(part)
            return (
              <tr key={part.id} className="border-t border-border align-top">
                <td className="px-3 py-2.5">
                  <Link href={`/cars/${car.id}/${partSlug(car, part)}`} className="font-medium text-primary hover:underline">
                    {part.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {part.spec}
                  {part.partNumber && <div className="text-xs">순정 품번 {part.partNumber}</div>}
                  <SpecLinks car={car} part={part} />
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{intervalText(part) ?? "-"}</td>
                <td className="px-3 py-2.5 text-right">{formatPrice(c.dealer)}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-primary">{formatPrice(c.self)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

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
  const recallCount = recallsForCar(car.id).length
  const groups = engineGroups(car)
  const multi = groups.length > 1
  // 엔진이 나뉜 차종은 첫 엔진 기준 합계를 위에 보여주고, 엔진별 합계는 각 표 위에
  const totals = totalsOf(groups[0].parts)
  const sources = [...new Set(car.parts.map((p) => p.source).filter(Boolean))] as string[]

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
      <p className="mb-3 text-sm text-muted-foreground">
        {car.generation} · {car.yearRange} · {car.engineTypes.join(" / ")}
      </p>
      <Link
        href={`/cars/${car.id}/recalls`}
        className="mb-6 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
      >
        {recallCount > 0 ? `리콜 ${recallCount}건 →` : "리콜 정보 →"}
      </Link>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">공식센터 예상 (전체{multi ? ` · ${groups[0].engine}` : ""})</div>
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
      {multi ? (
        <div className="space-y-8">
          <p className="text-sm text-muted-foreground">엔진마다 엔진오일·필터 등 규격이 달라 엔진별로 나눴습니다. 내 차 엔진 표를 보세요.</p>
          {groups.map((g) => {
            const t = totalsOf(g.parts)
            return (
              <section key={g.engine} id={`engine-${partSlug(car, { id: `${car.id}-${g.engine}` } as MaintenancePart).replace(/[^\w가-힣-]/g, "")}`}>
                <h3 className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-base font-bold">
                  {g.engine}
                  <span className="text-xs font-normal text-muted-foreground">
                    공식센터 {formatPrice(t.dealer)} → 쿠팡 부품+공임나라 <b className="text-primary">{formatPrice(t.self)}</b>
                  </span>
                </h3>
                <PartsTable car={car} parts={g.parts} />
              </section>
            )
          })}
        </div>
      ) : (
        <PartsTable car={car} parts={car.parts} />
      )}
      {sources.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          규격·교체 주기 출처: {sources.join(" · ")}. 가격은 시세를 바탕으로 한 예상치이며, 구매 전 차대번호·순정 품번으로 확인하세요.
        </p>
      )}

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

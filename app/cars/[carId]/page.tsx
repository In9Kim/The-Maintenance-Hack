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
  pageMetadata,
} from "@/lib/seo"
import { formatPrice } from "@/lib/utils"
import { AffiliateNotice, Breadcrumbs, EstimateNote, JsonLd } from "@/components/seo/Shared"
import { ReceiptCard } from "@/components/home/ReceiptCard"
import { EngineTabs } from "@/components/cars/EngineTabs"
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

/** 규격 아래 "규격 맞는 상품" — 규격이 정확히 맞는 상품을 넣어 둔 소모품만 (data/coupang-links.json) */
function SpecLinks({ car, part }: { car: CarModel; part: MaintenancePart }) {
  const links = coupangLinksFor(part)
  if (!links.length) return null
  return (
    <div className="mt-1.5 space-y-1">
      {links.map((l) => (
        <OutboundLink
          key={l.url}
          href={l.url}
          target="coupang"
          carId={car.id}
          partId={part.id}
          sponsored
          className="inline-flex min-h-[32px] flex-wrap items-center gap-x-1.5 text-[13px] font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
        >
          규격 맞는 상품 보기 (쿠팡)
          <span className="font-normal text-muted-foreground no-underline">{l.product}</span>
        </OutboundLink>
      ))}
    </div>
  )
}

/**
 * 소모품 목록: 휴대폰은 행마다 카드(가격이 항상 보이게), PC는 표처럼 열을 맞춘 격자.
 * 같은 마크업 하나를 CSS 격자로만 바꿔서 링크가 두 번 나오지 않는다.
 */
const COLS = "sm:grid-cols-[1.25fr_2fr_1fr_0.9fr_1fr]"

function PartsList({ car, parts }: { car: CarModel; parts: MaintenancePart[] }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-card">
      <div className={`hidden gap-4 border-b border-border bg-muted px-4 py-2.5 text-[13px] font-semibold text-muted-foreground sm:grid ${COLS}`} aria-hidden>
        <span>항목</span>
        <span>규격</span>
        <span>교체 주기</span>
        <span className="text-right">공식센터</span>
        <span className="text-right">직접 구매+공임나라</span>
      </div>
      <ul className="divide-y divide-border">
        {parts.map((part) => {
          const c = partCost(part)
          const interval = intervalText(part)
          return (
            <li key={part.id} className={`grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-4 sm:items-start ${COLS}`}>
              <div className="col-span-2 flex items-start justify-between gap-3 sm:col-span-1 sm:block">
                <Link href={`/cars/${car.id}/${partSlug(car, part)}`} className="font-bold underline decoration-border underline-offset-4 hover:decoration-primary">
                  {part.name}
                </Link>
                {interval && (
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-medium text-muted-foreground sm:hidden">
                    {interval}
                  </span>
                )}
              </div>
              <div className="col-span-2 text-[14px] leading-relaxed text-muted-foreground sm:col-span-1">
                {part.spec}
                {part.partNumber && <div className="text-[13px]">순정 품번 {part.partNumber}</div>}
                <SpecLinks car={car} part={part} />
              </div>
              <div className="hidden text-[14px] text-muted-foreground sm:block">{interval ?? "-"}</div>
              <div className="num mt-2 text-[14px] sm:mt-0 sm:text-right">
                <span className="mr-1.5 text-muted-foreground sm:hidden">공식센터</span>
                <span className="text-[#B42318] line-through decoration-[#B42318]/60 sm:text-foreground sm:no-underline">{formatPrice(c.dealer)}</span>
              </div>
              <div className="num mt-2 text-right text-[15px] sm:mt-0">
                <span className="font-bold text-primary">{formatPrice(c.self)}</span>
              </div>
            </li>
          )
        })}
      </ul>
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
  return pageMetadata({
    title: `${name} 소모품 교체 비용 · 규격 총정리 (엔진오일·필터·브레이크) | 정비핵`,
    description: `${name}(${car.yearRange}) 엔진오일, 에어컨 필터, 브레이크 패드 등 소모품 규격과 교체 비용. 공식센터 견적 대비 쿠팡 부품+공임나라 셀프 정비 시 절약 금액을 비교합니다.`,
    path: `/cars/${car.id}`,
  })
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

  const hasLinks = car.parts.some((p) => coupangLinksFor(p).length > 0)
  const engineId = (e: string) => `engine-${e.replace(/[^\w가-힣]+/g, "-")}`

  return (
    <div className="mx-auto max-w-5xl px-5 pb-6 pt-6 sm:pt-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "정비핵" },
          { href: "/cars", label: "차종별 정비 비용" },
          { label: name },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-12">
        <div>
          <h1 className="text-[28px] font-extrabold leading-[1.3] sm:text-[36px]">{name} 소모품 교체 비용</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            {car.generation} · {car.yearRange}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {multi
              ? groups.map((g) => (
                  <a
                    key={g.engine}
                    href={`#${engineId(g.engine!)}`}
                    className="inline-flex min-h-[36px] items-center rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold hover:border-primary/50"
                  >
                    {g.engine}
                  </a>
                ))
              : car.engineTypes.map((e) => (
                  <span key={e} className="inline-flex min-h-[36px] items-center rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold">
                    {e}
                  </span>
                ))}
            <Link
              href={`/cars/${car.id}/recalls`}
              className="inline-flex min-h-[36px] items-center rounded-full bg-[#FFF6ED] px-3.5 text-[13px] font-semibold text-[#B54708] hover:brightness-95"
            >
              {recallCount > 0 ? `리콜 ${recallCount}건` : "리콜 정보"}
            </Link>
          </div>
        </div>
        <ReceiptCard
          title={`소모품 한 번씩 모두 교체${multi ? ` · ${groups[0].engine}` : ""}`}
          dealer={totals.dealer}
          self={totals.self}
        />
      </div>

      <section className="mt-12">
        <h2 className="text-[20px] font-bold sm:text-[24px]">항목별 규격과 비용</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
          {multi
            ? "엔진마다 엔진오일·점화플러그 규격이 달라 엔진별로 나눴어요. 내 차 엔진을 보세요."
            : "항목을 누르면 규격과 교체 비용을 자세히 볼 수 있어요."}
        </p>
        {hasLinks && <AffiliateNotice className="mt-4" />}
        {multi ? (
          <div className="mt-5">
            <EngineTabs engines={groups.map((g) => g.engine!)} ids={groups.map((g) => engineId(g.engine!))}>
              {groups.map((g) => {
                const t = totalsOf(g.parts)
                return (
                  <div key={g.engine} className="pt-4">
                    <p className="num mb-3 text-[14px] text-muted-foreground">
                      {g.engine} 전체{" "}
                      <span className="line-through decoration-[#B42318]/60">{formatPrice(t.dealer)}</span>
                      {" → "}
                      <b className="text-primary">{formatPrice(t.self)}</b>
                    </p>
                    <PartsList car={car} parts={g.parts} />
                  </div>
                )
              })}
            </EngineTabs>
          </div>
        ) : (
          <div className="mt-5">
            <PartsList car={car} parts={car.parts} />
          </div>
        )}
        {sources.length > 0 && (
          <details className="mt-4 text-[13px] text-muted-foreground">
            <summary className="min-h-[44px] cursor-pointer content-center font-semibold text-foreground">규격·교체 주기 출처</summary>
            <p className="leading-relaxed">{sources.join(" · ")}. 가격은 시세를 바탕으로 한 예상치예요.</p>
          </details>
        )}
      </section>

      <div className="mt-8 rounded-2xl border border-border bg-card p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p className="font-bold">이번에 바꿀 것만 골라 보세요</p>
          <p className="mt-1 text-[14px] text-muted-foreground">계산기에서 항목을 체크하면 합계가 바로 바뀌어요.</p>
        </div>
        <Link
          href={calculatorHref(car)}
          className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[10px] bg-primary px-5 text-[15px] font-bold text-primary-foreground transition hover:brightness-110 active:translate-y-px sm:mt-0 sm:w-auto"
        >
          내 정비 항목 계산하기
        </Link>
      </div>

      <EstimateNote />

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

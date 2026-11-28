"use client"

import Link from "next/link"
import { formatPrice } from "@/lib/utils"
import { GONGIM_RESERVATION_URL } from "@/lib/config"
import { coupangChoicesFor, oilAmount } from "@/lib/coupang-links"
import { partSlug, priceBasis } from "@/lib/seo"
import { LiveCoupang } from "@/components/cars/LiveCoupang"
import { ReceiptCard } from "@/components/home/ReceiptCard"
import { OutboundLink } from "@/components/seo/OutboundLink"
import { AffiliateNotice } from "@/components/seo/Shared"
import type { CostSummary, CarModel } from "@/types"

interface CostDashboardProps {
  car: CarModel | undefined
  summary: CostSummary | null
  /** 등록한 엔진 이름. 있으면 쿠팡 상품에서 다른 엔진용을 뺀다 */
  engine?: string
}

/** 사진·가격 상품을 불러올 부품 수 (summary.items 순서 = 체크 목록 순서 위에서부터: ?part=·갈 때 된 부품 먼저, 그다음 데이터 순서).
 *  /api/coupang-search 호출 수 = 이 값 이하, 결과가 화면에 보일 때만 부름 */
const PHOTO_PARTS = 3

/**
 * 계산 결과: 영수증 + 다음 할 일.
 * 쿠팡: 규격 확인 상품(있으면) + 규격·차종 검색 링크 (lib/coupang-links.ts coupangChoicesFor)
 */
export function CostDashboard({ car, summary, engine }: CostDashboardProps) {
  if (!car) {
    return <p className="text-[15px] text-muted-foreground">차종을 고르면 여기에 공식센터와 직접 구매 비용이 나와요.</p>
  }
  if (!summary) {
    return (
      <p className="text-[15px] text-muted-foreground">
        {car.model} 소모품 중 이번에 바꿀 것을 체크하면 합계가 바로 계산돼요.
      </p>
    )
  }

  const groups = summary.items
    .map(({ part }, i) => ({ part, links: coupangChoicesFor(part), i }))
    .filter((g) => g.i < PHOTO_PARTS || g.links.length > 0)

  const photoGroups = groups.filter((g) => g.i < PHOTO_PARTS)
  // 4번째 부품부터: 부품마다 첫 링크 하나만, 한 줄짜리 목록으로 (같은 카드가 길게 늘어서지 않게)
  const moreLinks = groups.filter((g) => g.i >= PHOTO_PARTS && g.links.length > 0)

  return (
    <div className="space-y-4">
      <ReceiptCard
        title={`${car.brand} ${car.model} · ${summary.items.length}개 항목`}
        dealer={summary.dealerTotal}
        self={summary.coupangTotal}
        dealerNote={`부품 ${formatPrice(summary.dealerPartsTotal)} + 공임 ${formatPrice(summary.dealerLaborTotal)}`}
        selfNote={`부품 ${formatPrice(summary.coupangPartsTotal)} + 공임 ${formatPrice(summary.coupangLaborTotal)}`}
        basis={priceBasis(car)}
        className="!bg-background"
      />

      <details className="rounded-[12px] border border-border bg-card px-4">
        <summary className="min-h-[48px] cursor-pointer content-center text-[14px] font-semibold">항목별 금액 보기</summary>
        <ul className="num space-y-2 pb-4 text-[14px]">
          {summary.items.map(({ part, coupangSubtotal, dealerSubtotal }) => (
            <li key={part.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-muted-foreground">{part.name}</span>
              <span className="shrink-0">
                <span className="price-was mr-2 text-[12px]">센터 추정 {formatPrice(dealerSubtotal)}</span>
                <b>{formatPrice(coupangSubtotal)}</b>
              </span>
            </li>
          ))}
        </ul>
      </details>

      {groups.length > 0 && (
        <div className="space-y-3">
          <AffiliateNotice />
          <p className="-mt-1.5 text-[12px] leading-snug text-muted-foreground">상품명의 연식이 내 차와 같은지 보세요.</p>
          {photoGroups.map(({ part, links }) => {
            const need = oilAmount(part)
            const linkCards = links.length > 0 && (
              <div className="space-y-2">
                {links.map((link) => (
                  <OutboundLink
                    key={link.url}
                    href={link.url}
                    target="coupang"
                    carId={car.id}
                    partId={part.id}
                    sponsored
                    className="block rounded-[10px] border border-border bg-card px-4 py-3 hover:border-primary/50"
                  >
                    <span className="block text-[14px] font-semibold">{link.title}</span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">{link.sub}</span>
                  </OutboundLink>
                ))}
              </div>
            )
            // 위 3개만 사진·가격 상품 (쿠팡 검색 API 시간당 한도 보호), 못 찾으면 글자 링크, 둘 다 없으면 아무것도 안 그림
            return (
              <LiveCoupang
                key={part.id}
                carId={car.id}
                part={partSlug(car, part)}
                partId={part.id}
                engine={engine}
                compact
                hideNotice
                lazy
                title={<p className="mb-1.5 text-[14px] font-semibold break-keep">{part.name}</p>}
                fallback={linkCards || null}
                // 오일 단품은 한 통 용량이 필요량보다 적을 수 있음 (부품 페이지와 같은 안내). 상품·링크가 보일 때만
                footer={need ? <p className="mt-1.5 text-[12px] font-semibold text-[#B54708]">필요량 {need}L · 용량이 모자라면 더 사세요</p> : null}
              />
            )
          })}
          {moreLinks.length > 0 && (
            <ul className="divide-y divide-border rounded-[10px] border border-border bg-card">
              {moreLinks.map(({ part, links }) => {
                const need = oilAmount(part)
                return (
                  <li key={part.id}>
                    <OutboundLink
                      href={links[0].url}
                      target="coupang"
                      carId={car.id}
                      partId={part.id}
                      sponsored
                      className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted"
                    >
                      <span className="min-w-0 break-keep text-[14px] font-semibold">
                        {part.name}
                        {need ? <span className="ml-1.5 whitespace-nowrap text-[12px] text-[#B54708]">필요량 {need}L</span> : null}
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-[13px] text-muted-foreground">쿠팡 가격 ›</span>
                    </OutboundLink>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <Link
        href="/near"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-foreground text-[15px] font-bold text-background transition hover:brightness-125 active:translate-y-px"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" /></svg>
        근처 공임나라 찾기
      </Link>
      <OutboundLink
        href={GONGIM_RESERVATION_URL}
        target="gongim"
        carId={car.id}
        className="flex h-12 w-full items-center justify-center rounded-[10px] bg-primary text-[15px] font-bold text-primary-foreground transition hover:brightness-110 active:translate-y-px"
      >
        공임나라 예약하기
      </OutboundLink>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        부품은 직접 사서 가져가고, 교체만 공임나라에 맡기는 기준이에요.
      </p>
    </div>
  )
}

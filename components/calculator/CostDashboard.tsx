"use client"

import Link from "next/link"
import { formatPrice } from "@/lib/utils"
import { GONGIM_RESERVATION_URL } from "@/lib/config"
import { coupangChoicesFor } from "@/lib/coupang-links"
import { priceBasis } from "@/lib/seo"
import { ReceiptCard } from "@/components/home/ReceiptCard"
import { OutboundLink } from "@/components/seo/OutboundLink"
import { AffiliateNotice } from "@/components/seo/Shared"
import type { CostSummary, CarModel } from "@/types"

interface CostDashboardProps {
  car: CarModel | undefined
  summary: CostSummary | null
}

/**
 * 계산 결과: 영수증 + 다음 할 일.
 * 쿠팡: 규격 확인 상품(있으면) + 규격·차종 검색 링크 (lib/coupang-links.ts coupangChoicesFor)
 */
export function CostDashboard({ car, summary }: CostDashboardProps) {
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

  const linked = summary.items.flatMap(({ part }) => coupangChoicesFor(part).map((l) => ({ part, link: l })))

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

      {linked.length > 0 && (
        <div className="space-y-2">
          <AffiliateNotice />
          {linked.map(({ part, link }) => (
            <OutboundLink
              key={link.url}
              href={link.url}
              target="coupang"
              carId={car.id}
              partId={part.id}
              sponsored
              className="block rounded-[10px] border border-border bg-card px-4 py-3 hover:border-primary/50"
            >
              <span className="block text-[14px] font-semibold">{part.name} · {link.title}</span>
              <span className="mt-0.5 block text-[13px] text-muted-foreground">{link.sub}</span>
            </OutboundLink>
          ))}
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
        부품은 위 규격으로 직접 사서 가져가고, 교체만 공임나라에 맡기는 기준이에요.
      </p>
    </div>
  )
}

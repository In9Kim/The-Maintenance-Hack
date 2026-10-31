"use client"

import { ShoppingCart, Wrench, TrendingDown, ExternalLink, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn, formatPrice, formatPriceCompact, getCoupangSearchUrl } from "@/lib/utils"
import { GONGIM_RESERVATION_URL } from "@/lib/config"
import type { CostSummary, CarModel } from "@/types"
import { track } from "@/lib/track"

interface CostDashboardProps {
  car: CarModel | undefined
  summary: CostSummary | null
}

function trackEvent(type: "part_click" | "gongim_click", carId: string, partId?: string) {
  track({ type: "outbound", target: type === "part_click" ? "coupang" : "gongim", carId, partId })
}

export function CostDashboard({ car, summary }: CostDashboardProps) {
  if (!car) {
    return <EmptyState message="차량을 선택하면 비용 분석이 시작됩니다." />
  }

  if (!summary) {
    return <EmptyState message="정비 항목을 선택해주세요." car={car} />
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          비용 분석
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {car.brand} {car.model} · {summary.items.length}개 항목
        </p>
      </div>

      {/* 선택 항목 목록 (항목별 절감액 배지 포함) */}
      <div className="space-y-1.5">
        {summary.items.map(({ part, coupangSubtotal, dealerSubtotal }) => {
          const itemSavings = dealerSubtotal - coupangSubtotal
          return (
            <div key={part.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-muted-foreground">{part.name}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="font-medium tabular-nums">{formatPrice(coupangSubtotal)}</span>
                {itemSavings > 0 && (
                  <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-400">
                    -{formatPriceCompact(itemSavings)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Separator />

      {/* ─── 가격 비교 섹션 (2컬럼, 취소선 없음) ─── */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          가격 비교
        </p>
        <div className="grid grid-cols-2 gap-2">
          {/* 왼쪽: 공임나라+쿠팡 (추천) */}
          <div className="space-y-1.5 rounded-lg border border-primary/25 bg-primary/8 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
              공임나라+쿠팡
            </p>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">부품비</span>
              <span className="tabular-nums">{formatPrice(summary.coupangPartsTotal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">공임</span>
              <span className="tabular-nums">{formatPrice(summary.coupangLaborTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-primary/20 pt-1.5">
              <span className="text-sm font-bold">합계</span>
              <span className="text-sm font-bold tabular-nums text-primary">
                {formatPrice(summary.coupangTotal)}
              </span>
            </div>
          </div>

          {/* 오른쪽: 공식 서비스 센터 (비교) */}
          <div className="space-y-1.5 rounded-lg bg-secondary/70 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                서비스 센터
              </p>
              {summary.savingsPercent > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                  -{summary.savingsPercent}%
                </span>
              )}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground/70">
              <span>부품비</span>
              <span className="tabular-nums">{formatPrice(summary.dealerPartsTotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground/70">
              <span>공임</span>
              <span className="tabular-nums">{formatPrice(summary.dealerLaborTotal)}</span>
            </div>
            <div className="flex flex-col gap-0.5 border-t border-border/50 pt-1.5">
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-muted-foreground">합계</span>
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                  {formatPrice(summary.dealerTotal)}
                </span>
              </div>
              {summary.savings > 0 && (
                <p className="text-right text-[10px] font-semibold tabular-nums text-emerald-400">
                  {formatPriceCompact(summary.savings)} 저렴
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 절감액 하이라이트 */}
      <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <TrendingDown className="h-3.5 w-3.5" />
              예상 절감액
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-primary">
              {formatPriceCompact(summary.savings)}
            </p>
          </div>
          <div className="rounded-full bg-primary/20 px-3 py-1.5 text-center">
            <p className="text-xl font-extrabold tabular-nums text-primary">
              {summary.savingsPercent}%
            </p>
            <p className="text-xs text-primary/80">절감</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-primary/70">
          서비스 센터 {formatPriceCompact(summary.dealerTotal)} 대비
        </p>
      </div>

      {/* CTA 버튼: 부품별 쿠팡 링크 */}
      <div className="space-y-2">
        {summary.items.map(({ part }) => (
          <a
            key={part.id}
            href={getCoupangSearchUrl(part.coupangKeyword)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("part_click", car.id, part.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border border-border bg-secondary px-3.5 py-2.5 text-sm transition-colors hover:border-primary/30 hover:bg-primary/5"
            )}
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{part.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium tabular-nums">{formatPrice(part.coupangPrice)}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </div>
          </a>
        ))}

        {/* 공임나라 예약 버튼 */}
        <a
          href={GONGIM_RESERVATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("gongim_click", car.id)}
          className="block w-full"
        >
          <Button className="w-full gap-2 font-semibold" size="lg">
            <Wrench className="h-4 w-4" />
            공임나라 예약하기
            <ChevronRight className="ml-auto h-4 w-4" />
          </Button>
        </a>
      </div>

      <p className="text-center text-xs text-muted-foreground/60">
        * 쿠팡 가격은 변동될 수 있습니다. 실제 구매 시 가격을 확인하세요.
      </p>
    </div>
  )
}

function EmptyState({ message, car }: { message: string; car?: CarModel }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
        <Wrench className="h-8 w-8 text-muted-foreground" />
      </div>
      {car && (
        <p className="mb-1 text-sm font-medium">
          {car.brand} {car.model}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

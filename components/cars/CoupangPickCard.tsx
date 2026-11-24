import { OutboundLink } from "@/components/seo/OutboundLink"
import type { CoupangChoice } from "@/lib/coupang-links"

/** "이거 사면 돼요" 쿠팡 상품 카드 (엔진오일 추천 상품). 가격은 고른 날 기준이라 날짜를 함께 적는다. */
export function CoupangPickCard({ pick, carId, partId, compact = false }: { pick: CoupangChoice; carId: string; partId: string; compact?: boolean }) {
  const date = pick.priceDate ? pick.priceDate.slice(5).replace("-", "/") : null
  return (
    <div className="rounded-[12px] border border-primary/30 bg-[#F6FEF9] p-3">
      <OutboundLink href={pick.url} target="coupang" carId={carId} partId={partId} sponsored className="flex items-center gap-3">
        {pick.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pick.image}
            alt=""
            width={compact ? 56 : 72}
            height={compact ? 56 : 72}
            loading="lazy"
            className={`${compact ? "h-14 w-14" : "h-[72px] w-[72px]"} shrink-0 rounded-lg bg-white object-contain ring-1 ring-border`}
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-bold text-primary">{pick.title}</span>
          <span className="mt-0.5 line-clamp-2 block text-[13px] font-semibold leading-snug text-foreground">{pick.sub}</span>
          {pick.price != null && (
            <span className="num mt-0.5 block text-[14px] font-bold">
              {pick.price.toLocaleString("ko-KR")}원
              {date && <span className="ml-1 text-[11px] font-normal text-muted-foreground">({date} 기준, 바뀔 수 있음)</span>}
            </span>
          )}
        </span>
        <span aria-hidden className="shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-[12px] font-bold text-primary-foreground">
          보기
        </span>
      </OutboundLink>
      {pick.note && !compact && <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{pick.note}</p>}
    </div>
  )
}

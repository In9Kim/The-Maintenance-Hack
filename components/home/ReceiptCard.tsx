import { OutboundLink } from "@/components/seo/OutboundLink"
import { AFFILIATE_TEXT } from "@/components/seo/Shared"

/** 견적서 해독 영수증: 공식센터 금액(추정) → 직접 구매+공임나라 → 아끼는 돈 + 절약률 배지 */
export function ReceiptCard({
  title,
  dealer,
  self,
  selfLabel = "부품 직접 구매 + 공임나라",
  basis,
  dealerNote,
  selfNote,
  buy,
  className = "",
}: {
  title: string
  dealer: number
  self: number
  selfLabel?: string
  /** 금액 기준 (예: "공임나라 표준 공임 · 부품가 2026년 11월 시세 기준") */
  basis?: string
  /** 행 아래 작은 내역 (예: "부품 92,000원 + 공임 28,000원") */
  dealerNote?: string
  selfNote?: string
  /** 첫 화면에서 바로 부품을 사러 갈 수 있게 직접 구매 행 아래에 쿠팡 버튼 */
  buy?: { href: string; carId: string; partId: string }
  className?: string
}) {
  const won = (n: number) => `${n.toLocaleString("ko-KR")}원`
  const save = Math.max(dealer - self, 0)
  // 공식센터 금액이 추정치라 할인율이 아니라 "추정 대비 절약"으로만 표시한다 (취소선·정가 표기 금지)
  const pct = dealer > 0 ? Math.round((save / dealer) * 100) : 0
  return (
    <div className={`receipt relative rounded-2xl border border-border bg-card px-5 pb-6 pt-5 ${className}`}>
      <p className="text-[13px] font-semibold text-muted-foreground">{title}</p>
      <dl className="num mt-3 space-y-2.5 text-[15px]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <dt>공식센터 <span className="text-[12px] font-normal text-muted-foreground">(추정)</span></dt>
          <dd className="price-was">{won(dealer)}</dd>
          {dealerNote && <dd className="w-full text-right text-[12px] text-muted-foreground">{dealerNote}</dd>}
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <dt>{selfLabel}</dt>
          <dd className="font-semibold">{won(self)}</dd>
          {selfNote && <dd className="w-full text-right text-[12px] text-muted-foreground">{selfNote}</dd>}
          {buy && (
            <dd className="w-full pt-1.5">
              <OutboundLink
                href={buy.href}
                target="coupang"
                carId={buy.carId}
                partId={buy.partId}
                sponsored
                className="flex h-11 w-full items-center justify-center rounded-[10px] bg-primary text-[15px] font-bold text-primary-foreground transition hover:brightness-110 active:translate-y-px"
              >
                쿠팡에서 부품 가격 보기
              </OutboundLink>
              <span className="mt-1.5 block text-[11px] leading-snug text-muted-foreground">{AFFILIATE_TEXT}</span>
            </dd>
          )}
        </div>
      </dl>
      <div className="num mt-4 flex items-baseline justify-between border-t-[1.5px] border-dashed border-input pt-4">
        <span className="font-bold">아끼는 돈</span>
        <span className="text-[22px] font-extrabold text-primary">{won(save)}</span>
      </div>
      {pct > 0 && (
        <p className="mt-2 text-right">
          <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[13px] font-bold text-primary">
            공식센터(추정)보다 약 {pct}% ↓
          </span>
        </p>
      )}
      {basis && <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{basis}</p>}
    </div>
  )
}

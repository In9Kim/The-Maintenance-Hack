/** 견적서 해독 영수증: 공식센터 금액(취소선) → 직접 구매+공임나라 → 아끼는 돈 */
export function ReceiptCard({
  title,
  dealer,
  self,
  selfLabel = "부품 직접 구매 + 공임나라",
  basis,
  dealerNote,
  selfNote,
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
  className?: string
}) {
  const won = (n: number) => `${n.toLocaleString("ko-KR")}원`
  const save = Math.max(dealer - self, 0)
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
        </div>
      </dl>
      <div className="num mt-4 flex items-baseline justify-between border-t-[1.5px] border-dashed border-input pt-4">
        <span className="font-bold">아끼는 돈</span>
        <span className="text-[22px] font-extrabold text-primary">{won(save)}</span>
      </div>
      {basis && <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{basis}</p>}
    </div>
  )
}

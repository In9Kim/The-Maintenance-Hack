/** 견적서 해독 영수증: 공식센터 금액(취소선) → 직접 구매+공임나라 → 아끼는 돈 */
export function ReceiptCard({
  title,
  dealer,
  self,
  selfLabel = "부품 직접 구매 + 공임나라",
  className = "",
}: {
  title: string
  dealer: number
  self: number
  selfLabel?: string
  className?: string
}) {
  const won = (n: number) => `${n.toLocaleString("ko-KR")}원`
  const save = Math.max(dealer - self, 0)
  return (
    <div className={`receipt relative rounded-2xl border border-border bg-card px-5 pb-6 pt-5 ${className}`}>
      <p className="text-[13px] font-semibold text-muted-foreground">{title}</p>
      <dl className="num mt-3 space-y-2.5 text-[15px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt>공식센터</dt>
          <dd className="text-[#B42318] line-through decoration-2">{won(dealer)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>{selfLabel}</dt>
          <dd className="font-semibold">{won(self)}</dd>
        </div>
      </dl>
      <div className="num mt-4 flex items-baseline justify-between border-t-[1.5px] border-dashed border-input pt-4">
        <span className="font-bold">아끼는 돈</span>
        <span className="text-[22px] font-extrabold text-primary">{won(save)}</span>
      </div>
    </div>
  )
}

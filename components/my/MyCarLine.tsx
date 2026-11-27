/** 등록한 내 차를 한 줄로 (견적서·부품 확인·정비소 리스트·리콜에서 다시 고르지 않게). '다른 차'를 누르면 고르는 칸으로 */
export function MyCarLine({ name, detail, onChange }: { name: string; detail?: string; onChange?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-bold">{name}</span>
        {detail && <span className="num block truncate text-[13px] text-muted-foreground">{detail}</span>}
      </span>
      {onChange && (
        <button type="button" onClick={onChange} className="min-h-[40px] shrink-0 rounded-lg border border-border px-3 text-[13px] font-semibold">
          다른 차
        </button>
      )}
    </div>
  )
}

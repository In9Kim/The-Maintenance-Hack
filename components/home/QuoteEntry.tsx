import Link from "next/link"

/** 첫 화면 맨 위 "견적서 사진으로 확인" (정비소에서 견적을 받은 순간에 바로 쓰도록) */
export function QuoteEntry({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/quote"
      className="flex items-center gap-4 rounded-2xl bg-primary p-4 text-primary-foreground transition hover:brightness-110 active:translate-y-px"
    >
      <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
          <circle cx="12" cy="13.5" r="3.5" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-extrabold leading-snug">견적서 받으셨어요?</span>
        <span className="block text-[13px] leading-snug text-white/85">
          {compact ? "사진 한 장이면 공임나라로 아낄 항목을 찾아 드려요" : "사진 한 장이면 몇 초 만에 공임나라로 아낄 항목과 금액을 알려 드려요"}
        </span>
      </span>
      <span aria-hidden className="text-[22px] text-white/80">›</span>
    </Link>
  )
}

import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없어요 | 정비핵",
  robots: { index: false },
}

/** 없는 주소(404): 기본 영어 화면 대신 한국어 안내 + 홈·차종 찾기 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-16 text-center">
      <p className="num text-[40px] font-extrabold text-muted-foreground">404</p>
      <h1 className="mt-2 text-[22px] font-extrabold leading-snug">페이지를 찾을 수 없어요</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">주소가 바뀌었거나 없는 페이지예요.</p>
      <div className="mt-8 grid gap-2">
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-[10px] bg-primary px-5 text-[15px] font-bold text-primary-foreground transition hover:brightness-110 active:translate-y-px"
        >
          홈으로
        </Link>
        <Link
          href="/cars"
          className="inline-flex h-12 items-center justify-center rounded-[10px] border border-border bg-card px-5 text-[15px] font-bold transition hover:bg-muted active:translate-y-px"
        >
          차종 찾기
        </Link>
      </div>
    </div>
  )
}

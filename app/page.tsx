import Link from "next/link"
import { ShieldCheck, Zap, Wrench } from "lucide-react"
import { CompatibilityChecker } from "@/components/CompatibilityChecker"

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      {/* ── 히어로 섹션 ──────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:py-16">
        {/* 아이브로우 배지 */}
        <div className="mb-5 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
          AI 부품 호환성 즉시 검증 서비스
        </div>

        {/* 헤드라인 */}
        <h1 className="mb-3 text-center text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
          부품 구매 전{" "}
          <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
            마지막 확인
          </span>
          , 정비핵
        </h1>
        <p className="mb-10 max-w-sm text-center text-sm leading-relaxed text-muted-foreground sm:max-w-md sm:text-base">
          차대번호와 상품 링크만 넣으면
          <br className="hidden sm:block" />{" "}
          전문가 AI가 호환성을 즉시 판정합니다
        </p>

        {/* 메인 카드 — 글로우 효과 포함 */}
        <div className="relative w-full max-w-2xl">
          <div
            aria-hidden
            className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary/20 via-emerald-400/10 to-primary/20 blur-xl"
          />
          <div className="relative rounded-xl border border-border bg-card p-6 shadow-lg">
            <CompatibilityChecker heroMode />
          </div>
        </div>

        {/* 신뢰 배지 */}
        <div className="mt-8 flex flex-wrap justify-center gap-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            차대번호 개인정보 미저장
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-primary" />
            평균 15초 내 결과
          </span>
          <span className="flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5 text-primary" />
            국산·수입차 전 차종 지원
          </span>
        </div>
      </main>

      {/* ── 하단 계산기 유입 CTA ────────────────────────────────── */}
      <div className="border-t border-border py-5 text-center">
        <p className="text-xs text-muted-foreground">
          정비 비용도 계산하고 싶다면?{" "}
          <Link
            href="/calculator"
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            정비 비용 계산기 바로가기 →
          </Link> · <Link
            href="/cars"
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            차종별 소모품 비용 보기 →
          </Link>
        </p>
      </div>
    </div>
  )
}

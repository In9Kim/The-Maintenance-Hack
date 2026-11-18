"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

// "견적서 분석"(Phase 3, 미완성)은 기능이 열릴 때까지 메뉴에서 숨김
// 휴대폰은 한 줄에 들어가도록 짧은 이름(short)을 쓴다
const NAV = [
  { href: "/cars", label: "차종별 비용", short: "차종별 비용", match: (p: string) => p.startsWith("/cars") },
  { href: "/calculator", label: "비용 계산기", short: "계산기", match: (p: string) => p === "/calculator" },
  { href: "/recalls", label: "리콜 정보", short: "리콜", match: (p: string) => p.startsWith("/recalls") },
]

/** 로고: 영수증 한 장 (견적서를 다시 쓴다는 뜻) */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#14213D" />
      <path d="M10 7h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" fill="#fff" />
      <path d="M13 12h6M13 15.5h6" stroke="#14213D" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13 19h3.5" stroke="#0B7A53" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="정비핵 홈">
          <LogoMark />
          <span className="text-[17px] font-extrabold tracking-tight">정비핵</span>
        </Link>
        <nav aria-label="주 메뉴" className="flex items-center gap-1 whitespace-nowrap text-[15px]">
          {NAV.map((item) => {
            const active = item.match(pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] items-center rounded-lg px-2.5 transition-colors sm:px-3 ${
                  active ? "font-bold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="sm:hidden">{item.short}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

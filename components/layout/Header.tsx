"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

// 휴대폰은 위 메뉴를 숨기고 아래 탭(BottomNav)을 쓴다. 부품 호환 확인·계산기는 메뉴에서 빼고 차종·부품 페이지 안에서 연결
export const NAV = [
  { href: "/cars", label: "차종별 비용", match: (p: string) => p.startsWith("/cars") },
  { href: "/near", label: "근처 정비소", match: (p: string) => p.startsWith("/near") },
  { href: "/my", label: "마이", match: (p: string) => p.startsWith("/my") || p.startsWith("/info") || p.startsWith("/recalls") || p === "/check" },
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
        <nav aria-label="주 메뉴" className="hidden items-center gap-0.5 whitespace-nowrap text-[15px] md:flex">
          {NAV.map((item) => {
            const active = item.match(pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] items-center rounded-lg px-2.5 transition-colors lg:px-3 ${
                  active ? "font-bold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

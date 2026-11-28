"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { InboxBell } from "@/components/layout/InboxBell"
// 탭 판정은 아래 탭(BottomNav)과 같은 것을 쓴다 (두 벌로 만들지 않기)
import { matchHome, matchCare, matchQuote, matchNear, matchMore } from "@/lib/nav-match"

// 휴대폰은 위 메뉴를 숨기고 아래 탭(BottomNav)을 쓴다. 순서는 아래 탭과 같게 (홈·정비·견적서·정비소·더보기)
export const NAV = [
  { href: "/cars", label: "차종별 비용", match: (p: string) => matchHome(p) && p !== "/" && p !== "/inbox" },
  { href: "/my", label: "내 차 정비", match: matchCare },
  { href: "/quote", label: "견적서 분석", match: matchQuote },
  { href: "/near", label: "근처 정비소", match: matchNear },
  { href: "/more", label: "더보기", match: matchMore },
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
        {/* 메뉴와 종을 한 묶음으로: 종이 없는 화면에도 같은 너비 빈칸을 둬서 메뉴 위치가 화면마다 움직이지 않게 */}
        <div className="flex items-center gap-1">
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
        {pathname === "/" ? <InboxBell /> : <span aria-hidden className="hidden h-11 w-11 shrink-0 md:block" />}
        </div>
      </div>
    </header>
  )
}

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { matchHome, matchCare, matchQuote, matchNear, matchMore } from "@/lib/nav-match"

/** 휴대폰 아래 탭 5개: 홈(/·차종) · 정비(/my·내 차 리콜) · 견적서 · 정비소 · 더보기(계정·도구·안내, 전체 리콜·계산기 포함).
 *  어느 주소에서 어느 탭에 불이 켜지는지는 위 메뉴(Header)와 같은 판정(lib/nav-match.ts)을 쓴다 */
const TABS = [
  { href: "/", label: "홈", match: matchHome, icon: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  // 렌치: 둥근 머리 + 비스듬한 손잡이 (직접 그린 단순한 선)
  { href: "/my", label: "정비", match: matchCare, icon: "M14.5 4.5a4 4 0 0 0-4.9 5.2L4 15.3a1.8 1.8 0 0 0 2.6 2.6l5.6-5.6a4 4 0 0 0 5.2-4.9l-2.6 2.6-2.3-.6-.6-2.3z" },
  { href: "/quote", label: "견적서", match: matchQuote, icon: "M7 3h10v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5zM10 8h4M10 12h4M10 16h2" },
  { href: "/near", label: "정비소", match: matchNear, icon: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
  // 더보기: 가로 줄 3개
  { href: "/more", label: "더보기", match: matchMore, icon: "M5 7h14M5 12h14M5 17h14" },
]

export function BottomNav() {
  const pathname = usePathname()
  if (pathname.startsWith("/admin")) return null

  return (
    <nav
      aria-label="아래 메뉴"
      data-bottom-nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-lg">
        {TABS.map((t) => {
          const active = t.match(pathname)
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 whitespace-nowrap text-[11px] ${active ? "font-bold text-foreground" : "text-muted-foreground"}`}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={t.icon} />
              </svg>
              {t.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

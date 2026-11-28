"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

/** 리콜 화면 (/recalls, /cars/{차}/recalls): 마이 '리콜 확인'에서 들어오므로 마이 탭 */
const isRecalls = (p: string) => p.startsWith("/recalls") || p.endsWith("/recalls")

/** 휴대폰 아래 탭 4개 (견적서는 정비소 앞에서 바로 쓰도록 탭으로). 리콜(내 차 리콜은 맨 위 빨간 띠)·출처·부품 확인 같은 정보는 '마이' 안에 */
const TABS = [
  { href: "/", label: "홈", match: (p: string) => p === "/" || (p.startsWith("/cars") && !isRecalls(p)) || p === "/calculator", icon: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/quote", label: "견적서", match: (p: string) => p === "/quote", icon: "M7 3h10v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5zM10 8h4M10 12h4M10 16h2" },
  { href: "/near", label: "정비소", match: (p: string) => p.startsWith("/near"), icon: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
  { href: "/my", label: "마이", match: (p: string) => p.startsWith("/my") || p.startsWith("/info") || p === "/check" || isRecalls(p) || p === "/privacy", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0" },
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
              className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? "font-bold text-foreground" : "text-muted-foreground"}`}
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

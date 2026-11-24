"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

/** 휴대폰 아래 탭: 엄지로 누르기 쉬운 자리에 자주 쓰는 5개 */
const TABS = [
  { href: "/", label: "홈", match: (p: string) => p === "/", icon: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/my", label: "내 차", match: (p: string) => p === "/my", icon: "M5 16h14M6.5 16l1.6-5.2A2 2 0 0 1 10 9.4h4a2 2 0 0 1 1.9 1.4L17.5 16M4 16v3h2.5v-1.5h11V19H20v-3a2 2 0 0 0-1-1.7M7.5 13.2h.01M16.5 13.2h.01" },
  { href: "/check", label: "부품확인", match: (p: string) => p === "/check", icon: "M9 12.5l2 2 4-4.5M12 3l7 3v5.5c0 4.3-3 7.9-7 9.5-4-1.6-7-5.2-7-9.5V6z" },
  { href: "/near", label: "정비소", match: (p: string) => p.startsWith("/near"), icon: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
]

const MORE = [
  { title: "비용 알아보기", items: [
    { href: "/cars", label: "차종별 소모품 가격" },
    { href: "/calculator", label: "정비 비용 계산기" },
  ] },
  { title: "근처 찾기", items: [
    { href: "/near", label: "공임나라" },
    { href: "/near/carcenter", label: "카센터" },
    { href: "/near/bluehands", label: "블루핸즈 (현대·제네시스)" },
    { href: "/near/autoq", label: "오토큐 (기아)" },
    { href: "/near/carwash", label: "세차장" },
  ] },
  { title: "안전", items: [{ href: "/recalls", label: "리콜 정보" }] },
]

const moreMatch = (p: string) => p.startsWith("/cars") || p === "/calculator" || p.startsWith("/recalls")

export function BottomNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  if (pathname.startsWith("/admin")) return null

  const tabCls = (active: boolean) =>
    `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? "font-bold text-foreground" : "text-muted-foreground"}`

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="전체 메뉴">
          <button aria-label="메뉴 닫기" className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-card px-5 pb-[calc(76px+env(safe-area-inset-bottom))] pt-5 shadow-[0_-8px_24px_rgba(20,33,61,0.12)]">
            {MORE.map((g) => (
              <div key={g.title} className="mb-4 last:mb-0">
                <p className="text-[12px] font-semibold text-muted-foreground">{g.title}</p>
                <ul className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {g.items.map((it) => (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        aria-current={pathname === it.href ? "page" : undefined}
                        className={`flex min-h-[44px] items-center rounded-lg px-3 text-[15px] ${pathname === it.href ? "bg-muted font-bold" : "bg-background"}`}
                      >
                        {it.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      <nav
        aria-label="아래 메뉴"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-lg">
          {TABS.map((t) => {
            const active = !open && t.match(pathname)
            return (
              <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={tabCls(active)}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={t.icon} />
                </svg>
                {t.label}
              </Link>
            )
          })}
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className={tabCls(open || moreMatch(pathname))}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={open ? 2.2 : 1.7} strokeLinecap="round" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
            {open ? "닫기" : "더보기"}
          </button>
        </div>
      </nav>
    </>
  )
}

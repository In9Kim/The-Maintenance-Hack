"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Wrench } from "lucide-react"
import { Separator } from "@/components/ui/separator"

// "견적서 분석"(Phase 3, 미완성)은 기능이 열릴 때까지 메뉴에서 숨김
const NAV = [
  { href: "/", label: "호환성 검증", match: (p: string) => p === "/" },
  { href: "/calculator", label: "비용 계산기", match: (p: string) => p === "/calculator" },
  { href: "/cars", label: "차종별 비용", match: (p: string) => p.startsWith("/cars") },
  { href: "/recalls", label: "리콜 정보", match: (p: string) => p.startsWith("/recalls") },
]

export function Header() {
  const pathname = usePathname()

  const navCls = (active: boolean) =>
    `rounded-md py-1.5 transition-colors hover:bg-accent hover:text-foreground ${
      active ? "text-foreground font-semibold" : "text-muted-foreground"
    }`

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex h-14 items-center justify-between">
            {/* 로고 */}
            <Link href="/" className="flex shrink-0 items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Wrench className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight">정비핵</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                The Maintenance Hack
              </span>
            </Link>

            {/* 네비게이션 (태블릿·PC: 로고 옆 한 줄) */}
            <nav aria-label="주 메뉴" className="ml-2 hidden min-w-0 items-center gap-1 whitespace-nowrap text-sm sm:flex">
              {NAV.map((item, i) => (
                <Fragment key={item.href}>
                  {i > 0 && <Separator orientation="vertical" className="mx-1 h-4" />}
                  <Link
                    href={item.href}
                    aria-current={item.match(pathname) ? "page" : undefined}
                    className={`${navCls(item.match(pathname))} px-3`}
                  >
                    {item.label}
                  </Link>
                </Fragment>
              ))}
            </nav>
          </div>

          {/* 네비게이션 (휴대폰: 한 줄에 다 안 들어가서 로고 아래 둘째 줄에 네 개를 고르게) */}
          <nav aria-label="주 메뉴" className="-mx-2 flex items-center justify-between pb-2 text-sm sm:hidden">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.match(pathname) ? "page" : undefined}
                className={`${navCls(item.match(pathname))} px-2`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
    </>
  )
}

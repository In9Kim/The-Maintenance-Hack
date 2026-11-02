"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Wrench } from "lucide-react"
import { Separator } from "@/components/ui/separator"

// "견적서 분석"(Phase 3, 미완성)은 기능이 열릴 때까지 메뉴에서 숨김
export function Header() {
  const pathname = usePathname()

  const navCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 transition-colors hover:bg-accent hover:text-foreground ${
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

            {/* 네비게이션 */}
            <nav className="ml-2 flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap text-sm">
              <Link href="/" className={navCls(pathname === "/")}>
                호환성 검증
              </Link>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <Link href="/calculator" className={navCls(pathname === "/calculator")}>
                비용 계산기
              </Link>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <Link href="/cars" className={navCls(pathname.startsWith("/cars"))}>
                차종별 비용
              </Link>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <Link href="/recalls" className={navCls(pathname.startsWith("/recalls"))}>
                리콜 정보
              </Link>
            </nav>
          </div>
        </div>
      </header>
    </>
  )
}

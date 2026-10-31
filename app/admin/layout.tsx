import type { ReactNode } from "react"

export const metadata = { title: "정비핵 관리자" }

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              ADMIN
            </span>
            <span className="font-semibold">정비핵 관리자</span>
          </div>
          <a
            href="/"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← 메인으로
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}

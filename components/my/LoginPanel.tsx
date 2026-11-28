"use client"

import Link from "next/link"
import type { Provider } from "@/lib/supabase"
import { LoginButtons } from "@/components/my/LoginButtons"

/** 로그인하면 생기는 것 (로그인 버튼 위에 항상 같이 보여 준다) */
const PERKS = {
  alert: {
    title: "교체 시기 알림",
    sub: "엔진오일 갈 때가 되면 아침에 알려 드려요",
    icon: <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
  },
  more: {
    title: "AI 분석 하루 3번",
    sub: "견적서·부품 확인 (로그인 전엔 1번)",
    icon: <path d="M4 18V9M10 18V5M16 18v-6M20.5 18h-17" />,
  },
  keep: {
    title: "폰 바꿔도 그대로",
    sub: "차 여러 대와 교체 기록을 계정에 저장",
    icon: <path d="M5 13.5 6.8 8.6A2 2 0 0 1 8.7 7.3h6.6a2 2 0 0 1 1.9 1.3l1.8 4.9M4 13.5h16v4H4zM6.5 17.5V19M17.5 17.5V19M7.5 15.5h1M15.5 15.5h1" />,
  },
} as const

export type Perk = keyof typeof PERKS

export function LoginPanel({
  providers,
  next,
  title = "로그인하면 이런 게 생겨요",
  order = ["alert", "more", "keep"],
  className = "",
}: {
  providers: Provider[]
  next?: string
  title?: string
  order?: Perk[]
  className?: string
}) {
  if (!providers.length) return null
  return (
    <div className={`rounded-[14px] border border-border bg-card p-4 ${className}`}>
      <p className="text-[16px] font-extrabold">{title}</p>
      <ul className="mt-3 space-y-3">
        {order.map((k) => {
          const p = PERKS[k]
          return (
            <li key={k} className="flex items-center gap-3">
              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#ECFDF3] text-[#067647]">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {p.icon}
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold">{p.title}</span>
                <span className="block text-[13px] text-muted-foreground">{p.sub}</span>
              </span>
            </li>
          )
        })}
      </ul>
      <div className="mt-4">
        <LoginButtons providers={providers} next={next} />
      </div>
      <p className="mt-2 text-center text-[12px] text-muted-foreground">
        가입비 없음 · 번호판·차대번호는 받지 않아요 · <Link href="/privacy" className="underline underline-offset-2">개인정보 처리방침</Link>
      </p>
    </div>
  )
}

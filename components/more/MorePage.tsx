"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { AccountBox } from "@/components/my/AccountBox"

// 더보기: 계정(로그인·알림·로그아웃·탈퇴) → 도구 → 안내. 한 줄 목록 + ›, 설명 글 없음.
// 실제 화면이 있는 주소만 넣는다 (/shop-card 는 /my 로 넘기기만 해서 뺌)
const TOOLS = [
  { href: "/quote", label: "견적서 분석" },
  { href: "/check", label: "부품 맞나요?" },
  { href: "/recalls", label: "리콜 확인" },
  { href: "/calculator", label: "정비비 계산기" },
]

const GUIDE = [
  { href: "/info", label: "데이터 출처·이용 안내" },
  { href: "/privacy", label: "개인정보 처리방침" },
]

const CONTACT = "mailto:wwe9459@naver.com?subject=%EC%A0%95%EB%B9%84%ED%95%B5%20%EB%AC%B8%EC%9D%98"

const ROW = "flex min-h-[52px] items-center justify-between whitespace-nowrap px-4 text-[15px]"
const Arrow = () => <span aria-hidden className="text-muted-foreground">›</span>

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title} className="mt-6">
      <p className="px-1 text-[13px] font-semibold text-muted-foreground">{title}</p>
      <div className="mt-2 divide-y divide-border rounded-[14px] border border-border bg-card">{children}</div>
    </nav>
  )
}

export function MorePage() {
  return (
    <div className="mx-auto max-w-2xl px-5 pb-12 pt-6">
      <h1 className="sr-only">더보기</h1>
      <AccountBox />

      <Section title="도구">
        {TOOLS.map((m) => (
          <Link key={m.href} href={m.href} className={ROW}>
            {m.label}
            <Arrow />
          </Link>
        ))}
      </Section>

      <Section title="안내">
        {GUIDE.map((m) => (
          <Link key={m.href} href={m.href} className={ROW}>
            {m.label}
            <Arrow />
          </Link>
        ))}
        <a href={CONTACT} className={ROW}>
          문의하기
          <Arrow />
        </a>
      </Section>
    </div>
  )
}

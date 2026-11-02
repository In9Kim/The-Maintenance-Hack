"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { track } from "@/lib/track"

/** 사이트 안 이동 링크 중 성과를 재고 싶은 것 (예: 리콜 페이지 → 소모품 비용 페이지). type=nav 로 기록 */
export function TrackedLink({
  href,
  carId,
  label,
  className,
  children,
}: {
  href: string
  carId?: string
  /** 어떤 링크인지 구분하는 이름 (events 탭 meta.link) */
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => track({ type: "nav", carId, meta: { link: label, to: href } })}
    >
      {children}
    </Link>
  )
}

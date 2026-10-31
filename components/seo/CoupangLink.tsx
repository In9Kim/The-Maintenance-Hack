"use client"

import { useEffect, useState } from "react"
import { ShoppingCart } from "lucide-react"
import { getCoupangSearchUrl } from "@/lib/utils"

/**
 * 쿠팡 파트너스 딥링크 버튼.
 * /api/coupang-link 로 수익 추적 링크를 받아오고, 실패하면 일반 검색 링크로 대체합니다.
 */
export function CoupangLink({ keyword, label = "쿠팡에서 최저가 보기" }: { keyword: string; label?: string }) {
  const [href, setHref] = useState(() => getCoupangSearchUrl(keyword))

  useEffect(() => {
    let alive = true
    fetch("/api/coupang-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputPart: keyword }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { shortenUrl?: string } | null) => {
        if (alive && json?.shortenUrl) setHref(json.shortenUrl)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [keyword])

  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored nofollow noopener"
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
    >
      <ShoppingCart className="h-4 w-4" />
      {label}
    </a>
  )
}

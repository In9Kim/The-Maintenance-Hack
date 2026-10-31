"use client"

import type { ReactNode } from "react"
import { track, type ClientEvent } from "@/lib/track"

/** 외부 구매·예약 사이트로 나가는 링크. 클릭하면 구글시트에 이동 기록을 남깁니다. */
export function OutboundLink({
  href,
  target,
  carId,
  partId,
  className,
  sponsored = false,
  children,
}: {
  href: string
  target: NonNullable<ClientEvent["target"]>
  carId?: string
  partId?: string
  className?: string
  sponsored?: boolean
  children: ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel={sponsored ? "sponsored nofollow noopener" : "nofollow noopener"}
      onClick={() => track({ type: "outbound", target, carId, partId })}
      className={className}
    >
      {children}
    </a>
  )
}

"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { readInbox, seenAt } from "@/lib/inbox"
import { hasUnread } from "@/lib/inbox-core"

/** 홈 위 오른쪽 종: 안 읽은 알림이 있으면 빨간 점, 누르면 알림함 */
export function InboxBell() {
  const [unread, setUnread] = useState(false)

  useEffect(() => {
    let alive = true
    const check = () => {
      readInbox().then((items) => {
        if (alive) setUnread(hasUnread(items, seenAt()))
      })
    }
    check()
    // 서비스 워커가 새 알림을 저장했을 때
    const onMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === "mh-inbox") check()
    }
    const onVis = () => {
      if (document.visibilityState === "visible") check()
    }
    const sw = typeof navigator !== "undefined" && "serviceWorker" in navigator ? navigator.serviceWorker : null
    sw?.addEventListener("message", onMsg)
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("mh-inbox", check)
    return () => {
      alive = false
      sw?.removeEventListener("message", onMsg)
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("mh-inbox", check)
    }
  }, [])

  return (
    <Link
      href="/inbox"
      aria-label={unread ? "알림함, 새 알림 있음" : "알림함"}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />
      </svg>
      {unread && (
        <span aria-hidden className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-card" />
      )}
    </Link>
  )
}

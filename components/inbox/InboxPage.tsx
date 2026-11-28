"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { readInbox, markAllRead } from "@/lib/inbox"
import { ago, type InboxItem } from "@/lib/inbox-core"
import { authEnabled, supabase } from "@/lib/supabase"

/** 알림함: 이 폰에서 받은 교체 시기 알림 (서비스 워커가 저장, 최근 50개·90일) */
export function InboxPage() {
  const [items, setItems] = useState<InboxItem[] | null>(null)
  // 빈 화면 문구용: 로그인 여부 (확인하는 동안 null → 회색 틀만)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [now, setNow] = useState(0)

  useEffect(() => {
    let alive = true
    readInbox().then((list) => {
      if (!alive) return
      setNow(Date.now())
      setItems(list)
      markAllRead()
    })
    return () => {
      alive = false
    }
  }, [])

  // 알림이 하나도 없을 때만 로그인 여부를 봄 (supabase 불러오는 용량 아끼기)
  const empty = items !== null && items.length === 0
  useEffect(() => {
    if (!empty) return
    if (!authEnabled()) return setLoggedIn(false)
    let alive = true
    supabase()
      .then((sb) => sb.auth.getSession())
      .then(({ data }) => alive && setLoggedIn(!!data.session))
      .catch(() => alive && setLoggedIn(false))
    return () => {
      alive = false
    }
  }, [empty])

  const wrap = "mx-auto max-w-2xl px-5 pb-12 pt-6 sm:pt-10"
  const heading = <h1 className="text-[22px] font-extrabold">알림함</h1>

  if (items === null || (empty && loggedIn === null)) {
    return (
      <div className={wrap}>
        {heading}
        <div className="mt-5 h-40 animate-pulse rounded-[14px] bg-muted" />
      </div>
    )
  }

  if (empty) {
    return (
      <div className={wrap}>
        {heading}
        <div className="mt-5 rounded-[14px] border border-border bg-card px-4 py-10 text-center">
          {loggedIn ? (
            <p className="text-[15px] text-muted-foreground">아직 받은 알림이 없어요</p>
          ) : (
            <>
              <p className="text-[15px] text-muted-foreground [word-break:keep-all]">로그인하면 교체할 때 알려 드려요</p>
              <Link
                href="/more"
                className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-primary px-5 text-[15px] font-bold text-primary-foreground"
              >
                로그인하기
              </Link>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={wrap}>
      {heading}
      <ul className="mt-5 divide-y divide-border rounded-[14px] border border-border bg-card">
        {items.map((it, i) => (
          <li key={it.id ?? `${it.at}-${i}`}>
            <Link href={it.url || "/my"} className="flex min-h-[56px] flex-col justify-center gap-0.5 px-4 py-3 hover:bg-muted">
              <span className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 line-clamp-2 break-keep text-[15px] font-semibold">{it.title}</span>
                <span className="shrink-0 text-[12px] text-muted-foreground">{ago(it.at, now)}</span>
              </span>
              {it.body && <span className="truncate text-[13px] text-muted-foreground">{it.body}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

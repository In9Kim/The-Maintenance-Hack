"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { loadRecent, saveRecent, type RecentItem } from "@/lib/recent"

/** 차종·부품 페이지에 넣으면 "최근 본"에 기록한다 (화면에는 아무것도 안 그림) */
export function TrackRecent({ href, title, sub, img }: { href: string; title: string; sub?: string; img?: string }) {
  useEffect(() => {
    saveRecent({ href, title, sub, img })
  }, [href, title, sub, img])
  return null
}

/** 최근 본 차·부품 가로 목록. 기록이 없으면 아무것도 안 보인다. */
export function RecentList({ className = "" }: { className?: string }) {
  const [items, setItems] = useState<RecentItem[]>([])
  useEffect(() => setItems(loadRecent()), [])
  if (!items.length) return null
  return (
    <section className={`min-w-0 ${className}`} aria-label="최근 본 차·부품">
      <h2 className="text-[15px] font-bold">최근 본</h2>
      <ul className="-mx-5 mt-2 flex snap-x gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {items.map((x) => (
          <li key={x.href} className="w-[132px] shrink-0 snap-start">
            <Link href={x.href} className="group block overflow-hidden rounded-[12px] border border-border bg-card transition hover:border-primary/40">
              {x.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={x.img} alt="" width={132} height={82} loading="lazy" className="aspect-[16/10] w-full bg-muted object-cover" />
              ) : (
                <span className="flex aspect-[16/10] items-center justify-center bg-muted text-[12px] text-muted-foreground">정비핵</span>
              )}
              <span className="block px-2.5 py-2">
                <span className="block truncate text-[13px] font-bold">{x.title}</span>
                <span className="block truncate text-[12px] text-muted-foreground">{x.sub ?? "소모품 전체"}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

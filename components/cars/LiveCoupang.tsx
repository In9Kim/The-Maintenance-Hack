"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { OutboundLink } from "@/components/seo/OutboundLink"
import { AFFILIATE_TEXT } from "@/lib/affiliate"

/** 쿠팡 상품 한 줄 (사진·이름·가격). 견적서 결과에서도 같은 모양으로 씀 */
export function ProductRow({ href, carId, partId, name, price, image }: { href: string; carId: string; partId: string; name: string; price: number; image?: string }) {
  return (
    <OutboundLink href={href} target="coupang" carId={carId} partId={partId} sponsored className="flex items-center gap-3 px-3 py-2">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 shrink-0 rounded-md bg-white object-contain" />
      )}
      <span className="line-clamp-2 min-w-0 flex-1 text-[12px] leading-snug text-foreground">{name}</span>
      <span className="num shrink-0 text-[14px] font-bold text-foreground">{price.toLocaleString("ko-KR")}원</span>
    </OutboundLink>
  )
}

interface Item { productId: number; name: string; price: number; url: string; image?: string; rocket: boolean }

/**
 * 골라 둔 상품이 없는 부품: 이 차종으로 쿠팡을 바로 검색해 상위 3개를 사진·가격과 함께 보여 준다.
 * (검색 결과라 내 차에 맞는지는 상품명 확인 필요 → /check로 AI 확인 연결)
 */
export function LiveCoupang({ carId, part, q, partId, emptyText, compact = false }: { carId: string; part?: string; q?: string; partId: string; emptyText?: string; compact?: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setItems(null)
    setFailed(false)
    fetch(`/api/coupang-search?${new URLSearchParams(part ? { carId, part } : { carId, q: q ?? "" })}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { items?: Item[] }) => alive && setItems((j.items ?? []).slice(0, 3)))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [carId, part, q])

  if (!items && !failed) return <div className={`${compact ? "h-[116px]" : "h-[168px]"} animate-pulse rounded-[12px] bg-muted`} />
  if (failed || !items?.length) return emptyText ? <p className="rounded-[10px] bg-muted px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">{emptyText}</p> : null
  if (compact)
    return (
      <div>
        <ul className="divide-y divide-border rounded-[10px] border border-border bg-card">
          {items.slice(0, 2).map((it) => (
            <li key={it.productId}>
              <ProductRow href={it.url} carId={carId} partId={partId} name={it.name} price={it.price} image={it.image} />
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">상품명의 연식이 내 차와 같은지 보세요. {AFFILIATE_TEXT}</p>
      </div>
    )
  return (
    <div>
      <p className="text-[12px] font-semibold text-muted-foreground">쿠팡 검색 결과 · 상품명의 차종·연식을 꼭 확인하세요</p>
      <ul className="mt-1.5 divide-y divide-border rounded-[12px] border border-border bg-card">
        {items.map((it) => (
          <li key={it.productId}>
            <OutboundLink href={it.url} target="coupang" carId={carId} partId={partId} sponsored className="flex items-center gap-3 px-3 py-2.5">
              {it.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-md bg-white object-contain ring-1 ring-border" />
              )}
              <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug">{it.name}</span>
              <span className="num shrink-0 text-[14px] font-bold">{it.price.toLocaleString("ko-KR")}원</span>
            </OutboundLink>
          </li>
        ))}
      </ul>
      <Link href="/check" className="mt-1 inline-flex min-h-[36px] items-center text-[12px] font-semibold text-primary">
        내 차에 맞는지 AI로 확인하기 ›
      </Link>
    </div>
  )
}

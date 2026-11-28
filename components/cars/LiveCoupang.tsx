"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { OutboundLink } from "@/components/seo/OutboundLink"
import { AFFILIATE_TEXT } from "@/lib/affiliate"
import { orderCoupangItems } from "@/lib/coupang-order"

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
export function LiveCoupang({
  carId,
  part,
  q,
  partId,
  engine,
  emptyText,
  compact = false,
  fallback,
  hideNotice = false,
  title,
  footer,
  lazy = false,
}: {
  carId: string
  part?: string
  q?: string
  partId: string
  /** 등록한 엔진 이름 (예: 'D2.2 디젤'). 있으면 다른 엔진용 상품을 뺀다 */
  engine?: string
  emptyText?: string
  compact?: boolean
  /** 못 불러오거나 결과가 없을 때 emptyText 대신 보여 줄 것 (예: 검색 링크) */
  fallback?: ReactNode
  /** compact에서 파트너스 고지를 빼기 (위에서 한 번 보여 줄 때) */
  hideNotice?: boolean
  /** 상품이나 fallback이 보일 때만 위에 붙는 제목 (빈 제목만 남지 않게) */
  title?: ReactNode
  /** 상품이나 fallback이 보일 때만 아래에 붙는 글 (예: 오일 필요량) */
  footer?: ReactNode
  /** 화면에 보일 때만 불러오기 (쿠팡 검색 API 호출 줄이기) */
  lazy?: boolean
}) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [visible, setVisible] = useState(!lazy)
  const boxRef = useRef<HTMLDivElement>(null)

  // lazy: 자리 표시(회색 틀)가 화면 가까이 오면 그때 한 번 불러옴
  useEffect(() => {
    if (visible) return
    const el = boxRef.current
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: "200px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible) return
    let alive = true
    setItems(null)
    setFailed(false)
    const params: Record<string, string> = part ? { carId, part } : { carId, q: q ?? "" }
    if (part && engine) params.engine = engine
    fetch(`/api/coupang-search?${new URLSearchParams(params)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { items?: Item[]; pickId?: number | null }) => alive && setItems(orderCoupangItems(j.items ?? [], j.pickId)))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [carId, part, q, engine, visible])

  if (!items && !failed) return <div ref={boxRef} className={`${compact ? "h-[116px]" : "h-[168px]"} animate-pulse rounded-[12px] bg-muted`} />
  if (failed || !items?.length) {
    if (fallback != null && fallback !== false) return <div>{title}{fallback}{footer}</div>
    return emptyText ? <div>{title}<p className="rounded-[10px] bg-muted px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">{emptyText}</p></div> : null
  }
  if (compact)
    return (
      <div>
        {title}
        <ul className="divide-y divide-border rounded-[10px] border border-border bg-card">
          {items.slice(0, 2).map((it) => (
            <li key={it.productId}>
              <ProductRow href={it.url} carId={carId} partId={partId} name={it.name} price={it.price} image={it.image} />
            </li>
          ))}
        </ul>
        {/* hideNotice: 고지·연식 안내를 위에서 한 번 보여 줌 (부품마다 반복하지 않게) */}
        {!hideNotice && <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">상품명의 연식이 내 차와 같은지 보세요. {AFFILIATE_TEXT}</p>}
        {footer}
      </div>
    )
  return (
    <div>
      {title}
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

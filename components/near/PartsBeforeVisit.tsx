"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { dueList, loadMyCar, nextAction, type MyCar, type PartDue } from "@/lib/my-car"
import { isCustomCar } from "@/lib/car-catalog"
import { OutboundLink } from "@/components/seo/OutboundLink"
import { AFFILIATE_TEXT } from "@/lib/affiliate"

/** 정비소 가기 전에 챙길 부품: 교체 시기가 지났거나 곧인 부품만, 최대 3개 (홈과 같은 기준, lib/my-car nextAction).
 *  기록이 없는 부품은 추천하지 않는다 (예전엔 쿠팡 상품이 있는 부품을 대신 보여 줘서 내 차와 상관없는 추천이 됐음) */
export function partsToBring(my: MyCar, max = 3): PartDue[] {
  const a = nextAction(my)
  return a.type === "buy" ? a.urgent.slice(0, max) : []
}

function useMyCar() {
  const [my, setMy] = useState<MyCar | null | undefined>(undefined)
  useEffect(() => {
    const read = () => setMy(loadMyCar())
    read()
    window.addEventListener("mh-my-car", read)
    return () => window.removeEventListener("mh-my-car", read)
  }, [])
  return my
}

function PartRows({ my, items }: { my: MyCar; items: PartDue[] }) {
  return (
    <ul className="mt-3 divide-y divide-border rounded-[12px] border border-border bg-card">
      {items.map((d) => (
        <li key={d.part.slug} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold">{d.part.name}</span>
            {(d.state === "over" || d.state === "soon") && <span className="block text-[12px] font-semibold text-[#B54708]">{d.text}</span>}
          </span>
          {d.part.shop ? (
            <OutboundLink
              href={d.part.shop.url}
              target="coupang"
              carId={my.car.id}
              partId={d.part.slug}
              sponsored
              className="num inline-flex min-h-[40px] shrink-0 items-center rounded-lg bg-primary px-3 text-[13px] font-bold text-primary-foreground"
            >
              쿠팡 {d.part.shop.price.toLocaleString("ko-KR")}원
            </OutboundLink>
          ) : (
            <Link href={`/cars/${my.car.id}/${d.part.slug}`} className="shrink-0 text-[13px] font-semibold text-primary">
              가격 보기 ›
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}

/** 정비소 지도 위: 등록한 차면 챙길 부품과 쿠팡 가격, 아니면 등록 유도 */
export function PartsBeforeVisit({ kind }: { kind: "gongim" | "bluehands" | "autoq" | string }) {
  const my = useMyCar()
  if (my === undefined || kind === "carwash") return null
  const gongim = kind === "gongim"

  if (!my) {
    return (
      <div className="rounded-[14px] border border-primary/30 bg-[#F6FEF9] p-4">
        <p className="text-[15px] font-bold">{gongim ? "부품을 사 가면 공임만 내요" : "맡기기 전에 부품값을 알아 두세요"}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">내 차를 등록하면 맞는 부품과 쿠팡 가격을 바로 보여 드려요</p>
        <Link href="/my" className="mt-3 flex h-11 items-center justify-center rounded-[10px] bg-primary text-[14px] font-bold text-primary-foreground">
          내 차 등록하기
        </Link>
      </div>
    )
  }

  if (isCustomCar(my.car.id)) return null
  const items = partsToBring(my)
  if (!items.length) {
    // 기록이 부족하면 엉뚱한 부품 대신 기록을 넣으라고 안내 (홈에서 버튼으로 바로 답할 수 있음)
    const unknown = dueList(my).filter((d) => d.state === "unknown").length
    if (!unknown || !gongim) return null
    return (
      <Link href="/" className="flex items-center gap-3 rounded-[14px] border border-primary/30 bg-[#F6FEF9] p-4">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">가기 전에 챙길 부품, 알려 드릴까요?</span>
          <span className="block text-[13px] text-muted-foreground">언제 갈았는지 버튼으로 골라 주세요</span>
        </span>
        <span aria-hidden className="text-primary">›</span>
      </Link>
    )
  }
  return (
    <div className="rounded-[14px] border border-primary/30 bg-[#F6FEF9] p-4">
      <p className="text-[15px] font-bold">{gongim ? "가기 전에 사 갈 부품" : "내 차 부품값"}</p>
      <PartRows my={my} items={items} />
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{AFFILIATE_TEXT}</p>
    </div>
  )
}

/** 공임나라 길찾기 누르기 직전 한 번(방문 중 1회): "부품 준비하셨어요?" */
const ASKED_KEY = "mh_parts_asked"
export function usePartsCheck(kind: string) {
  const my = useMyCar()
  const [sheet, setSheet] = useState<{ go: () => void } | null>(null)

  const intercept = (e: React.MouseEvent, href: string) => {
    if (kind !== "gongim" || !my || !partsToBring(my).length) return
    try {
      if (sessionStorage.getItem(ASKED_KEY)) return
      sessionStorage.setItem(ASKED_KEY, "1")
    } catch {
      return
    }
    e.preventDefault()
    setSheet({ go: () => window.open(href, "_blank", "noopener") })
  }

  const node =
    sheet && my ? (
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label="부품 준비 확인" onClick={() => setSheet(null)}>
        <div className="w-full max-w-md rounded-t-2xl bg-background p-5 pb-[calc(20px+env(safe-area-inset-bottom))] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
          <p className="text-[18px] font-extrabold">부품은 준비하셨어요?</p>
          <p className="mt-1 text-[14px] text-muted-foreground">공임나라는 부품을 가져가면 공임만 받아요. {my.car.name}에 맞는 부품이에요.</p>
          <PartRows my={my} items={partsToBring(my)} />
          <p className="mt-2 text-[11px] text-muted-foreground">{AFFILIATE_TEXT}</p>
          <button
            onClick={() => {
              sheet.go()
              setSheet(null)
            }}
            className="mt-4 h-12 w-full rounded-[10px] border border-border bg-card text-[15px] font-semibold"
          >
            이미 있어요, 길찾기
          </button>
        </div>
      </div>
    ) : null

  return { intercept, node }
}

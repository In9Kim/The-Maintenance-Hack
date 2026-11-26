import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { SITE_URL } from "@/lib/seo"

type Crumb = { href?: string; label: string }

/** 화면의 경로 표시와 같은 내용을 구조화 데이터로 (검색 결과에 경로가 표시될 수 있음) */
export function breadcrumbJsonLd(items: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.label,
      // 마지막(현재 페이지)은 주소 생략 가능
      ...(it.href ? { item: `${SITE_URL}${it.href}` } : {}),
    })),
  }
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
    <JsonLd data={breadcrumbJsonLd(items)} />
    <nav aria-label="breadcrumb" className="mb-5 flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" />}
          {it.href ? (
            <Link href={it.href} className="hover:text-foreground hover:underline">
              {it.label}
            </Link>
          ) : (
            <span className="text-foreground">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
    </>
  )
}

/**
 * 제휴 링크 고지 (공정위 추천·보증 심사지침: 확정적 표현, 소비자가 쉽게 보는 위치)
 * 제휴 링크가 실제로 있는 화면에서, 그 링크 바로 위에 둔다.
 */
/** 쿠팡 파트너스 공식 대가성 문구 (쿠팡 링크 가까이에 둔다) */
export const AFFILIATE_TEXT = "이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."

export function AffiliateNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`rounded-[10px] bg-muted px-3 py-2 text-[13px] leading-relaxed text-muted-foreground ${className}`}>
      {AFFILIATE_TEXT}
    </p>
  )
}

/** 페이지 끝 안내: 가격·규격은 참고용 */
export function EstimateNote() {
  return (
    <p className="mt-10 border-t border-border pt-4 text-[13px] leading-relaxed text-muted-foreground">
      규격·가격·공임은 참고용 예상치예요. 구매 전 차대번호로 품번을 확인하세요.
    </p>
  )
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}


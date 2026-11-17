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
    <nav aria-label="breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
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

/** 쿠팡 파트너스 고지 문구 (파트너스 링크가 있는 페이지에 필수) */
export function PartnersDisclosure() {
  return (
    <p className="mt-10 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      <br />
      부품 규격·가격·공임은 참고용 예상치이며 연식·엔진·옵션에 따라 다를 수 있습니다. 구매 전 차량 등록증의
      차대번호로 부품 번호를 꼭 확인하세요.
    </p>
  )
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}

import Link from "next/link"
import { ChevronRight } from "lucide-react"

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
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

import Link from "next/link"
import type { CarModel } from "@/types"
import { fluidGuideFor, GUIDE_PAGES } from "@/lib/data/fluid-guides"

/** 정비 안내 페이지(주행거리별 목록·미션오일·냉각수) 사이 이동. 안내 데이터가 있는 차종만 */
export function GuideLinks({ car, current, className = "mt-12" }: { car: CarModel; current?: string; className?: string }) {
  if (!fluidGuideFor(car.id)) return null
  const pages = GUIDE_PAGES.filter((p) => p.slug !== current)
  return (
    <nav aria-label="정비 안내" className={className}>
      <h2 className="text-[18px] font-bold">정비 안내 더 보기</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {pages.map((p) => (
          <li key={p.slug}>
            <Link href={`/cars/${car.id}/${p.slug}`} className="block h-full rounded-[12px] border border-border bg-card px-4 py-3 transition hover:border-primary/50">
              <b className="block text-[15px]">{p.label}</b>
              <span className="text-[13px] text-muted-foreground">{p.sub}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

import { InfoTip } from "@/components/ui/InfoTip"
import Link from "next/link"
import { Breadcrumbs } from "@/components/seo/Shared"
import { NearMap } from "@/components/near/NearMap"
import { PartsBeforeVisit } from "@/components/near/PartsBeforeVisit"
import { NEAR_KINDS, type NearKind } from "@/lib/near"
import { MyCarCostLink } from "@/components/cars/MyCarShortcut"
import { seoCars } from "@/lib/seo"

const href = (k: NearKind) => (k.slug === "gongim" ? "/near" : `/near/${k.slug}`)

export function NearPage({ kind }: { kind: NearKind }) {
  return (
    <div className="mx-auto max-w-5xl px-5 pb-6 pt-6 sm:pt-10">
      <Breadcrumbs items={[{ href: "/", label: "정비핵" }, { label: "근처 정비소·세차장" }]} />
      <h1 className="flex items-center gap-2 text-[26px] font-extrabold leading-[1.3] sm:text-[34px]">
        근처 {kind.label} 찾기
        <InfoTip label={`${kind.label} 안내`} align="left">{kind.intro}</InfoTip>
      </h1>

      <nav aria-label="찾을 곳" className="-mx-5 mt-5 overflow-x-auto px-5">
        <ul className="flex gap-2">
          {NEAR_KINDS.map((k) => {
            const on = k.slug === kind.slug
            return (
              <li key={k.slug}>
                <Link
                  href={href(k)}
                  aria-current={on ? "page" : undefined}
                  className={`inline-flex min-h-[40px] items-center whitespace-nowrap rounded-full border px-4 text-[14px] font-semibold transition ${
                    on ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <span aria-hidden className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: k.color }} />
                  {k.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="mt-5">
        <PartsBeforeVisit kind={kind.slug} />
      </div>

      <div className="mt-5">
        <NearMap key={kind.slug} slug={kind.slug} />
      </div>

      {kind.slug !== "carwash" && (
        <div className="mt-10 rounded-2xl border border-border bg-card p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="font-bold">{kind.slug === "gongim" ? "맡기기 전에 부품값부터 확인하세요" : "공식센터 견적, 직접 구매하면 얼마일까요?"}</p>
            <p className="mt-1 text-[14px] text-muted-foreground">차종을 고르면 소모품 규격과 공식센터·직접 구매 비용을 나란히 보여 드려요.</p>
          </div>
          <MyCarCostLink
            ids={seoCars().map((c) => c.id)}
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[10px] bg-primary px-5 text-[15px] font-bold text-primary-foreground transition hover:brightness-110 active:translate-y-px sm:mt-0 sm:w-auto"
          >
            내 차 정비 비용 보기
          </MyCarCostLink>
        </div>
      )}
    </div>
  )
}

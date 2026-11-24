import { OutboundLink } from "@/components/seo/OutboundLink"
import { naverQueryOf, naverSearchUrl, OIL_TIERS_DATE, type OilTierRow } from "@/lib/coupang-links"

const TIER_STYLE = { oem: "bg-[#EFF4FF] text-[#1849A9]", value: "bg-[#ECFDF3] text-[#067647]", premium: "bg-[#FFF6ED] text-[#B54708]" } as const

/** 같은 규격 엔진오일 3가지 + 규격 체크 (점도·등급·용량) */
export function OilTiers({ rows, carId, partId }: { rows: OilTierRow[]; carId: string; partId: string }) {
  if (!rows.length) return null
  const date = OIL_TIERS_DATE ? OIL_TIERS_DATE.slice(5).replace("-", "/") : ""
  return (
    <div className="mt-4 rounded-[14px] border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-[15px] font-bold">오일만 따로 산다면: 같은 규격 3가지</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          점도·등급·용량을 이 차 규격과 맞춰 봤어요. 오일필터는 따로 필요해요. 가격은 {date} 쿠팡 기준이고 바뀔 수 있어요.
        </p>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.tier} className="px-4 py-3">
            <div className="flex items-start gap-3">
              {r.item.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.item.image} alt="" width={56} height={56} loading="lazy" className="h-14 w-14 shrink-0 rounded-lg bg-white object-contain ring-1 ring-border" />
              )}
              <div className="min-w-0 flex-1">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${TIER_STYLE[r.tier]}`}>{r.label}</span>
                <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug">{r.item.name}</p>
                <p className="num mt-0.5 text-[14px] font-bold">
                  {(r.item.price * r.count).toLocaleString("ko-KR")}원
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                    {r.count > 1 ? `${r.item.price.toLocaleString("ko-KR")}원 × ${r.count}개 · ` : ""}1L당 {Math.round(r.item.price / r.item.liters).toLocaleString("ko-KR")}원
                  </span>
                </p>
              </div>
            </div>
            <ul className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
              {r.checks.map((c) => (
                <li
                  key={c.label}
                  className={`rounded-md px-2 py-1 ${c.ok === true ? "bg-[#ECFDF3] text-[#067647]" : c.ok === false ? "bg-[#FEF3F2] text-[#B42318]" : "bg-muted text-muted-foreground"}`}
                >
                  {c.ok === true ? "✓" : c.ok === false ? "✕" : "?"} {c.label} {c.text}
                </li>
              ))}
            </ul>
            <div className="mt-1.5 flex flex-wrap gap-x-4">
              <OutboundLink href={r.item.url} target="coupang" carId={carId} partId={partId} sponsored className="inline-flex min-h-[36px] items-center text-[13px] font-semibold text-primary underline underline-offset-2">
                쿠팡에서 보기
              </OutboundLink>
              <OutboundLink href={naverSearchUrl(naverQueryOf(r.item.name))} target="naver" carId={carId} partId={partId} className="inline-flex min-h-[36px] items-center text-[13px] font-semibold text-[#027A48] underline underline-offset-2">
                네이버 같은 상품 가격
              </OutboundLink>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

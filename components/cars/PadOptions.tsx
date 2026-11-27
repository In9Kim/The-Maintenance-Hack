import { OutboundLink } from "@/components/seo/OutboundLink"
import type { PadOption } from "@/lib/coupang-links"
import { InfoTip } from "@/components/ui/InfoTip"

/** 브레이크 패드 상신 품번별 쿠팡 상품 (휠 크기·엔진·전자식 주차 브레이크에 따라 품번이 갈리는 차종) */
export function PadOptions({ rows, carId, partId }: { rows: PadOption[]; carId: string; partId: string }) {
  if (rows.length < 2) return null
  const date = rows.find((r) => r.pick)?.pick?.checkedAt.slice(5).replace("-", "/") ?? ""
  return (
    <div className="mt-4 rounded-[14px] border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="flex items-center gap-1.5 text-[15px] font-bold">
          내 차 조건의 품번으로 고르세요
          <InfoTip label="패드 고르는 법" align="left">
            조건에 따라 패드 품번이 {rows.length}가지예요. 휠 크기는 타이어 옆면(예: 225/45R17의 17), 전자식 주차 브레이크(EPB)는 운전석 옆 P 버튼으로 알 수 있어요.{date && ` 가격은 ${date} 쿠팡 기준.`} 출처: 상신브레이크 공용차종표(2025년 4월판). 품번이 같으면 상품명에 다른 차 이름이 있어도 같은 패드예요.
          </InfoTip>
        </p>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.sp + r.label} className="px-4 py-3">
            <p className="text-[15px] font-bold">
              {r.label || "전 차량"} <span className="num text-[12px] font-normal text-muted-foreground">상신 {r.sp}</span>
            </p>
            {r.pick ? (
              <OutboundLink href={r.pick.url} target="coupang" carId={carId} partId={partId} sponsored className="mt-2 flex items-center gap-3 rounded-[10px] border border-border p-2.5">
                {r.pick.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.pick.image} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-md bg-white object-contain ring-1 ring-border" />
                )}
                <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug">{r.pick.name}</span>
                <span className="num shrink-0 text-[14px] font-bold">{r.pick.price.toLocaleString("ko-KR")}원</span>
              </OutboundLink>
            ) : (
              <p className="mt-1.5 text-[13px] text-muted-foreground">쿠팡에서 이 품번이 적힌 상신 정품을 아직 못 찾았어요. 품번으로 직접 검색해 보세요.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

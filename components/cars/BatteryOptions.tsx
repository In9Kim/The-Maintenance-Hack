import { OutboundLink } from "@/components/seo/OutboundLink"
import type { BatteryOption } from "@/lib/coupang-links"

/** 배터리 라벨 규격별 쿠팡 상품 (같은 차종도 트림마다 규격이 달라서 라벨을 보고 고르게) */
export function BatteryOptions({ rows, carId, partId }: { rows: BatteryOption[]; carId: string; partId: string }) {
  if (!rows.length) return null
  const date = rows.find((r) => r.pick)?.pick?.checkedAt.slice(5).replace("-", "/") ?? ""
  return (
    <div className="mt-4 rounded-[14px] border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-[15px] font-bold">내 배터리 라벨에 적힌 규격으로 고르세요</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
          이 차종은 트림·연식에 따라 규격이 {rows.length > 1 ? `${rows.length}가지예요` : "이거예요"}. 보닛을 열면 배터리 위 라벨에 적혀 있어요. AGM이 달린 차는 AGM으로 바꿔야 해요.
          {date && ` 가격은 ${date} 쿠팡 기준이에요.`}
        </p>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.code} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[15px] font-bold">
                {r.name} <span className="text-[12px] font-normal text-muted-foreground">{r.type} · {r.ah}Ah</span>
              </p>
              <span className="shrink-0 text-[12px] text-muted-foreground">적합표의 {Math.round(r.share * 100)}%</span>
            </div>
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
              <p className="mt-1.5 text-[13px] text-muted-foreground">쿠팡에서 이 규격만 정확히 적힌 상품을 아직 못 찾았어요.</p>
            )}
          </li>
        ))}
      </ul>
      <p className="border-t border-border px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        출처: 한국앤컴퍼니(아트라스BX) 배터리 적합표. 교체용 적합표라 출고 때 달린 배터리와 다를 수 있어요. 폐배터리 반납 조건이 붙은 상품이 많으니 공임나라에 폐배터리 처리도 같이 물어보세요.
      </p>
    </div>
  )
}

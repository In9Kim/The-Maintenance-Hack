import Link from "next/link"
import { CarThumb, PhotoCredits } from "@/components/cars/CarPhoto"
import { carPhoto } from "@/lib/car-photos"
import { carTotals, seoCars } from "@/lib/seo"
import { monthText, salesCarId, salesRanking, type SalesRow } from "@/lib/sales-ranking"

const n = (v: number) => v.toLocaleString("ko-KR")

function Change({ row }: { row: SalesRow }) {
  if (!row.prevSales) return null
  const pct = Math.round(((row.sales - row.prevSales) / row.prevSales) * 100)
  if (pct === 0) return <span className="text-muted-foreground">전달과 같음</span>
  const up = pct > 0
  return (
    <span className={up ? "text-[#B42318]" : "text-[#175CD3]"} title={`지난달 ${n(row.prevSales)}대`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  )
}

/** 홈 "이번 달 많이 팔린 차" (국산 10위 카드 + 수입 10위 목록) */
export function SalesRanking() {
  const data = salesRanking()
  const cars = seoCars()
  const top = data.domestic.slice(0, 10)
  const credits = top.flatMap((r) => {
    const id = salesCarId(r)
    const photo = id ? carPhoto(id) : undefined
    return photo ? [{ name: r.model, photo }] : []
  })

  return (
    <div>
      <ol className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
        {top.map((r) => {
          const id = salesCarId(r)
          const car = id ? cars.find((c) => c.id === id) : undefined
          const photo = id ? carPhoto(id) : undefined
          const t = car ? carTotals(car) : null
          const body = (
            <>
              <div className="relative">
                {photo ? (
                  <CarThumb photo={photo} alt={`${r.maker} ${r.model}`} />
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center bg-muted text-[22px] font-extrabold text-muted-foreground">{r.model}</div>
                )}
                <span
                  className={`num absolute left-2 top-2 flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[15px] font-extrabold shadow ${
                    r.rank <= 3 ? "bg-foreground text-background" : "bg-card text-foreground"
                  }`}
                >
                  {r.rank}
                </span>
              </div>
              <div className="p-3 sm:p-3.5">
                <p className="text-[12px] text-muted-foreground">{r.maker}</p>
                <p className="font-bold leading-snug">{r.model}</p>
                <p className="num mt-1 text-[13px]">
                  <b>{n(r.sales)}대</b> <span className="ml-1 text-[12px]"><Change row={r} /></span>
                </p>
                {t ? (
                  <p className="num mt-2 border-t border-border pt-2 text-[12px] text-muted-foreground">
                    소모품 전체 <b className="text-[13px] text-primary">{n(t.self)}원</b>
                  </p>
                ) : (
                  <p className="mt-2 border-t border-border pt-2 text-[12px] text-muted-foreground">정비 정보 준비 중</p>
                )}
              </div>
            </>
          )
          return (
            <li key={r.rank}>
              {car ? (
                <Link
                  href={`/cars/${car.id}`}
                  className="group block h-full overflow-hidden rounded-[14px] border border-border bg-background transition hover:-translate-y-0.5 hover:border-primary/40"
                >
                  {body}
                </Link>
              ) : (
                <div className="h-full overflow-hidden rounded-[14px] border border-dashed border-border bg-background">{body}</div>
              )}
            </li>
          )
        })}
      </ol>

      <details className="group mt-4 rounded-[14px] border border-border bg-background">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between px-4 font-semibold [&::-webkit-details-marker]:hidden">
          수입차 TOP 10 <span aria-hidden className="text-muted-foreground transition group-open:rotate-180">⌄</span>
        </summary>
        <ol className="divide-y divide-border border-t border-border">
          {data.import.slice(0, 10).map((r) => (
            <li key={r.rank} className="flex items-center gap-3 px-4 py-2.5 text-[14px]">
              <span className="num w-5 shrink-0 text-center font-bold">{r.rank}</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="text-muted-foreground">{r.maker}</span> {r.model}
              </span>
              <span className="num shrink-0 font-semibold">{n(r.sales)}대</span>
            </li>
          ))}
        </ol>
        <p className="border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground">수입자동차협회는 트림(세부 모델) 단위로 집계해요.</p>
      </details>

      <details className="mt-3 text-[12px] text-muted-foreground">
        <summary className="min-h-[40px] cursor-pointer content-center">
          기준: {monthText(data.month)} 국내 판매(내수), 각 사·수입자동차협회 발표 · 출처 보기
        </summary>
        <ul className="space-y-1 pb-2">
          {data.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener nofollow" className="underline underline-offset-2">
                {s.title}
              </a>
            </li>
          ))}
          <li>증감은 지난달({monthText(data.prevMonth)}) 판매량과 비교한 값이에요. 일부 차종은 지난달 수치가 보도되지 않아 표시하지 않았어요.</li>
        </ul>
      </details>
      <PhotoCredits items={credits} />
    </div>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { pageMetadata, seoCars, carShortName } from "@/lib/seo"
import { splitCritical, MAJOR_MAKERS } from "@/lib/recalls/highlight"
import { Breadcrumbs, JsonLd } from "@/components/seo/Shared"
import { MyCarRecall } from "@/components/recalls/MyCarRecall"
import { carRecallAlerts } from "@/lib/recalls/car-alert"
import {
  MajorRecallList,
  RecallEmpty,
  RecallFaq,
  RecallSource,
  faqJsonLd,
  recallFaq,
} from "@/components/recalls/RecallParts"
import {
  dataBasisText,
  allRecalls,
  majorRecalls,
  recallData,
  recallMakers,
  recallsForCar,
  type RecallMaker,
} from "@/lib/recalls/data"

export function generateMetadata(): Metadata {
  const { dataAsOf } = recallData()
  const total = allRecalls().length
  return pageMetadata({
    title: "자동차 리콜 정보 · 리콜 대상 조회 (제작사별 최근 리콜 목록) | 정비핵",
    description: `현대·기아·테슬라·BMW 등 최근 주요 자동차 리콜과 제작사별 리콜 ${total ? `${total}건` : ""}을 리콜 사유와 생산기간으로 정리했습니다${
      dataAsOf ? ` (${dataBasisText()})` : ""
    }. 내 차 리콜 대상 여부는 자동차리콜센터에서 차대번호로 조회하세요.`,
    path: "/recalls",
  })
}

const CHIP =
  "inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[14px] hover:border-input hover:bg-muted"

function MakerChips({ makers }: { makers: RecallMaker[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {makers.map((m) => (
        <li key={m.slug}>
          <Link href={`/recalls/maker/${m.slug}`} className={CHIP}>
            {m.name} <span className="num text-[13px] text-muted-foreground">{m.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

const H2 = "text-[20px] font-bold sm:text-[24px]"
const SUMMARY =
  "flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-[14px] font-semibold text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden"
const CRITICAL_VISIBLE = 5
const DOMESTIC = ["hyundai", "kia", "genesis", "kg-mobility", "gm-korea", "renault-korea"]

export default function RecallsPage() {
  const { groups } = majorRecalls(30)
  const critical = splitCritical(groups).critical.slice(0, CRITICAL_VISIBLE)
  // 주요 승용 브랜드만 (국산 먼저). 이륜차·트럭·소형 수입사는 제작사 페이지 주소로만 남김
  const makers = recallMakers()
    .filter((m) => MAJOR_MAKERS.has(m.slug) && m.slug !== "fl-auto")
    .sort((x, y) => Number(DOMESTIC.includes(y.slug)) - Number(DOMESTIC.includes(x.slug)) || y.count - x.count)
  const carLinks = seoCars()
    .map((car) => ({ car, count: recallsForCar(car.id).length }))
    .filter((c) => c.count > 0)
  const faq = recallFaq()

  return (
    <div className="mx-auto max-w-3xl px-5 pb-6 pt-6 sm:pt-10">
      <Breadcrumbs items={[{ href: "/", label: "정비핵" }, { label: "자동차 리콜 정보" }]} />

      <h1 className="text-[26px] font-extrabold leading-[1.3] sm:text-[34px]">자동차 리콜 정보</h1>

      {carLinks.length > 0 && (
        <section className="mt-6 max-w-xl" aria-label="내 차 리콜">
          <MyCarRecall
            cars={carLinks.map(({ car, count }) => ({ id: car.id, brand: car.brand, label: `${carShortName(car)} · 리콜 ${count}건` }))}
            alerts={carRecallAlerts()}
          />
        </section>
      )}

      <section className="mt-10" aria-labelledby="major">
        <h2 id="major" className={H2}>꼭 확인할 리콜</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">최근 90일 · 화재·제동·조향·에어백</p>
        <div className="mt-4">
          {critical.length ? <MajorRecallList groups={critical} /> : <RecallEmpty>최근 90일 동안 안전 직결 리콜이 없어요.</RecallEmpty>}
        </div>
      </section>

      {makers.length > 0 && (
        <section className="mt-10" aria-labelledby="by-maker">
          <h2 id="by-maker" className={H2}>브랜드별 리콜</h2>
          <div className="mt-4">
            <MakerChips makers={makers} />
          </div>
        </section>
      )}

      <RecallFaq items={faq} />
      <RecallSource />
      <JsonLd data={faqJsonLd(faq)} />
    </div>
  )
}

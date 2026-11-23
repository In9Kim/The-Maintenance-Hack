import type { Metadata } from "next"
import Link from "next/link"
import { pageMetadata, seoCars, carShortName } from "@/lib/seo"
import { isIndexableMaker } from "@/lib/indexing"
import { splitCritical } from "@/lib/recalls/highlight"
import { Breadcrumbs, JsonLd } from "@/components/seo/Shared"
import { CarPicker } from "@/components/home/CarPicker"
import {
  MajorRecallList,
  RecallEmpty,
  RecallFaq,
  RecallNewsList,
  RecallNotice,
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
  recallNews,
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
/** 휴대폰에서 한 화면 남짓만 보이게 나머지는 접어 둔다 (링크는 HTML에 그대로 있어 검색 수집에 영향 없음) */
const CRITICAL_VISIBLE = 5
const MAKERS_VISIBLE = 12

export default function RecallsPage() {
  const { groups } = majorRecalls(30)
  const { critical, other } = splitCritical(groups)
  const criticalShown = critical.slice(0, CRITICAL_VISIBLE)
  const folded = [...critical.slice(CRITICAL_VISIBLE), ...other]
  const makers = recallMakers()
  // 리콜이 많고 이름 주소가 있는 제작사만 바로 보이게, 나머지(이륜차·소형 수입사 등)는 접어 둔다
  const shownMakers = makers.filter(isIndexableMaker).slice(0, MAKERS_VISIBLE)
  const moreMakers = makers.filter((m) => !shownMakers.includes(m))
  const total = allRecalls().length
  const carLinks = seoCars()
    .map((car) => ({ car, count: recallsForCar(car.id).length }))
    .filter((c) => c.count > 0)
  const faq = recallFaq()
  const news = recallNews(3)

  return (
    <div className="mx-auto max-w-5xl px-5 pb-6 pt-6 sm:pt-10">
      <Breadcrumbs items={[{ href: "/", label: "정비핵" }, { label: "자동차 리콜 정보" }]} />

      <h1 className="text-[28px] font-extrabold leading-[1.3] sm:text-[36px]">자동차 리콜 정보</h1>
      <p className="mt-2 max-w-2xl text-[16px] leading-relaxed text-muted-foreground">
        많이 타는 브랜드의 굵직한 리콜만 골라 정리했어요.
        {total > 0 && ` 전체 ${total.toLocaleString("ko-KR")}건은 제작사별 페이지에서 볼 수 있어요.`}
      </p>

      <RecallNotice />

      {carLinks.length > 0 && (
        <section className="mt-12" aria-labelledby="by-car">
          <h2 id="by-car" className={H2}>내 차 리콜 보기</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">차종마다 생산기간이 맞는 리콜만 모아 두었어요.</p>
          <div className="mt-4 max-w-xl">
            <CarPicker
              cars={carLinks.map(({ car, count }) => ({ id: car.id, brand: car.brand, label: `${carShortName(car)} · 리콜 ${count}건` }))}
              path="/recalls"
              via="recalls_picker"
              cta="리콜 목록 보기"
              hint="차종을 고르면 리콜을 보여드려요"
            />
          </div>
          <details className="group mt-2">
            <summary className={SUMMARY}>
              차종 {carLinks.length}개 한눈에 보기 <span aria-hidden className="transition group-open:rotate-180">⌄</span>
            </summary>
            <ul className="flex flex-wrap gap-2 pt-1">
              {carLinks.map(({ car, count }) => (
                <li key={car.id}>
                  <Link href={`/cars/${car.id}/recalls`} className={CHIP}>
                    {carShortName(car)} <span className="num text-[13px] font-semibold text-[#B54708]">{count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      <section className="mt-12" aria-labelledby="major">
        <h2 id="major" className={H2}>꼭 확인할 리콜</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          최근 90일, 국산·인기 수입 브랜드의 화재·제동·조향·에어백처럼 사고로 이어질 수 있는 결함만 골랐어요. 누르면 사유가 펼쳐져요.
        </p>
        <div className="mt-4">
          {criticalShown.length ? (
            <MajorRecallList groups={criticalShown} />
          ) : (
            <RecallEmpty>최근 90일 동안 안전 직결 리콜이 없어요. 아래에서 그 밖의 리콜을 확인하세요.</RecallEmpty>
          )}
          {folded.length > 0 && (
            <details className="group mt-2">
              <summary className={SUMMARY}>
                그 밖의 최근 리콜 {folded.length}건 (소프트웨어·표시·부품 결함 등)
                <span aria-hidden className="transition group-open:rotate-180">⌄</span>
              </summary>
              <div className="pt-1">
                <MajorRecallList groups={folded} />
              </div>
            </details>
          )}
        </div>
      </section>

      {makers.length > 0 && (
        <section className="mt-12" aria-labelledby="by-maker">
          <h2 id="by-maker" className={H2}>제작사별 전체 리콜</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">오래된 리콜까지 전부 보려면 제작사를 고르세요.</p>
          <div className="mt-4">
            <MakerChips makers={shownMakers} />
          </div>
          {moreMakers.length > 0 && (
            <details className="group mt-2">
              <summary className={SUMMARY}>
                제작사 {moreMakers.length}곳 더 보기 (이륜차·소형 수입사 포함)
                <span aria-hidden className="transition group-open:rotate-180">⌄</span>
              </summary>
              <div className="pt-1">
                <MakerChips makers={moreMakers} />
              </div>
            </details>
          )}
        </section>
      )}

      {news.length > 0 && (
        <details className="group mt-12" aria-labelledby="news">
          <summary className={SUMMARY}>
            <span id="news">국토교통부 리콜 보도자료 {news.length}건</span>
            <span aria-hidden className="transition group-open:rotate-180">⌄</span>
          </summary>
          <div className="pt-2">
            <RecallNewsList items={news} />
          </div>
        </details>
      )}

      <RecallFaq items={faq} />
      <RecallSource />
      <JsonLd data={faqJsonLd(faq)} />
    </div>
  )
}

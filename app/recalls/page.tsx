import type { Metadata } from "next"
import Link from "next/link"
import { pageMetadata, seoCars, carShortName } from "@/lib/seo"
import { isIndexableMaker } from "@/lib/indexing"
import { MIN_MAJOR_COUNT } from "@/lib/recalls/highlight"
import { Breadcrumbs, JsonLd } from "@/components/seo/Shared"
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

function MakerChips({ makers }: { makers: RecallMaker[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {makers.map((m) => (
        <li key={m.slug}>
          <Link
            href={`/recalls/maker/${m.slug}`}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:border-primary/50 hover:text-primary"
          >
            {m.name} <span className="text-muted-foreground">{m.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function RecallsPage() {
  const { groups, total: majorTotal } = majorRecalls()
  const makers = recallMakers()
  // 리콜이 많고 이름 주소가 있는 제작사만 바로 보이게, 나머지(이륜차·소형 수입사 등)는 접어 둔다
  const mainMakers = makers.filter(isIndexableMaker)
  const otherMakers = makers.filter((m) => !isIndexableMaker(m))
  const total = allRecalls().length
  const carLinks = seoCars()
    .map((car) => ({ car, count: recallsForCar(car.id).length }))
    .filter((c) => c.count > 0)
  const faq = recallFaq()
  const news = recallNews(3)

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs items={[{ href: "/", label: "정비핵" }, { label: "자동차 리콜 정보" }]} />

      <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl">자동차 리콜 정보</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        많이 타는 브랜드의 굵직한 리콜만 골라 보여 드립니다.
        {total > 0 && ` 전체 ${total.toLocaleString("ko-KR")}건은 아래 제작사별 페이지에서 볼 수 있습니다.`}
      </p>

      <RecallNotice />

      <section className="mb-10">
        <h2 className="mb-1 text-lg font-bold">최근 주요 리콜</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          최근 90일 · 중대리콜, 대상 {MIN_MAJOR_COUNT.toLocaleString("ko-KR")}대 이상, 화재·제동·조향 같은 안전 결함
          {majorTotal > 0 && ` · ${majorTotal}건`} · 누르면 자세히 보기
        </p>
        {groups.length ? (
          <MajorRecallList groups={groups} />
        ) : (
          <RecallEmpty>최근 90일 동안 주요 리콜이 없습니다. 제작사별 페이지에서 전체 리콜을 확인하세요.</RecallEmpty>
        )}
      </section>

      {carLinks.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-bold">차종별 리콜</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {carLinks.map(({ car, count }) => (
              <li key={car.id}>
                <Link
                  href={`/cars/${car.id}/recalls`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-primary/50"
                >
                  <span className="font-medium">{carShortName(car)} 리콜</span>
                  <span className="text-primary">{count}건 →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {makers.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-bold">제작사별 전체 리콜</h2>
          <MakerChips makers={mainMakers} />
          {otherMakers.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
                그 밖의 제작사 {otherMakers.length}곳 (이륜차·소형 수입사 등)
              </summary>
              <div className="mt-3">
                <MakerChips makers={otherMakers} />
              </div>
            </details>
          )}
        </section>
      )}

      {news.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-1 text-lg font-bold">국토교통부 리콜 보도자료</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            여러 제작사 리콜을 모아 몇 주~몇 달에 한 번 발표하는 보도자료입니다.
          </p>
          <RecallNewsList items={news} />
        </section>
      )}

      <RecallFaq items={faq} />
      <RecallSource />
      <JsonLd data={faqJsonLd(faq)} />
    </div>
  )
}

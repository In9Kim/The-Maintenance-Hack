import type { Metadata } from "next"
import Link from "next/link"
import { SITE_URL, seoCars, carShortName } from "@/lib/seo"
import { Breadcrumbs, JsonLd } from "@/components/seo/Shared"
import {
  RecallEmpty,
  RecallFaq,
  RecallList,
  RecallNewsList,
  LatestRecallList,
  RecallNotice,
  RecallSource,
  faqJsonLd,
  recallFaq,
} from "@/components/recalls/RecallParts"
import {
  dataBasisText,
  allRecalls,
  fmtDate,
  latestCenterRecalls,
  recallData,
  recallMakers,
  recallNews,
  recallsForCar,
  recentRecalls,
} from "@/lib/recalls/data"

export function generateMetadata(): Metadata {
  const { dataAsOf } = recallData()
  const total = allRecalls().length
  return {
    title: "자동차 리콜 정보 · 리콜 대상 조회 (제작사별 최근 리콜 목록) | 정비핵",
    description: `현대·기아·테슬라·BMW 등 제작사별 최근 자동차 리콜 ${total ? `${total}건` : ""}을 리콜 사유와 생산기간으로 정리했습니다${
      dataAsOf ? ` (${dataBasisText()})` : ""
    }. 내 차 리콜 대상 여부는 자동차리콜센터에서 차대번호로 조회하세요.`,
    alternates: { canonical: `${SITE_URL}/recalls` },
  }
}

export default function RecallsPage() {
  const recalls = recentRecalls()
  const makers = recallMakers()
  const total = allRecalls().length
  const carLinks = seoCars()
    .map((car) => ({ car, count: recallsForCar(car.id).length }))
    .filter((c) => c.count > 0)
  const faq = recallFaq()
  const news = recallNews(3)
  const latest = latestCenterRecalls(6)

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs items={[{ href: "/", label: "정비핵" }, { label: "자동차 리콜 정보" }]} />

      <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl">자동차 리콜 정보</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        최근 시작된 자동차 리콜을 제작사·차명·리콜 사유·생산기간으로 정리했습니다.
        {total > 0 && ` 전체 ${total.toLocaleString("ko-KR")}건 중 최근 ${recalls.length}건을 보여드립니다.`}
      </p>

      <RecallNotice />

      {latest.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 text-lg font-bold">최근 시작된 리콜</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            국토교통부 자동차리콜센터에 리콜이 시작될 때마다 올라오는 내용을 하루 두 번 확인해 정리합니다.
          </p>
          <LatestRecallList recalls={latest} />
        </section>
      )}

      {makers.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">제작사별 리콜</h2>
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
        </section>
      )}

      {carLinks.length > 0 && (
        <section className="mb-8">
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

      <section>
        <h2 className="mb-3 text-lg font-bold">최근 리콜</h2>
        {recalls.length ? (
          <RecallList recalls={recalls} />
        ) : (
          <RecallEmpty>리콜 데이터를 준비하고 있습니다. 그동안 자동차리콜센터에서 직접 조회해 주세요.</RecallEmpty>
        )}
      </section>

      {news.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-1 text-lg font-bold">국토교통부 리콜 보도자료</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            여러 제작사 리콜을 모아 몇 주~몇 달에 한 번 발표하는 보도자료입니다. 최신 리콜은 위 목록을 확인하세요.
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

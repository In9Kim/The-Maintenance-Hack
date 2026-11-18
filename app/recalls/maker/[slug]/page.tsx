import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { pageMetadata } from "@/lib/seo"
import { isIndexableMaker } from "@/lib/indexing"
import { Breadcrumbs, JsonLd } from "@/components/seo/Shared"
import {
  RecallFaq,
  RecallList,
  RecallNotice,
  RecallSource,
  faqJsonLd,
  recallFaq,
} from "@/components/recalls/RecallParts"
import { dataBasisText, fmtDate, recallData, recallMakers, recallsByMaker } from "@/lib/recalls/data"

export const dynamicParams = false

export function generateStaticParams() {
  return recallMakers().map((m) => ({ slug: m.slug }))
}

type Props = { params: Promise<{ slug: string }> }

function findMaker(slug: string) {
  return recallMakers().find((m) => m.slug === slug)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const maker = findMaker((await params).slug)
  if (!maker) return {}
  const { dataAsOf } = recallData()
  const latest = recallsByMaker(maker.slug)[0]
  return pageMetadata({
    title: `${maker.name} 리콜 정보 · 리콜 대상 조회 (${maker.count}건) | 정비핵`,
    description: `${maker.name} 자동차 리콜 ${maker.count}건을 차명·리콜 사유·생산기간별로 정리했습니다${
      latest ? `. 최근 리콜 시작일 ${fmtDate(latest.startDate)}` : ""
    }${dataAsOf ? ` (${dataBasisText()})` : ""}. 내 차 대상 여부는 자동차리콜센터에서 차대번호로 확인하세요.`,
    path: `/recalls/maker/${maker.slug}`,
    // 리콜이 적거나 이름 주소가 없는 제작사는 얇은 페이지라 색인하지 않음 (링크는 따라가도록 follow)
    robots: isIndexableMaker(maker) ? undefined : { index: false, follow: true },
  })
}

export default async function MakerRecallsPage({ params }: Props) {
  const maker = findMaker((await params).slug)
  if (!maker) notFound()
  const recalls = recallsByMaker(maker.slug)
  const faq = recallFaq(`${maker.name} 차`)

  return (
    <div className="mx-auto max-w-5xl px-5 pb-6 pt-6 sm:pt-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "정비핵" },
          { href: "/recalls", label: "자동차 리콜 정보" },
          { label: `${maker.name} 리콜` },
        ]}
      />

      <h1 className="text-[28px] font-extrabold leading-[1.3] sm:text-[36px]">{maker.name} 리콜 정보</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
        {maker.name} 자동차 리콜 <b className="num text-foreground">{maker.count}건</b>을 최근 시작일 순으로 정리했어요.{" "}
        <Link href="/recalls" className="font-semibold text-foreground underline underline-offset-2">
          다른 제작사 보기
        </Link>
      </p>

      <RecallNotice />
      <section className="mt-10" aria-label={`${maker.name} 리콜 목록`}>
        <RecallList recalls={recalls} showMaker={false} />
      </section>
      <RecallFaq items={faq} />
      <RecallSource />
      <JsonLd data={faqJsonLd(faq)} />
    </div>
  )
}

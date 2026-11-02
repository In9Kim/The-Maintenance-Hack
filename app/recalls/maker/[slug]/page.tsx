import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SITE_URL } from "@/lib/seo"
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
  return {
    title: `${maker.name} 리콜 정보 · 리콜 대상 조회 (${maker.count}건) | 정비핵`,
    description: `${maker.name} 자동차 리콜 ${maker.count}건을 차명·리콜 사유·생산기간별로 정리했습니다${
      latest ? `. 최근 리콜 시작일 ${fmtDate(latest.startDate)}` : ""
    }${dataAsOf ? ` (${dataBasisText()})` : ""}. 내 차 대상 여부는 자동차리콜센터에서 차대번호로 확인하세요.`,
    alternates: { canonical: `${SITE_URL}/recalls/maker/${maker.slug}` },
  }
}

export default async function MakerRecallsPage({ params }: Props) {
  const maker = findMaker((await params).slug)
  if (!maker) notFound()
  const recalls = recallsByMaker(maker.slug)
  const faq = recallFaq(`${maker.name} 차`)

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "정비핵" },
          { href: "/recalls", label: "자동차 리콜 정보" },
          { label: `${maker.name} 리콜` },
        ]}
      />

      <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{maker.name} 리콜 정보</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {maker.name}의 자동차 리콜 {maker.count}건을 최근 시작일 순으로 정리했습니다.{" "}
        <Link href="/recalls" className="text-primary hover:underline">
          다른 제작사 보기
        </Link>
      </p>

      <RecallNotice />
      <RecallList recalls={recalls} showMaker={false} />
      <RecallFaq items={faq} />
      <RecallSource />
      <JsonLd data={faqJsonLd(faq)} />
    </div>
  )
}

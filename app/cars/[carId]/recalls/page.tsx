import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { seoCars, getSeoCar, carShortName, SITE_URL } from "@/lib/seo"
import { Breadcrumbs, JsonLd } from "@/components/seo/Shared"
import {
  RecallEmpty,
  RecallFaq,
  RecallList,
  RecallNotice,
  RecallSource,
  faqJsonLd,
  recallFaq,
} from "@/components/recalls/RecallParts"
import { fmtDate, recallData, recallsForCar, shortReason } from "@/lib/recalls/data"

export const dynamicParams = false

export function generateStaticParams() {
  return seoCars().map((car) => ({ carId: car.id }))
}

type Props = { params: Promise<{ carId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const car = getSeoCar((await params).carId)
  if (!car) return {}
  const name = carShortName(car)
  const recalls = recallsForCar(car.id)
  const { dataAsOf } = recallData()
  const latest = recalls[0]
  return {
    title: `${name} 리콜 대상 조회 · 리콜 ${recalls.length}건 정리 | 정비핵`,
    description: latest
      ? `${name} 리콜 ${recalls.length}건 정리. 최근 리콜(${fmtDate(latest.startDate)}): ${shortReason(latest.reason, 50)} 생산기간별 대상과 차대번호 조회 방법을 안내합니다.`
      : `${name} 리콜 정보와 리콜 대상 조회 방법${dataAsOf ? ` (기준일 ${fmtDate(dataAsOf)})` : ""}. 내 차가 대상인지 자동차리콜센터에서 차대번호로 확인하세요.`,
    alternates: { canonical: `${SITE_URL}/cars/${car.id}/recalls` },
  }
}

export default async function CarRecallsPage({ params }: Props) {
  const car = getSeoCar((await params).carId)
  if (!car) notFound()
  const name = carShortName(car)
  const recalls = recallsForCar(car.id)
  const { dataAsOf } = recallData()
  const faq = recallFaq(name)

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "정비핵" },
          { href: "/cars", label: "차종별 정비 비용" },
          { href: `/cars/${car.id}`, label: name },
          { label: "리콜" },
        ]}
      />

      <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{name} 리콜 정보</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {car.generation} · {car.yearRange} 생산 차량에 해당하는 리콜 {recalls.length}건
      </p>

      <RecallNotice carId={car.id} />

      {recalls.length ? (
        <RecallList recalls={recalls} />
      ) : (
        <RecallEmpty>
          {dataAsOf
            ? `기준일(${fmtDate(dataAsOf)})까지 공개된 데이터에서 ${name}에 해당한다고 확실히 확인된 리콜이 없습니다.`
            : "리콜 데이터를 준비하고 있습니다."}{" "}
          차명 표기가 애매한 리콜은{" "}
          <Link href="/recalls" className="text-primary hover:underline">
            전체 리콜 목록
          </Link>
          에만 올려 두었으니 함께 확인해 주세요.
        </RecallEmpty>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        차명의 세대 표기와 생산기간이 이 차종과 확실히 일치하는 리콜만 모았습니다. 하이브리드 등 같은 세대의 다른
        파워트레인 리콜도 포함됩니다.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/cars/${car.id}`}
          className="inline-flex rounded-lg border border-primary/50 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
        >
          {name} 소모품 교체 비용 보기 →
        </Link>
        <Link
          href="/recalls"
          className="inline-flex rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-accent"
        >
          전체 리콜 목록
        </Link>
      </div>

      <RecallFaq items={faq} />
      <RecallSource />
      <JsonLd data={faqJsonLd(faq)} />
    </div>
  )
}

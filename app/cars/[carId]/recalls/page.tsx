import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { seoCars, getSeoCar, carShortName, partCost, SITE_URL } from "@/lib/seo"
import { formatPrice } from "@/lib/utils"
import { engineGroups } from "@/lib/engines"
import { TrackedLink } from "@/components/seo/TrackedLink"
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
import { dataBasisText, fmtDate, recallData, recallsForCar, shortReason } from "@/lib/recalls/data"

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
      : `${name} 리콜 정보와 리콜 대상 조회 방법${dataAsOf ? ` (${dataBasisText()})` : ""}. 내 차가 대상인지 자동차리콜센터에서 차대번호로 확인하세요.`,
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
  // 차종 페이지와 같은 계산: 공식센터(부품+공임) − 쿠팡 부품+공임나라, 전체 소모품 합계
  // 엔진이 나뉜 차종은 첫 엔진 기준 (차종 페이지 위 합계와 같은 값)
  const totals = engineGroups(car)[0].parts.reduce(
    (acc, p) => {
      const c = partCost(p)
      return { self: acc.self + c.self, dealer: acc.dealer + c.dealer }
    },
    { self: 0, dealer: 0 }
  )
  const savings = Math.max(totals.dealer - totals.self, 0)

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
            ? `${dataBasisText()} 데이터에서 ${name}에 해당한다고 확실히 확인된 리콜이 없습니다.`
            : "리콜 데이터를 준비하고 있습니다."}{" "}
          차명 표기가 애매한 리콜은{" "}
          <Link href="/recalls" className="text-primary hover:underline">
            전체 리콜 목록
          </Link>
          에만 올려 두었으니 함께 확인해 주세요.
        </RecallEmpty>
      )}

      {/* 리콜로 정비소에 가는 김에 소모품도 — 차종 소모품 비용 페이지로 연결 */}
      <TrackedLink
        href={`/cars/${car.id}`}
        carId={car.id}
        label="recall_to_cost"
        className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-primary/40 bg-primary/10 p-4 transition-colors hover:bg-primary/15"
      >
        <div>
          <div className="text-sm font-bold">{name} 소모품 교체 비용 보기</div>
          <div className="mt-1 text-xs text-muted-foreground">
            리콜 수리 받으러 가는 김에 엔진오일·필터도 함께 점검해 보세요
          </div>
        </div>
        <div className="shrink-0 text-right">
          {savings > 0 && (
            <div className="text-xs text-muted-foreground">
              공식센터 대비 <b className="text-primary">{formatPrice(savings)}</b> 절약
            </div>
          )}
          <div className="text-sm font-semibold text-primary">보러 가기 →</div>
        </div>
      </TrackedLink>

      <p className="mt-4 text-xs text-muted-foreground">
        차명의 세대 표기와 생산기간이 이 차종과 확실히 일치하는 리콜만 모았습니다. 하이브리드 등 같은 세대의 다른
        파워트레인 리콜도 포함됩니다.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
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

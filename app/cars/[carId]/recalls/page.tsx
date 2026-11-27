import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { seoCars, getSeoCar, carShortName, partCost, pageMetadata } from "@/lib/seo"
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
  return pageMetadata({
    title: `${name} 리콜 대상 조회 · 리콜 ${recalls.length}건 정리 | 정비핵`,
    description: latest
      ? `${name} 리콜 ${recalls.length}건 정리. 최근 리콜(${fmtDate(latest.startDate)}): ${shortReason(latest.reason, 50)} 생산기간별 대상과 차대번호 조회 방법을 안내합니다.`
      : `${name} 리콜 정보와 리콜 대상 조회 방법${dataAsOf ? ` (${dataBasisText()})` : ""}. 내 차가 대상인지 자동차리콜센터에서 차대번호로 확인하세요.`,
    path: `/cars/${car.id}/recalls`,
    // 매칭된 리콜이 없으면 빈 페이지라 색인하지 않음 (사이트맵에서도 빠져 있음)
    robots: recalls.length ? undefined : { index: false, follow: true },
  })
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
    <div className="mx-auto max-w-5xl px-5 pb-6 pt-6 sm:pt-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "정비핵" },
          { href: "/cars", label: "차종별 정비 비용" },
          { href: `/cars/${car.id}`, label: name },
          { label: "리콜" },
        ]}
      />

      <h1 className="text-[28px] font-extrabold leading-[1.3] sm:text-[36px]">{name} 리콜 정보</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        {car.generation} · {car.yearRange} 생산 차량 리콜 <b className="num text-foreground">{recalls.length}건</b>
      </p>

      <RecallNotice carId={car.id} />

      <section className="mt-10" aria-label={`${name} 리콜 목록`}>
        {recalls.length ? (
          <RecallList recalls={recalls} />
        ) : (
          <RecallEmpty>
            {dataAsOf
              ? `${dataBasisText()} 데이터에서 ${name}에 해당한다고 확실히 확인된 리콜이 없어요.`
              : "리콜 데이터를 준비하고 있어요."}{" "}
            차명 표기가 애매한 리콜은{" "}
            <Link href="/recalls?all=1" className="font-semibold underline underline-offset-2">
              전체 리콜 목록
            </Link>
            에만 올려 두었으니 함께 확인해 주세요.
          </RecallEmpty>
        )}
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          차명의 세대 표기와 생산기간이 이 차종과 확실히 일치하는 리콜만 모았어요. 하이브리드 등 같은 세대의 다른
          파워트레인 리콜도 포함돼요.
        </p>
      </section>

      {/* 리콜로 정비소에 가는 김에 소모품도 — 차종 소모품 비용 페이지로 연결 */}
      <TrackedLink
        href={`/cars/${car.id}`}
        carId={car.id}
        label="recall_to_cost"
        className="mt-10 flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-input sm:p-5"
      >
        <span className="min-w-0">
          <span className="block text-[16px] font-bold">{name} 소모품 교체 비용 보기</span>
          <span className="mt-1 block text-[14px] leading-relaxed text-muted-foreground">
            리콜 수리 받으러 가는 김에 엔진오일·필터도 함께 점검해 보세요
          </span>
        </span>
        {savings > 0 && (
          <span className="num shrink-0 text-right">
            <span className="block text-[12px] text-muted-foreground">아끼는 돈</span>
            <span className="text-[18px] font-extrabold text-primary">{formatPrice(savings)}</span>
          </span>
        )}
      </TrackedLink>

      <Link
        href="/recalls?all=1"
        className="mt-3 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-muted-foreground hover:text-foreground"
      >
        전체 리콜 목록 보기
      </Link>

      <RecallFaq items={faq} />
      <RecallSource />
      <JsonLd data={faqJsonLd(faq)} />
    </div>
  )
}

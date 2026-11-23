import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  seoCars,
  getSeoCar,
  getPartBySlug,
  carShortName,
  partSlug,
  partTitleName,
  partCost,
  intervalText,
  calculatorHref,
  pageMetadata,
  priceBasis,
  partSeoTitle,
  changeWord,
} from "@/lib/seo"
import { formatPrice } from "@/lib/utils"
import { GONGIM_RESERVATION_URL } from "@/lib/config"
import { coupangChoicesFor } from "@/lib/coupang-links"
import { OutboundLink } from "@/components/seo/OutboundLink"
import { AffiliateNotice, Breadcrumbs, EstimateNote, JsonLd } from "@/components/seo/Shared"
import { ReceiptCard } from "@/components/home/ReceiptCard"

export const dynamicParams = false

type Params = { carId: string; part: string }

export function generateStaticParams(): Params[] {
  return seoCars().flatMap((car) => car.parts.map((p) => ({ carId: car.id, part: partSlug(car, p) })))
}

function load(params: Params) {
  const car = getSeoCar(params.carId)
  const part = car ? getPartBySlug(car, params.part) : undefined
  return car && part ? { car, part } : null
}

type Props = { params: Promise<Params> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = load(await params)
  if (!found) return {}
  const { car, part } = found
  const name = carShortName(car)
  const title = partTitleName(part)
  const c = partCost(part)
  return pageMetadata({
    // 검색 결과에서 잘리지 않게 핵심(차종·소모품·비용·절약액)만. 비교 문구는 설명에 있음
    title: `${partSeoTitle(car, part)} | 정비핵`,
    description: `${name} ${title} 규격은 ${part.spec}. 공식센터 예상 ${formatPrice(c.dealer)}, 쿠팡 부품+공임나라 공임 ${formatPrice(c.self)}으로 약 ${c.savingsPercent}% 절약할 수 있습니다.${intervalText(part) ? ` 교체 주기 ${intervalText(part)}.` : ""}`,
    path: `/cars/${car.id}/${partSlug(car, part)}`,
  })
}

export default async function PartPage({ params }: Props) {
  const found = load(await params)
  if (!found) notFound()
  const { car, part } = found

  const name = carShortName(car)
  const title = partTitleName(part)
  const c = partCost(part)
  const interval = intervalText(part)
  // 엔진별 소모품이면 같은 엔진(+공통) 소모품만 "다른 소모품"으로
  const otherParts = car.parts.filter((p) => p.id !== part.id && (!part.engine || !p.engine || p.engine === part.engine))
  const specLinks = coupangChoicesFor(part)
  const slug = partSlug(car, part)
  const sameOnOtherCars = seoCars()
    .filter((oc) => oc.id !== car.id)
    .flatMap((oc) => oc.parts.filter((p) => partSlug(oc, p) === slug).map((p) => ({ car: oc, part: p })))

  const faq = [
    {
      q: `${name} ${title} 규격은?`,
      a: `${part.spec}${part.partNumber ? ` (참고 품번 ${part.partNumber})` : ""}. 연식·엔진에 따라 다를 수 있어 구매 전 차대번호로 확인하세요.`,
    },
    {
      q: `${name} ${title} 교체 비용은 얼마인가요?`,
      a: `공식센터는 부품 ${formatPrice(part.dealerPartPrice)} + 공임 ${formatPrice(part.dealerLaborCost)}으로 약 ${formatPrice(c.dealer)}, 쿠팡에서 부품을 사고 공임나라에서 교체하면 약 ${formatPrice(c.self)}입니다.`,
    },
    ...(interval
      ? [{ q: `${name} ${title} 교체 주기는?`, a: `일반적으로 ${interval}마다 교체를 권장합니다. 주행 환경에 따라 달라질 수 있습니다.` }]
      : []),
  ]

  return (
    <div className="mx-auto max-w-5xl px-5 pb-6 pt-6 sm:pt-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "정비핵" },
          { href: "/cars", label: "차종별 정비 비용" },
          { href: `/cars/${car.id}`, label: name },
          { label: title },
        ]}
      />

      <h1 className="text-[26px] font-extrabold leading-[1.3] sm:text-[36px]">
        {name} {title} {changeWord(part)} 비용
      </h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        {car.yearRange} · {part.engine ?? car.engineTypes.join(" / ")}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-10">
        {/* 비용: 영수증 */}
        <ReceiptCard
          title={`${title} 교체 한 번`}
          dealer={c.dealer}
          self={c.self}
          dealerNote={`부품 ${formatPrice(part.dealerPartPrice)} + 공임 ${formatPrice(part.dealerLaborCost)}`}
          selfNote={`부품 ${formatPrice(part.coupangPrice)} + 공임 ${formatPrice(part.laborCost)}`}
          basis={priceBasis(car)}
        />

        {/* 준비하기: 규격 → (맞는 상품) → 공임나라 */}
        <section aria-labelledby="buy" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="buy" className="text-[17px] font-bold">{title} 준비하기</h2>
          <p className="mt-3 text-[13px] font-semibold text-muted-foreground">이 규격으로 사세요</p>
          <p className="mt-1 text-[16px] font-semibold leading-relaxed">{part.spec}</p>
          {part.partNumber && <p className="mt-1 text-[14px] text-muted-foreground">참고 품번 {part.partNumber}</p>}

          {specLinks.length > 0 ? (
            <div className="mt-4 space-y-2">
              <AffiliateNotice />
              {specLinks.map((l) => (
                <OutboundLink
                  key={l.url}
                  href={l.url}
                  target="coupang"
                  carId={car.id}
                  partId={part.id}
                  sponsored
                  className="block rounded-[10px] bg-primary px-4 py-3 text-primary-foreground transition hover:brightness-110 active:translate-y-px"
                >
                  <span className="block text-[15px] font-bold">{l.title}</span>
                  <span className="mt-0.5 block text-[13px] opacity-90">{l.sub}</span>
                </OutboundLink>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-[10px] bg-muted px-3 py-2.5 text-[14px] leading-relaxed text-muted-foreground">
              규격을 확인한 상품 링크는 아직 없어요. 위 규격과 차대번호로 맞는 부품을 고르세요.
            </p>
          )}

          <Link
            href="/near"
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-foreground px-5 text-[15px] font-bold text-background transition hover:brightness-125 active:translate-y-px"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" /></svg>
            근처 공임나라에서 교체하기
          </Link>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <OutboundLink
              href={GONGIM_RESERVATION_URL}
              target="gongim"
              carId={car.id}
              partId={part.id}
              className="inline-flex h-12 w-full items-center justify-center rounded-[10px] px-5 text-[15px] font-bold transition active:translate-y-px border border-border bg-card text-foreground hover:bg-muted"
            >
              공임나라 예약하기
            </OutboundLink>
            <Link href={calculatorHref(car, part)} className="inline-flex h-12 w-full items-center justify-center rounded-[10px] px-5 text-[15px] font-bold transition active:translate-y-px border border-border bg-card text-foreground hover:bg-muted">
              다른 항목과 함께 계산
            </Link>
          </div>
        </section>
      </div>

      {/* 규격 정보 */}
      <section className="mt-12">
        <h2 className="text-[20px] font-bold sm:text-[24px]">규격 정보</h2>
        <dl className="mt-4 divide-y divide-border rounded-[14px] border border-border bg-card text-[15px]">
          {[
            ["규격", part.spec],
            ...(part.partNumber ? [["참고 품번", part.partNumber]] : []),
            ...(part.engine ? [["해당 엔진", part.engine]] : []),
            ...(interval ? [["교체 주기", interval]] : []),
            ["적용 연식", car.yearRange],
          ].map(([k, v]) => (
            <div key={k} className="grid grid-cols-[88px_1fr] gap-3 px-4 py-3.5 sm:grid-cols-[140px_1fr]">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {part.source && <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">출처: {part.source}</p>}
      </section>

      {/* 자주 묻는 질문 */}
      <section className="mt-12">
        <h2 className="text-[20px] font-bold sm:text-[24px]">자주 묻는 질문</h2>
        <div className="mt-4 divide-y divide-border rounded-[14px] border border-border bg-card">
          {faq.map((f) => (
            <details key={f.q} className="group px-4">
              <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 py-3 font-semibold">
                <h3 className="text-[15px]">{f.q}</h3>
                <span aria-hidden className="text-muted-foreground transition group-open:rotate-180">⌄</span>
              </summary>
              <p className="pb-4 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 내부 링크 */}
      <section className="mt-12">
        <h2 className="text-[17px] font-bold">{name} 다른 소모품</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {otherParts.map((p) => (
            <li key={p.id}>
              <Link href={`/cars/${car.id}/${partSlug(car, p)}`} className="inline-flex min-h-[36px] items-center rounded-full border border-border bg-card px-3.5 text-[13px] hover:border-primary/50">
                {partTitleName(p)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {sameOnOtherCars.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[17px] font-bold">다른 차종 {title} 비용</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {sameOnOtherCars.slice(0, 8).map(({ car: oc, part: p }) => (
              <li key={p.id}>
                <Link href={`/cars/${oc.id}/${partSlug(oc, p)}`} className="inline-flex min-h-[36px] items-center rounded-full border border-border bg-card px-3.5 text-[13px] hover:border-primary/50">
                  {carShortName(oc)}
                </Link>
              </li>
            ))}
          </ul>
          {sameOnOtherCars.length > 8 && (
            <details className="mt-2">
              <summary className="min-h-[44px] cursor-pointer content-center text-[14px] font-semibold text-muted-foreground">
                차종 {sameOnOtherCars.length - 8}개 더 보기
              </summary>
              <ul className="flex flex-wrap gap-2">
                {sameOnOtherCars.slice(8).map(({ car: oc, part: p }) => (
                  <li key={p.id}>
                    <Link href={`/cars/${oc.id}/${partSlug(oc, p)}`} className="inline-flex min-h-[36px] items-center rounded-full border border-border bg-card px-3.5 text-[13px] hover:border-primary/50">
                      {carShortName(oc)}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      <EstimateNote />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
    </div>
  )
}

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
  SITE_URL,
} from "@/lib/seo"
import { formatPrice } from "@/lib/utils"
import { GONGIM_RESERVATION_URL } from "@/lib/config"
import { CoupangLink } from "@/components/seo/CoupangLink"
import { Breadcrumbs, JsonLd, PartnersDisclosure } from "@/components/seo/Shared"

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

export function generateMetadata({ params }: { params: Params }): Metadata {
  const found = load(params)
  if (!found) return {}
  const { car, part } = found
  const name = carShortName(car)
  const title = partTitleName(part)
  const c = partCost(part)
  return {
    title: `${name} ${title} 교체 비용 · 규격 | 공식센터 vs 셀프 ${formatPrice(c.savings)} 절약 | 정비핵`,
    description: `${name} ${title} 규격은 ${part.spec}. 공식센터 예상 ${formatPrice(c.dealer)}, 쿠팡 부품+공임나라 공임 ${formatPrice(c.self)}으로 약 ${c.savingsPercent}% 절약할 수 있습니다.${intervalText(part) ? ` 교체 주기 ${intervalText(part)}.` : ""}`,
    alternates: { canonical: `${SITE_URL}/cars/${car.id}/${partSlug(car, part)}` },
  }
}

export default function PartPage({ params }: { params: Params }) {
  const found = load(params)
  if (!found) notFound()
  const { car, part } = found

  const name = carShortName(car)
  const title = partTitleName(part)
  const c = partCost(part)
  const interval = intervalText(part)
  const otherParts = car.parts.filter((p) => p.id !== part.id)
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
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "정비핵" },
          { href: "/cars", label: "차종별 정비 비용" },
          { href: `/cars/${car.id}`, label: name },
          { label: title },
        ]}
      />

      <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
        {name} {title} 교체 비용 · 규격
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {car.yearRange} · {car.engineTypes.join(" / ")}
      </p>

      {/* 비용 비교 */}
      <section className="mb-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">공식 서비스센터 예상</div>
          <div className="mt-1 text-2xl font-bold">{formatPrice(c.dealer)}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            부품 {formatPrice(part.dealerPartPrice)} + 공임 {formatPrice(part.dealerLaborCost)}
          </div>
        </div>
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-5">
          <div className="text-xs text-muted-foreground">쿠팡 부품 + 공임나라</div>
          <div className="mt-1 text-2xl font-bold text-primary">{formatPrice(c.self)}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            부품 {formatPrice(part.coupangPrice)} + 공임 {formatPrice(part.laborCost)}
            {c.savings > 0 && (
              <span className="ml-1 font-semibold text-primary">
                · {formatPrice(c.savings)} ({c.savingsPercent}%) 절약
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 규격 */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold">규격 정보</h2>
        <dl className="divide-y divide-border rounded-xl border border-border text-sm">
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-muted-foreground">규격</dt>
            <dd className="text-right font-medium">{part.spec}</dd>
          </div>
          {part.partNumber && (
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-muted-foreground">참고 품번</dt>
              <dd className="text-right font-medium">{part.partNumber}</dd>
            </div>
          )}
          {interval && (
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-muted-foreground">교체 주기</dt>
              <dd className="text-right font-medium">{interval}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-muted-foreground">적용 연식</dt>
            <dd className="text-right font-medium">{car.yearRange}</dd>
          </div>
        </dl>
      </section>

      {/* 행동 버튼 */}
      <section className="mb-10 flex flex-wrap gap-3">
        <CoupangLink keyword={part.coupangKeyword} label={`${title} 쿠팡 최저가 보기`} />
        <a
          href={GONGIM_RESERVATION_URL}
          target="_blank"
          rel="noopener nofollow"
          className="inline-flex items-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-accent"
        >
          공임나라 예약
        </a>
        <Link
          href={calculatorHref(car, part)}
          className="inline-flex items-center rounded-lg border border-primary/50 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
        >
          다른 항목과 함께 계산 →
        </Link>
      </section>

      {/* 자주 묻는 질문 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold">자주 묻는 질문</h2>
        <div className="space-y-3">
          {faq.map((f) => (
            <div key={f.q} className="rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold">{f.q}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 내부 링크 */}
      <section className="mb-6">
        <h2 className="mb-3 text-base font-bold">{name} 다른 소모품</h2>
        <ul className="flex flex-wrap gap-2">
          {otherParts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/cars/${car.id}/${partSlug(car, p)}`}
                className="inline-block rounded-full border border-border px-3 py-1 text-xs hover:border-primary/50 hover:text-primary"
              >
                {partTitleName(p)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {sameOnOtherCars.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-bold">다른 차종 {title} 비용</h2>
          <ul className="flex flex-wrap gap-2">
            {sameOnOtherCars.map(({ car: oc, part: p }) => (
              <li key={p.id}>
                <Link
                  href={`/cars/${oc.id}/${partSlug(oc, p)}`}
                  className="inline-block rounded-full border border-border px-3 py-1 text-xs hover:border-primary/50 hover:text-primary"
                >
                  {carShortName(oc)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PartnersDisclosure />

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

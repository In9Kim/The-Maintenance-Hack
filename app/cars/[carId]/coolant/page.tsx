import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getSeoCar, carShortName, pageMetadata } from "@/lib/seo"
import { fluidGuideFor, GUIDE_CAR_IDS } from "@/lib/data/fluid-guides"
import { Breadcrumbs, JsonLd } from "@/components/seo/Shared"
import { GuideLinks } from "@/components/cars/GuideLinks"

export const dynamicParams = false
type Params = { carId: string }
type Props = { params: Promise<Params> }

export function generateStaticParams(): Params[] {
  return GUIDE_CAR_IDS.filter((id) => getSeoCar(id)).map((carId) => ({ carId }))
}

function load(carId: string) {
  const car = getSeoCar(carId)
  const guide = fluidGuideFor(carId)
  return car && guide ? { car, guide } : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = load((await params).carId)
  if (!found) return {}
  const name = carShortName(found.car)
  const c = found.guide.coolant
  return pageMetadata({
    title: `${name} 냉각수(부동액) 교체 주기·용량·혼합 비율 | 정비핵`,
    description: `${name} 냉각수 용량 ${c.rows.map((r) => `${r.transmission} ${r.capacity}`).join(", ")}. ${c.interval}. 부동액과 물 50:50. 기아 취급설명서 기준.`,
    path: `/cars/${found.car.id}/coolant`,
  })
}

export default async function CoolantPage({ params }: Props) {
  const found = load((await params).carId)
  if (!found) notFound()
  const { car, guide } = found
  const name = carShortName(car)
  const c = guide.coolant

  const faq = [
    { q: `${name} 냉각수 교체 주기는?`, a: `${c.interval} (기아 취급설명서 기준).` },
    { q: `${name} 냉각수 용량은?`, a: `${c.rows.map((r) => `${r.transmission} ${r.capacity}`).join(", ")}.` },
    { q: `${name} 부동액 비율은?`, a: c.mix },
  ]

  return (
    <div className="mx-auto max-w-3xl px-5 pb-12 pt-6 sm:pt-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "정비핵" },
          { href: "/cars", label: "차종별 정비 비용" },
          { href: `/cars/${car.id}`, label: name },
          { label: "냉각수" },
        ]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />

      <h1 className="text-[26px] font-extrabold leading-[1.3] sm:text-[34px]">{name} 냉각수(부동액) 교체 주기·용량</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">{car.yearRange}</p>

      <dl className="mt-6 divide-y divide-border rounded-[14px] border border-border bg-card text-[15px]">
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]">
          <dt className="text-muted-foreground">교체 주기</dt>
          <dd className="font-semibold">{c.interval}</dd>
        </div>
        {c.rows.map((r) => (
          <div key={r.transmission} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]">
            <dt className="text-muted-foreground">용량 · {r.transmission}</dt>
            <dd className="num font-semibold">{r.capacity}</dd>
          </div>
        ))}
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]">
          <dt className="text-muted-foreground">냉각수 종류</dt>
          <dd>{c.fluid}</dd>
        </div>
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]">
          <dt className="text-muted-foreground">혼합 비율</dt>
          <dd>{c.mix}</dd>
        </div>
      </dl>

      <section className="mt-10">
        <h2 className="text-[20px] font-bold">내 차는 언제 갈아야 하나요?</h2>
        <ul className="mt-3 space-y-2 text-[15px] leading-relaxed">
          <li className="rounded-[10px] bg-muted px-4 py-3">
            <b>처음 교체:</b> {c.firstKm.toLocaleString("ko-KR")}km 또는 {c.firstYears}년 중 먼저 오는 때. 1년에 2만 km보다 적게 타는 차는 주행거리보다 <b>{c.firstYears}년</b>이 먼저 와요.
          </li>
          <li className="rounded-[10px] bg-muted px-4 py-3">
            <b>그다음:</b> {c.thenKm.toLocaleString("ko-KR")}km 또는 {c.thenYears}년마다.
          </li>
        </ul>
        <p className="mt-2 text-[13px] text-muted-foreground">중고차라 예전에 갈았는지 모르면 오토큐 정비 이력이나 이전 정비 영수증을 먼저 확인하세요.</p>
      </section>

      <section className="mt-10">
        <h2 className="text-[20px] font-bold">점검할 때 알아 둘 것</h2>
        <ul className="mt-3 space-y-2 text-[15px] leading-relaxed">
          {c.notes.map((n) => (
            <li key={n} className="rounded-[10px] border border-border bg-card px-4 py-3">{n}</li>
          ))}
        </ul>
      </section>

      <GuideLinks car={car} current="coolant" />

      <p className="mt-10 border-t border-border pt-4 text-[13px] leading-relaxed text-muted-foreground">
        출처: {c.source}. {guide.checkedAt} 확인. 부동액 제품·공임 가격은 아직 정리하지 않았어요.{" "}
        <Link href={`/cars/${car.id}`} className="underline underline-offset-2">{name} 소모품 전체 보기</Link>
      </p>
    </div>
  )
}

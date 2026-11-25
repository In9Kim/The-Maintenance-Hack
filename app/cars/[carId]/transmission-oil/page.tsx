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
  const t = found.guide.transmission
  return pageMetadata({
    title: `${name} 미션오일 교환 주기·용량·규격 (IVT·DCT) | 정비핵`,
    description: `${name} 변속기 오일: ${t.map((r) => `${r.transmission} ${r.fluid.split(" · ")[0]} ${r.capacity}, ${r.normal}·가혹 조건 ${r.severe}`).join(" / ")}. 기아 취급설명서 기준, 오토큐·공임나라 견적 받을 때 물어볼 것.`,
    path: `/cars/${found.car.id}/transmission-oil`,
  })
}

export default async function TransmissionOilPage({ params }: Props) {
  const found = load((await params).carId)
  if (!found) notFound()
  const { car, guide } = found
  const name = carShortName(car)

  const faq = [
    {
      q: `${name} 미션오일 교환 주기는?`,
      a: guide.transmission.map((r) => `${r.transmission}: 통상 조건 ${r.normal}, 가혹 조건 ${r.severe}`).join(" / ") + " (기아 취급설명서 기준).",
    },
    {
      q: `${name} 미션오일 용량은?`,
      a: guide.transmission.map((r) => `${r.transmission} ${r.capacity}`).join(", ") + ". 변속기 전체 용량이라 교환할 때 실제로 들어가는 양은 교환 방식에 따라 달라요.",
    },
  ]

  return (
    <div className="mx-auto max-w-3xl px-5 pb-12 pt-6 sm:pt-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "정비핵" },
          { href: "/cars", label: "차종별 정비 비용" },
          { href: `/cars/${car.id}`, label: name },
          { label: "미션오일" },
        ]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />

      <h1 className="text-[26px] font-extrabold leading-[1.3] sm:text-[34px]">{name} 미션오일(변속기 오일) 교환 주기·용량</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">{car.yearRange} · 엔진에 따라 변속기가 달라요</p>

      <div className="mt-6 space-y-3">
        {guide.transmission.map((r) => (
          <div key={r.transmission} className="rounded-[14px] border border-border bg-card p-4">
            <p className="text-[17px] font-bold">{r.transmission}</p>
            <p className="text-[13px] text-muted-foreground">{r.engine}</p>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-[14px] sm:grid-cols-[7rem_1fr]">
              <dt className="text-muted-foreground">오일 규격</dt>
              <dd className="leading-relaxed">{r.fluid}</dd>
              <dt className="text-muted-foreground">전체 용량</dt>
              <dd className="num font-semibold">{r.capacity}</dd>
              <dt className="text-muted-foreground">교환 주기</dt>
              <dd className="leading-relaxed">통상 조건 <b>{r.normal}</b> · 가혹 조건 <b>{r.severe}</b></dd>
            </dl>
          </div>
        ))}
      </div>
      <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-muted-foreground">
        {guide.transmission.filter((r) => r.note).map((r) => (
          <li key={r.transmission}>· {r.transmission}: {r.note}</li>
        ))}
      </ul>

      <section className="mt-10">
        <h2 className="text-[20px] font-bold">'가혹 조건'이 뭔가요?</h2>
        <p className="mt-2 text-[15px] leading-relaxed">설명서는 변속기마다 해당하는 가혹 조건을 따로 적어 두었어요 (2022·2023년형 설명서 기준).</p>
        <ul className="mt-2 space-y-1.5 text-[14px] leading-relaxed">
          <li><b>IVT:</b> 짧은 거리 반복 주행, 교통 체증이 심한 구역 주행, 험로 주행, 산길·오르막·내리막 주행, 택시·경찰차 등 영업용, 잦은 고속 주행·급가감속, 잦은 정지와 출발, 견인·캠핑용·지붕 짐칸</li>
          <li><b>DCT:</b> 교통 체증이 심한 구역 주행, 험로 주행, 산길·오르막·내리막 주행, 택시·경찰차 등 영업용, 잦은 고속 주행·급가감속, 소금·한랭 지역 주행, 견인·캠핑용·지붕 짐칸</li>
        </ul>
        <p className="mt-2 text-[15px] leading-relaxed">막히는 길을 자주 다닌다면 두 변속기 모두 가혹 조건에 해당해요. 이때는 위 표의 가혹 조건 주기를 기준으로 보세요.</p>
      </section>

      <section className="mt-10">
        <h2 className="text-[20px] font-bold">설명서에 적힌 주의 사항</h2>
        <ul className="mt-3 space-y-2 text-[15px] leading-relaxed">
          {guide.transmissionNotes.map((n) => (
            <li key={n} className="rounded-[10px] bg-muted px-4 py-3">{n}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-[20px] font-bold">탈거식과 순환식, 뭐가 달라요?</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[12px] border border-border bg-card p-4">
            <b className="block text-[16px]">탈거식 (드레인)</b>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              변속기 아래 배출구(드레인 플러그)를 열어 흘러나오는 오일만 빼고 그만큼 새로 넣는 방식이에요. 변속기 안에 남는 오일이 있어 한 번에 전부 바뀌지는 않아요.
            </p>
          </div>
          <div className="rounded-[12px] border border-border bg-card p-4">
            <b className="block text-[16px]">순환식 (교환기)</b>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              장비를 오일 라인에 연결해 헌 오일을 빼면서 새 오일을 돌려 넣는 방식이에요. 같은 횟수라면 탈거식보다 많이 바뀌지만 새 오일도 더 들어가요.
            </p>
          </div>
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">어느 방식이 이 차에 맞는지는 기아 설명서에 나와 있지 않아요. 정비소마다 권하는 방식이 다르니 견적 받을 때 함께 물어보세요.</p>
      </section>

      <section className="mt-10">
        <h2 className="text-[20px] font-bold">견적 받을 때 물어볼 것</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">오토큐·공임나라 공임은 지점마다 달라서 금액은 적지 않았어요. 아래 네 가지를 맞춰서 비교하면 견적이 공정하게 비교돼요.</p>
        <ol className="mt-3 space-y-2 text-[15px] leading-relaxed">
          <li className="rounded-[10px] border border-border bg-card px-4 py-3"><b>1. 어떤 방식인가요?</b> 탈거식인지 순환식인지</li>
          <li className="rounded-[10px] border border-border bg-card px-4 py-3"><b>2. 몇 L 넣나요?</b> 실제로 넣는 오일 양</li>
          <li className="rounded-[10px] border border-border bg-card px-4 py-3"><b>3. 어떤 오일인가요?</b> IVT는 순정 SP-CVT1인지, 오일값이 견적에 포함됐는지</li>
          <li className="rounded-[10px] border border-border bg-card px-4 py-3"><b>4. 와셔·패킹도 바꾸나요?</b> 드레인 플러그 와셔 등 부속 교체 여부 (품번은 차대번호로 확인)</li>
        </ol>
      </section>

      <GuideLinks car={car} current="transmission-oil" />

      <p className="mt-10 border-t border-border pt-4 text-[13px] leading-relaxed text-muted-foreground">
        출처: {guide.transmissionSource}. {guide.checkedAt} 확인. 연식·옵션에 따라 다를 수 있어 정비 전에 차대번호로 확인하세요.{" "}
        <Link href={`/cars/${car.id}`} className="underline underline-offset-2">{name} 소모품 전체 보기</Link>
      </p>
    </div>
  )
}

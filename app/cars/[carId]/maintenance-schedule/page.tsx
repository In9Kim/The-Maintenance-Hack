import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { CarModel, MaintenancePart } from "@/types"
import { getSeoCar, carShortName, pageMetadata, partCost, partSlug, priceBasis } from "@/lib/seo"
import { formatPrice } from "@/lib/utils"
import { fluidGuideFor, GUIDE_CAR_IDS, type FluidGuide } from "@/lib/data/fluid-guides"
import { Breadcrumbs } from "@/components/seo/Shared"
import { GuideLinks } from "@/components/cars/GuideLinks"

export const dynamicParams = false
type Params = { carId: string }
type Props = { params: Promise<Params> }

const STEP = 20000
const MILESTONES = Array.from({ length: 10 }, (_, i) => (i + 1) * STEP) // 2만 ~ 20만 km

export function generateStaticParams(): Params[] {
  return GUIDE_CAR_IDS.filter((id) => getSeoCar(id)).map((carId) => ({ carId }))
}

function load(carId: string) {
  const car = getSeoCar(carId)
  const guide = fluidGuideFor(carId)
  return car && guide ? { car, guide } : null
}

/** (M-STEP, M] 구간에 교체 시점이 몇 번 들어 있나 */
const timesIn = (interval: number, m: number) => Math.floor(m / interval) - Math.floor((m - STEP) / interval)

type Row = { key: string; label: string; href?: string; times: number; part?: MaintenancePart; note?: string }

function scheduleFor(car: CarModel, guide: FluidGuide, engine: string) {
  const parts = car.parts.filter((p) => p.intervalKm && (!p.engine || p.engine === engine))
  const trans = guide.transmission.find((t) => t.engineType === engine)
  return MILESTONES.map((m) => {
    const rows: Row[] = []
    for (const p of parts) {
      const t = timesIn(p.intervalKm!, m)
      if (t > 0) rows.push({ key: p.id, label: p.name, href: `/cars/${car.id}/${partSlug(car, p)}`, times: t, part: p })
    }
    if (trans?.severeKm && timesIn(trans.severeKm, m) > 0)
      rows.push({ key: "trans", label: `미션오일 (${trans.transmission.split(" ")[0]})`, href: `/cars/${car.id}/transmission-oil`, times: 1, note: "가혹 조건일 때만 · 가격 미포함" })
    if (timesIn(guide.coolant.firstKm, m) > 0)
      rows.push({ key: "coolant", label: "냉각수 (처음 교체)", href: `/cars/${car.id}/coolant`, times: 1, note: `또는 ${guide.coolant.firstYears}년 · 가격 미포함` })
    const self = rows.reduce((s, r) => s + (r.part ? partCost(r.part).self * r.times : 0), 0)
    const dealer = rows.reduce((s, r) => s + (r.part ? partCost(r.part).dealer * r.times : 0), 0)
    return { m, rows, self, dealer }
  })
}

const km = (n: number) => `${(n / 10000).toLocaleString("ko-KR")}만 km`

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = load((await params).carId)
  if (!found) return {}
  const name = carShortName(found.car)
  return pageMetadata({
    title: `${name} 주행거리별 소모품 교체 목록 (6만·8만·10만·12만 km) | 정비핵`,
    description: `${name} 2만~20만 km 구간마다 갈아야 할 소모품과 부품값+공임 범위. 기아 취급설명서 교체 주기 기준, 오토큐 견적이 적정한지 비교할 때.`,
    path: `/cars/${found.car.id}/maintenance-schedule`,
  })
}

export default async function SchedulePage({ params }: Props) {
  const found = load((await params).carId)
  if (!found) notFound()
  const { car, guide } = found
  const name = carShortName(car)
  const noInterval = car.parts.filter((p) => !p.intervalKm)

  return (
    <div className="mx-auto max-w-3xl px-5 pb-12 pt-6 sm:pt-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "정비핵" },
          { href: "/cars", label: "차종별 정비 비용" },
          { href: `/cars/${car.id}`, label: name },
          { label: "주행거리별 교체 목록" },
        ]}
      />
      <h1 className="text-[26px] font-extrabold leading-[1.3] sm:text-[34px]">{name} 주행거리별 소모품 교체 목록</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
        기아 취급설명서의 교체 주기(통상 조건)로 2만 km 구간마다 갈 것을 모았어요. 예를 들어 "6만 km"는 4만 km 초과~6만 km 사이에 교체 시점이 오는 항목이에요.
      </p>

      <nav aria-label="엔진 선택" className="mt-4 flex flex-wrap gap-2">
        {car.engineTypes.map((e, i) => (
          <a key={e} href={`#engine-${i}`} className="inline-flex min-h-[40px] items-center rounded-full border border-border bg-card px-4 text-[14px] font-semibold hover:border-primary/50">
            {e}
          </a>
        ))}
      </nav>

      {car.engineTypes.map((engine, i) => (
        <section key={engine} id={`engine-${i}`} className="mt-10 scroll-mt-20">
          <h2 className="text-[20px] font-bold">{engine}</h2>
          <ol className="mt-3 space-y-3">
            {scheduleFor(car, guide, engine).map(({ m, rows, self, dealer }) => (
              <li key={m} className="rounded-[14px] border border-border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="num text-[18px] font-extrabold">{km(m)}</h3>
                  {self > 0 && (
                    <p className="num text-[13px] text-muted-foreground">
                      직접 구매+공임나라 <b className="text-[15px] text-primary">{formatPrice(self)}</b> · 공식센터(추정) {formatPrice(dealer)}
                    </p>
                  )}
                </div>
                {rows.length ? (
                  <ul className="mt-2 divide-y divide-border text-[15px]">
                    {rows.map((r) => (
                      <li key={r.key} className="flex items-baseline justify-between gap-3 py-2">
                        <span className="min-w-0">
                          {r.href ? (
                            <Link href={r.href} className="font-semibold underline decoration-border underline-offset-4 hover:decoration-primary">{r.label}</Link>
                          ) : (
                            <b>{r.label}</b>
                          )}
                          {r.times > 1 && <span className="ml-1 text-[13px] text-muted-foreground">× {r.times}회</span>}
                          {r.note && <span className="block text-[12px] text-muted-foreground">{r.note}</span>}
                        </span>
                        {r.part && <span className="num shrink-0 text-[13px] text-muted-foreground">{formatPrice(partCost(r.part).self * r.times)}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[14px] text-muted-foreground">이 구간에 교체 주기가 오는 항목은 없어요. 아래 '주행거리와 상관없이 볼 것'만 확인하세요.</p>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}

      <section className="mt-10 rounded-[14px] bg-muted p-4">
        <h2 className="text-[17px] font-bold">주행거리와 상관없이 볼 것</h2>
        <ul className="mt-2 space-y-1.5 text-[14px] leading-relaxed">
          {noInterval.map((p) => (
            <li key={p.id}>
              <Link href={`/cars/${car.id}/${partSlug(car, p)}`} className="font-semibold underline decoration-border underline-offset-4">{p.name}</Link>
              <span className="text-muted-foreground"> · {p.intervalMonths ? `${p.intervalMonths}개월마다` : "정기 점검 때 상태를 보고 교체"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 space-y-2 text-[13px] leading-relaxed text-muted-foreground">
        <p>· 짧은 거리 반복·막히는 길 위주로 타면 '가혹 조건'이라 엔진오일 등은 더 자주 갈아야 해요 (각 소모품 페이지 참고).</p>
        <p>· 브레이크액은 2021년형 이후 설명서 기준 5만 km예요. 2019·2020년형 설명서는 4만 km로 안내해요.</p>
        <p>· 금액은 각 소모품 페이지의 부품값+공임을 더한 값이에요. {priceBasis(car)}</p>
        <p>· 미션오일·냉각수는 아직 가격을 정리하지 않아 합계에서 빠져 있어요.</p>
      </section>

      <GuideLinks car={car} current="maintenance-schedule" />
    </div>
  )
}

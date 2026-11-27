import { pageMetadata, seoCars, carShortName, partSlug } from "@/lib/seo"
import { Breadcrumbs } from "@/components/seo/Shared"
import { CheckPage, type CheckCar } from "@/components/check/CheckPage"
import { coupangPickFor } from "@/lib/coupang-links"
import { yearsOf } from "@/lib/years"

export const metadata = pageMetadata({
  title: "이 부품 내 차에 맞을까? 차종·연식으로 쿠팡 상품 호환 확인 | 정비핵",
  description:
    "차종과 연식을 고르고 쿠팡에서 공유한 상품을 붙여 넣으면, 제조사 취급설명서 기준 규격·순정 품번과 대조해 내 차에 맞는지 AI가 알려 줍니다. 차종별로 맞는 상품과 가격도 바로 보여 드려요.",
  path: "/check",
})


export default function Page() {
  const cars: CheckCar[] = seoCars().map((c) => ({
    id: c.id,
    brand: c.brand,
    label: `${c.model} ${c.generation.replace(/\s*\(.*?\)\s*/g, "")} · ${c.yearRange}`,
    name: carShortName(c),
    years: yearsOf(c.yearRange),
    engines: c.engineTypes,
    parts: c.parts.map((p) => ({ slug: partSlug(c, p), name: p.name, engine: p.engine })),
    picks: c.parts.flatMap((p) => {
      const k = coupangPickFor(p)
      return k ? [{ slug: partSlug(c, p), name: k.name, price: k.price, url: k.url, image: k.image }] : []
    }),
  }))

  return (
    <div className="mx-auto max-w-2xl px-5 pb-6 pt-6 sm:pt-10">
      <Breadcrumbs items={[{ href: "/", label: "정비핵" }, { label: "부품 호환 확인" }]} />
      <h1 className="text-[26px] font-extrabold leading-[1.3] sm:text-[34px]">이 부품, 내 차에 맞을까?</h1>

      <div className="mt-6">
        <CheckPage cars={cars} />
      </div>

    </div>
  )
}

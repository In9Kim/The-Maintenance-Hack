import { pageMetadata, seoCars, carShortName, partSlug, partCost } from "@/lib/seo"
import { carPhoto } from "@/lib/car-photos"
import { coupangPickFor } from "@/lib/coupang-links"
import { yearsOf } from "@/lib/years"
import { MyCarPage, type MyCarOption } from "@/components/my/MyCarPage"

export const metadata = pageMetadata({
  title: "내 차 소모품 교체 시기 관리 - 가입 없이 엔진오일·와이퍼 교체 알림 | 정비핵",
  description:
    "차종과 주행거리, 마지막 교체 날짜만 적으면 엔진오일·와이퍼·에어컨필터·브레이크패드 교체 시기를 계산해 드려요. 가입 없이도 쓸 수 있고, 로그인하면 차 여러 대를 계정에 저장해요.",
  path: "/my",
})

export default function Page() {
  const options: MyCarOption[] = seoCars().map((c) => {
    const p = carPhoto(c.id)
    return {
      id: c.id,
      brand: c.brand,
      label: `${c.model} ${c.generation.replace(/\s*\(.*?\)\s*/g, "")} · ${c.yearRange}`,
      name: carShortName(c),
      photo: p?.localSmall,
      credit: p ? `사진: ${p.author} / ${p.license}${p.edited ? ` (${p.edited})` : ""}` : undefined,
      engines: c.engineTypes,
      years: yearsOf(c.yearRange),
      parts: c.parts.map((x) => {
        const pick = coupangPickFor(x)
        return {
        slug: partSlug(c, x),
        name: x.name,
        engine: x.engine,
        intervalKm: x.intervalKm,
        intervalMonths: x.intervalMonths,
        spec: x.category === "wiper" ? x.spec.split(" (")[0] : x.spec.split(" · ")[0],
        self: partCost(x).self,
        price: x.coupangPrice,
        shop: pick ? { price: pick.price, date: pick.checkedAt, url: pick.url } : undefined,
      }}),
    }
  })
  return <MyCarPage options={options} />
}

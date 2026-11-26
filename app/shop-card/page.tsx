import { pageMetadata, seoCars, carShortName, partSlug } from "@/lib/seo"
import { Breadcrumbs } from "@/components/seo/Shared"
import { coupangPickFor } from "@/lib/coupang-links"
import { ShopCardPage, type ShopCardCar } from "@/components/shop/ShopCardPage"

export const metadata = pageMetadata({
  title: "공임나라에 보여줄 부품 리스트 만들기 - 내 차 규격·순정 품번 한 화면 | 정비핵",
  description:
    "직접 산 부품을 공임나라에 가져갈 때, 내 차 규격·순정 품번·산 상품을 한 화면에 모아 정비사에게 보여 주세요. 가기 전에 전화로 물어볼 문장도 만들어 드려요.",
  path: "/shop-card",
})

export default function Page() {
  const cars: ShopCardCar[] = seoCars().map((c) => ({
    id: c.id,
    brand: c.brand,
    label: `${c.model} ${c.generation.replace(/\s*\(.*?\)\s*/g, "")} · ${c.yearRange}`,
    name: carShortName(c),
    engines: c.engineTypes,
    parts: c.parts.map((p) => ({
      slug: partSlug(c, p),
      name: p.name,
      spec: p.spec,
      partNumber: p.partNumber?.replace(/\s*\(순정 품번\)/g, ""),
      engine: p.engine,
      pick: coupangPickFor(p)?.name,
    })),
  }))
  return (
    <div className="mx-auto max-w-2xl px-5 pb-6 pt-6 sm:pt-10">
      <Breadcrumbs items={[{ href: "/", label: "정비핵" }, { href: "/my", label: "마이" }, { label: "정비소에 보여주기" }]} />
      <h1 className="text-[26px] font-extrabold leading-[1.3] sm:text-[34px]">정비소에 보여줄 부품 리스트</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">공임나라에 부품을 가져갈 때 이 화면을 보여 주세요</p>
      <div className="mt-6">
        <ShopCardPage cars={cars} />
      </div>
    </div>
  )
}

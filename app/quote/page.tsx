import { pageMetadata, seoCars, carShortName } from "@/lib/seo"
import { Breadcrumbs } from "@/components/seo/Shared"
import { QuotePage, type QuoteCar } from "@/components/quote/QuotePage"
import { yearsOf } from "@/lib/years"

export const metadata = pageMetadata({
  title: "정비소 견적서 사진으로 공임나라에서 아낄 항목 찾기 | 정비핵",
  description:
    "오토큐·블루핸즈 견적서나 점검내역 사진을 올리면 공임나라로 돌릴 만한 항목과 센터에서 할 항목을 나눠 주고, 직접 구매 시 비용을 보여 드려요. 사진은 저장하지 않아요.",
  path: "/quote",
})

export default function Page() {
  const cars: QuoteCar[] = seoCars().map((c) => ({
    id: c.id,
    brand: c.brand,
    label: `${c.model} ${c.generation.replace(/\s*\(.*?\)\s*/g, "")} · ${c.yearRange}`,
    name: carShortName(c),
    years: yearsOf(c.yearRange),
    engines: c.engineTypes,
  }))
  return (
    <div className="mx-auto max-w-2xl px-5 pb-6 pt-6 sm:pt-10">
      <Breadcrumbs items={[{ href: "/", label: "정비핵" }, { label: "견적서 분석" }]} />
      <h1 className="text-[26px] font-extrabold leading-[1.3] sm:text-[34px]">견적서 찍으면, 아낄 수 있는 돈을 알려 드려요</h1>
      <div className="mt-6">
        <QuotePage cars={cars} />
      </div>
    </div>
  )
}

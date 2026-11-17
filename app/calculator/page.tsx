import { CalculatorPage } from "@/components/calculator/CalculatorPage"
import { findCarByModelName } from "@/lib/data/cars"
import { pageMetadata } from "@/lib/seo"

// ?model=·?part= 주소가 여러 개로 퍼지지 않게 canonical은 /calculator 하나로
export const metadata = pageMetadata({
  title: "자동차 정비 비용 계산기 · 쿠팡 부품 + 공임나라 공임 합계 | 정비핵",
  description:
    "차종을 고르고 교체할 소모품을 체크하면 쿠팡 부품값과 공임나라 표준 공임을 더한 예상 정비비를 공식 서비스센터 견적과 비교해 보여 줍니다.",
  path: "/calculator",
})

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CalculatorRoute(props: Props) {
  const searchParams = await props.searchParams
  const modelParam = typeof searchParams.model === "string" ? searchParams.model : undefined
  const partParam = typeof searchParams.part === "string" ? searchParams.part : undefined
  const yearParam = typeof searchParams.year === "string" ? searchParams.year : undefined

  const initialCarId = modelParam ? findCarByModelName(modelParam, yearParam)?.id : undefined

  return (
    <CalculatorPage
      initialCarId={initialCarId}
      initialPartKeyword={partParam}
      isFromVerify={Boolean(modelParam)}
      initialModelQuery={modelParam}
    />
  )
}

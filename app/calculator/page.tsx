import { CalculatorPage } from "@/components/calculator/CalculatorPage"
import { findCarByModelName } from "@/lib/data/cars"

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

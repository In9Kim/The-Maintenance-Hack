import { pageMetadata, seoCars, carShortName, partSlug } from "@/lib/seo"
import { Breadcrumbs, JsonLd } from "@/components/seo/Shared"
import { CheckPage, type CheckCar } from "@/components/check/CheckPage"
import { RecallFaq, faqJsonLd } from "@/components/recalls/RecallParts"
import { coupangPickFor } from "@/lib/coupang-links"
import { yearsOf } from "@/lib/years"
import { PER_USER } from "@/lib/verify-limit"

export const metadata = pageMetadata({
  title: "이 부품 내 차에 맞을까? 차종·연식으로 쿠팡 상품 호환 확인 | 정비핵",
  description:
    "차종과 연식을 고르고 쿠팡에서 공유한 상품을 붙여 넣으면, 제조사 취급설명서 기준 규격·순정 품번과 대조해 내 차에 맞는지 AI가 알려 줍니다. 차종별로 맞는 상품과 가격도 바로 보여 드려요.",
  path: "/check",
})

const FAQ = [
  {
    q: "쿠팡 상품은 어떻게 넣나요?",
    a: "쿠팡 앱 상품 화면에서 공유 버튼을 누르고 '복사'를 고른 뒤, 이 페이지 입력칸에 붙여 넣으면 돼요. 상품 링크나 상품명·품번만 적어도 돼요.",
  },
  {
    q: "판정 결과를 그대로 믿어도 되나요?",
    a: "참고용이에요. 고른 차종·연식·엔진과 정비핵의 규격 데이터, 상품명을 AI가 대조한 결과라 틀릴 수 있어요. '확인 필요'가 나오거나 비싼 부품이면 판매자에게 한 번 더 물어보세요.",
  },
  {
    q: "하루에 몇 번 쓸 수 있나요?",
    a: `AI 판정은 로그인하면 계정마다 하루 ${PER_USER}번까지예요. 상품 검색·쿠팡 보기는 로그인 없이 돼요. 다른 사람이 이미 확인한 같은 차·같은 상품 조합은 횟수와 상관없이 바로 보여 드려요.`,
  },
  {
    q: "차대번호가 필요한가요?",
    a: "아니요. 차종·연식·엔진만 고르면 돼요. 차대번호는 받지도 저장하지도 않아요.",
  },
]

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
      return k ? [{ part: p.name, engine: p.engine, name: k.name, price: k.price, date: k.checkedAt, url: k.url }] : []
    }),
  }))

  return (
    <div className="mx-auto max-w-2xl px-5 pb-6 pt-6 sm:pt-10">
      <Breadcrumbs items={[{ href: "/", label: "정비핵" }, { label: "부품 호환 확인" }]} />
      <h1 className="text-[26px] font-extrabold leading-[1.3] sm:text-[34px]">이 부품, 내 차에 맞을까?</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">차종·연식만 고르면 돼요. 차대번호는 필요 없어요</p>

      <div className="mt-6">
        <CheckPage cars={cars} />
      </div>

      <RecallFaq items={FAQ} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </div>
  )
}

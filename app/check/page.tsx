import Link from "next/link"
import { pageMetadata } from "@/lib/seo"
import { Breadcrumbs, JsonLd } from "@/components/seo/Shared"
import { CompatibilityChecker } from "@/components/CompatibilityChecker"
import { RecallFaq, faqJsonLd } from "@/components/recalls/RecallParts"
import { PER_USER } from "@/lib/verify-limit"

export const metadata = pageMetadata({
  title: "차대번호로 부품 호환 확인 - 사려는 필터·와이퍼·패드가 내 차에 맞는지 | 정비핵",
  description:
    "차대번호 17자리와 쿠팡·네이버 상품 링크(또는 상품명·품번)를 넣으면 내 차에 맞는 부품인지 AI가 대조해 알려 줍니다. 부품을 직접 사서 공임나라에 가기 전에 확인하세요. 차대번호는 저장하지 않습니다.",
  path: "/check",
})

const WHEN = [
  {
    t: "상품명에 연식이 애매하게 적혀 있을 때",
    d: "\"쏘렌토 20~23년식 호환\"처럼 넓게 적힌 상품이 많아요. 같은 차라도 엔진이나 부분변경 전후로 품번이 달라지기도 해요.",
  },
  {
    t: "중고차라 내 차 엔진·트림을 정확히 모를 때",
    d: "차대번호 안에 제조사, 차종, 연식, 엔진 정보가 들어 있어요. 등록증만 있으면 따로 알아볼 필요가 없어요.",
  },
  {
    t: "공임나라 예약 전, 헛걸음하기 싫을 때",
    d: "부품을 잘못 사 가면 교체를 못 하고 반품부터 해야 해요. 결제하기 전에 한 번 확인하면 그 일을 줄일 수 있어요.",
  },
  {
    t: "정비소 견적서에 적힌 부품을 직접 사려고 할 때",
    d: "견적서의 부품명이나 품번을 그대로 넣어 보세요. 인터넷에서 같은 규격을 찾을 때 기준이 돼요.",
  },
]

const FAQ = [
  {
    q: "차대번호는 어디서 보나요?",
    a: "자동차등록증의 '차대번호' 칸에 영문·숫자 17자리로 적혀 있어요. 차에서는 보통 앞유리 아래쪽이나 운전석 문을 열면 보이는 곳에 있고, 위치는 차종마다 달라요.",
  },
  {
    q: "차대번호를 넣어도 괜찮나요?",
    a: "차대번호는 저장하지 않아요. 판정 기록에는 되돌릴 수 없게 바꾼 값(해시)과 차종 정보만 남겨요. 차대번호만으로는 소유자 이름이나 주소를 알 수 없어요.",
  },
  {
    q: "판정 결과를 그대로 믿어도 되나요?",
    a: "참고용이에요. AI가 차대번호로 해석한 차량 정보와 상품 정보를 대조한 결과라 틀릴 수 있어요. '확인 필요'가 나오거나 비싼 부품이면 판매자에게 차대번호로 호환 여부를 한 번 더 물어보세요.",
  },
  {
    q: "하루에 몇 번 쓸 수 있나요?",
    a: `AI 판정은 한 사람당 하루 ${PER_USER}번까지예요. 다른 사람이 이미 확인한 같은 차·같은 상품 조합은 횟수와 상관없이 바로 보여 드려요. 한국 시간 자정에 다시 채워져요.`,
  },
  {
    q: "어떤 쇼핑몰 링크를 넣을 수 있나요?",
    a: "쿠팡, 네이버 등 상품 페이지 링크를 넣으면 상품명을 읽어 와요. 일부 쇼핑몰은 상품명을 읽을 수 없어서, 그때는 상품명이나 품번을 직접 적어 주세요.",
  },
]

export default function CheckPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-6 pt-6 sm:pt-10">
      <Breadcrumbs items={[{ href: "/", label: "정비핵" }, { label: "부품 호환 확인" }]} />

      <h1 className="text-[28px] font-extrabold leading-[1.3] sm:text-[36px]">이 부품, 내 차에 맞을까?</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground">
        차대번호와 사려는 상품 링크를 넣으면, 내 차에 맞는 부품인지 대조해 알려 드려요. 결제하기 전에 30초면 됩니다.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-6">
        <CompatibilityChecker heroMode />
      </div>

      <section className="mt-14">
        <h2 className="text-[20px] font-bold sm:text-[24px]">왜 만들었나요</h2>
        <div className="mt-3 space-y-3 text-[15px] leading-[1.8]">
          <p>
            공식센터 견적을 받아 보면 부품값이 인터넷 가격보다 훨씬 비싼 경우가 많아요. 부품을 직접 사서 공임나라 같은 곳에 교체만 맡기면
            그 차이를 아낄 수 있어요.
          </p>
          <p>
            그런데 막상 직접 사려고 하면 가장 큰 걱정은 <b>&ldquo;이거 잘못 사면 어떡하지?&rdquo;</b>예요. 같은 차 이름이라도 연식, 엔진,
            부분변경에 따라 부품이 달라지고, 상품 설명은 넓게 적혀 있어요. 잘못 사 가면 교체도 못 하고 반품부터 해야 해요.
          </p>
          <p>정비핵은 그 걱정을 줄이려고 만들었어요. 내 차 정보는 차대번호 하나에 다 들어 있으니, 그걸로 상품과 맞춰 보는 거예요.</p>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-[20px] font-bold sm:text-[24px]">이럴 때 쓰세요</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {WHEN.map((w) => (
            <li key={w.t} className="rounded-[14px] border border-border bg-card p-5">
              <p className="font-bold">{w.t}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{w.d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="text-[20px] font-bold sm:text-[24px]">이렇게 판정해요</h2>
        <ol className="mt-4 space-y-3">
          {[
            ["차대번호 해석", "앞 11자리로 제조사, 차종, 연식, 엔진을 알아내요. 같은 차대번호는 늘 같은 차량 정보로 판정해요."],
            ["상품 정보 읽기", "링크에서 상품명을 읽거나, 직접 적은 상품명·품번을 써요."],
            ["대조해서 결과 보여 주기", "호환 가능성 높음, 맞지 않을 가능성 높음, 확인 필요 중 하나로 알려 드려요. 이유도 함께 적어요."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3 rounded-[14px] border border-border bg-card p-4">
              <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[13px] font-bold text-background">
                {i + 1}
              </span>
              <span>
                <span className="block font-bold">{t}</span>
                <span className="mt-0.5 block text-[14px] leading-relaxed text-muted-foreground">{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
          내 차 규격을 먼저 알고 싶다면{" "}
          <Link href="/cars" className="font-semibold text-foreground underline underline-offset-4">
            차종별 소모품 규격
          </Link>
          에서 순정 품번과 규격을 볼 수 있어요.
        </p>
      </section>

      <RecallFaq items={FAQ} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </div>
  )
}

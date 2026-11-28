import Link from "next/link"
import { pageMetadata } from "@/lib/seo"
import { AFFILIATE_TEXT } from "@/components/seo/Shared"
import { allPartPhotos } from "@/lib/part-photos"

export const metadata = pageMetadata({
  title: "데이터 출처·이용 안내 | 정비핵",
  description: "정비핵의 규격·가격·리콜·정비소 정보가 어디서 왔는지, 가격을 어떻게 계산했는지 안내합니다.",
  path: "/info",
})

const SOURCES = [
  { k: "규격·교체 주기", v: "제조사 취급설명서" },
  { k: "부품값·공임·공식센터 가격", v: "시세를 바탕으로 한 추정치. 실제 영수증으로 확인한 것은 부품 페이지의 '실제로 달아 본 상품'에 따로 표시" },
  { k: "리콜", v: "국토교통부·자동차리콜센터" },
  { k: "정비소·세차장 위치", v: "카카오 로컬" },
]

const TOOLS = [
  { href: "/cars", label: "차종별 정비 비용" },
  { href: "/calculator", label: "정비 비용 계산기" },
  { href: "/check", label: "이 부품 내 차에 맞을까? (AI 확인)" },
  { href: "/near/carwash", label: "근처 세차장" },
]

export default function InfoPage() {
  const photos = allPartPhotos()
  return (
    <div className="mx-auto max-w-2xl px-5 pb-12 pt-6 sm:pt-10">
      <h1 className="text-[24px] font-extrabold">데이터 출처·이용 안내</h1>

      <dl className="mt-6 divide-y divide-border rounded-[14px] border border-border bg-card">
        {SOURCES.map((s) => (
          <div key={s.k} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-[14px] font-semibold">{s.k}</dt>
            <dd className="text-[14px] text-muted-foreground">{s.v}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8">
        <h2 className="text-[17px] font-bold">가격 안내</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          부품 가격·공임은 참고용 예상치이며 실제 구매·정비 때 다를 수 있어요. 공식센터 금액은 부품값과 공임에 센터 마진을 반영해 계산한 추정치예요.
        </p>
        <p className="mt-2 rounded-[10px] bg-muted px-4 py-3 text-[13px] text-muted-foreground">{AFFILIATE_TEXT}</p>
      </section>

      {photos.length > 0 && (
        <section id="part-photos" className="mt-8 scroll-mt-20">
          <h2 className="text-[17px] font-bold">부품 사진 출처</h2>
          <ul className="mt-2 divide-y divide-border rounded-[14px] border border-border bg-card">
            {photos.map((p) => (
              <li key={p.kind} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
                <span className="break-keep text-[14px] font-semibold">{p.label}</span>
                <span className="break-keep text-[13px] leading-relaxed text-muted-foreground">
                  <a href={p.page} target="_blank" rel="noopener nofollow" className="underline underline-offset-2 hover:text-foreground">
                    {p.author}
                  </a>
                  {" · "}
                  {p.licenseUrl ? (
                    <a href={p.licenseUrl} target="_blank" rel="noopener nofollow license" className="underline underline-offset-2 hover:text-foreground">
                      {p.license}
                    </a>
                  ) : (
                    p.license
                  )}
                  {" · Wikimedia Commons"}
                  {p.edited ? ` (정비핵이 ${p.edited})` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-[17px] font-bold">다른 도구</h2>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {TOOLS.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="flex min-h-[44px] items-center rounded-[10px] border border-border bg-card px-3 text-[14px] font-semibold hover:border-primary/50">
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-[12px] text-muted-foreground">© 2026 정비핵 (The Maintenance Hack)</p>
    </div>
  )
}

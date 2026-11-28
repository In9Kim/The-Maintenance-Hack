import { pageMetadata } from "@/lib/seo"
import { MorePage } from "@/components/more/MorePage"

export const metadata = pageMetadata({
  title: "더보기 | 정비핵",
  description: "로그인·알림 설정과 견적서 분석·부품 확인·리콜 확인·정비비 계산기, 데이터 출처와 개인정보 처리방침.",
  path: "/more",
  robots: { index: false, follow: true },
})

export default function Page() {
  return <MorePage />
}

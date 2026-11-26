import type { Metadata, Viewport } from "next"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { BottomNav } from "@/components/layout/BottomNav"
import { RecallBanner } from "@/components/layout/RecallBanner"
import { carRecallAlerts } from "@/lib/recalls/car-alert"
import { TrackFrom } from "@/components/seo/TrackFrom"
import { WebAnalytics } from "@/components/seo/WebAnalytics"
import "./globals.css"
import { SITE_URL } from "@/lib/seo"

export const metadata: Metadata = {
  title: "정비핵 - 자동차 정비 비용 계산기",
  description:
    "공임나라 + 쿠팡 조합으로 공식 서비스 센터 대비 최대 60% 절약. 차종별 소모품 규격 자동 조회 및 최저가 부품 링크 제공.",
  keywords: ["자동차 정비", "공임나라", "쿠팡", "브레이크패드", "엔진오일", "정비 비용"],
  metadataBase: new URL(SITE_URL),
  // 구글 서치콘솔 / 네이버 서치어드바이저 소유 확인 (HTML 태그 방식의 content 값만 환경변수에 넣으면 됨)
  verification: {
    // 확인 코드는 공개되는 값이라 코드에 둬도 됨 (환경변수가 있으면 그 값 우선)
    google: process.env.GOOGLE_SITE_VERIFICATION || "ZryKbedW7fZaETe8XMndNVYhb0oUfSzHwg_VvBw6DYo",
    other: {
      "naver-site-verification": process.env.NAVER_SITE_VERIFICATION || "bfcd854eaa8b45ecf8ff448314396874339da11b",
    },
  },
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 차를 등록한 사람이면 첫 화면을 그리기 전에 표시 (첫 화면 예시 ↔ 내 차 전환이 깜빡이지 않게, components/home/HomeMyCar.tsx) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var g=JSON.parse(localStorage.getItem("mh_garage")||"null");if((g&&g.cars&&g.cars.length)||localStorage.getItem("mh_my_car"))document.documentElement.dataset.car="1"}catch(e){}`,
          }}
        />
        {/* Pretendard: 한글 본문·숫자 정렬용 (쓰는 글자만 내려받는 동적 서브셋, 워커 크기와 무관) */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* metadata.alternates는 페이지별 canonical 설정이 덮어써서 RSS 링크는 여기 직접 둔다 */}
        <link rel="alternate" type="application/rss+xml" title="정비핵 최근 리콜·차종 정보" href={`${SITE_URL}/rss.xml`} />
        {/* 구글 애드센스 (사이트 소유 확인 + 승인 후 광고). 광고 위치는 애드센스 화면에서 관리 */}
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8012730685624274" crossOrigin="anonymous" />
      </head>
      <body className="pb-[calc(57px+env(safe-area-inset-bottom))] md:pb-0">
        <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow">
          본문 바로가기
        </a>
        <RecallBanner alerts={carRecallAlerts()} />
        <Header />
        <TrackFrom />
        <WebAnalytics />
        <main id="content" className="min-h-[calc(100vh-3.5rem)]">{children}</main>
        <SiteFooter />
        <BottomNav />
      </body>
    </html>
  )
}

function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-5 py-5 text-[13px] text-muted-foreground">
        <span>© 2026 정비핵</span>
        <Link className="hover:text-foreground hover:underline" href="/info">데이터 출처·이용 안내</Link>
        <span>가격은 참고용 추정치예요</span>
      </div>
    </footer>
  )
}

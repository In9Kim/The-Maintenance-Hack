import type { Metadata, Viewport } from "next"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { BottomNav } from "@/components/layout/BottomNav"
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
    <html lang="ko">
      <head>
        {/* Pretendard: 한글 본문·숫자 정렬용 (쓰는 글자만 내려받는 동적 서브셋, 워커 크기와 무관) */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* metadata.alternates는 페이지별 canonical 설정이 덮어써서 RSS 링크는 여기 직접 둔다 */}
        <link rel="alternate" type="application/rss+xml" title="정비핵 최근 리콜·차종 정보" href={`${SITE_URL}/rss.xml`} />
      </head>
      <body className="pb-[calc(57px+env(safe-area-inset-bottom))] md:pb-0">
        <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow">
          본문 바로가기
        </a>
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
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-10 text-sm sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="text-base font-bold">정비핵</p>
          <p className="mt-2 max-w-xs leading-relaxed text-muted-foreground">
            정비소 견적을 부품값과 공임으로 나눠 보고, 직접 사서 맡기면 얼마인지 계산해 주는 차주용 도구입니다.
          </p>
        </div>
        <nav aria-label="바로가기">
          <p className="font-semibold">바로가기</p>
          <ul className="mt-2 space-y-1.5 text-muted-foreground">
            <li><Link className="hover:text-foreground hover:underline" href="/cars">차종별 정비 비용</Link></li>
            <li><Link className="hover:text-foreground hover:underline" href="/calculator">정비 비용 계산기</Link></li>
            <li><Link className="hover:text-foreground hover:underline" href="/recalls">리콜 정보</Link></li>
            <li><Link className="hover:text-foreground hover:underline" href="/near">근처 공임나라·정비소</Link></li>
            <li><Link className="hover:text-foreground hover:underline" href="/near/carwash">근처 세차장</Link></li>
            <li><Link className="hover:text-foreground hover:underline" href="/check">차대번호로 부품 호환 확인</Link></li>
            <li><Link className="hover:text-foreground hover:underline" href="/my">내 차 교체 시기 관리</Link></li>
          </ul>
        </nav>
        <div>
          <p className="font-semibold">데이터 출처</p>
          <ul className="mt-2 space-y-1.5 text-muted-foreground">
            <li>규격·교체 주기: 제조사 취급설명서</li>
            <li>부품값·공임·공식센터 가격: 시세를 바탕으로 한 추정치 (실제 영수증으로 확인한 것은 "실제로 달아 본 상품"에 따로 표시)</li>
            <li>리콜: 국토교통부·자동차리콜센터</li>
            <li>정비소·세차장 위치: 카카오 로컬</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-5xl px-5 py-4 text-xs text-muted-foreground">
          부품 가격·공임은 참고용 예상치이며 실제 구매 시 다를 수 있습니다. © 2026 정비핵 (The Maintenance Hack)
        </p>
      </div>
    </footer>
  )
}

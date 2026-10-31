import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Header } from "@/components/layout/Header"
import "./globals.css"
import { SITE_URL } from "@/lib/seo"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "정비핵 - 자동차 정비 비용 계산기",
  description:
    "공임나라 + 쿠팡 조합으로 공식 서비스 센터 대비 최대 60% 절약. 차종별 소모품 규격 자동 조회 및 최저가 부품 링크 제공.",
  keywords: ["자동차 정비", "공임나라", "쿠팡", "브레이크패드", "엔진오일", "정비 비용"],
  metadataBase: new URL(SITE_URL),
  // 구글 서치콘솔 / 네이버 서치어드바이저 소유 확인 (HTML 태그 방식의 content 값만 환경변수에 넣으면 됨)
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NAVER_SITE_VERIFICATION
      ? { "naver-site-verification": process.env.NAVER_SITE_VERIFICATION }
      : undefined,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="dark">
      <body className={inter.className}>
        <Header />
        <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
        <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
          <p>
            정비핵 · 부품 가격은 예시이며 실제 구매 시 가격이 다를 수 있습니다.
          </p>
          <p className="mt-1 text-muted-foreground/60">
            © 2026 The Maintenance Hack
          </p>
        </footer>
      </body>
    </html>
  )
}

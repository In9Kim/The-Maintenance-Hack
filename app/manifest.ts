import type { MetadataRoute } from "next"

/** 홈 화면에 추가·안드로이드 앱(TWA, android/)이 쓰는 웹 앱 정보 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "정비핵 - 자동차 정비 비용 계산기",
    short_name: "정비핵",
    description: "차종별 소모품 규격과 부품값·공임을 한 번에. 견적서가 비싼지 확인하고 부품은 쿠팡에서 직접 사세요.",
    start_url: "/?from=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F7FA",
    theme_color: "#14213D",
    lang: "ko",
    categories: ["auto", "utilities", "shopping"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}

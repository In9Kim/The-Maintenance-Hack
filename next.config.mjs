/** @type {import('next').NextConfig} */
const nextConfig = {
  // 메타데이터(설명·OG)를 본문으로 늦게 흘려보내지 않고 <head>에 바로 넣는다 (계산기처럼 주소 값을 읽는 페이지 포함)
  htmlLimitedBots: /.*/,
}

export default nextConfig

// 로컬 `next dev`에서도 Cloudflare 바인딩을 쓸 수 있게 함
import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev())

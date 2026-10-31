/** @type {import('next').NextConfig} */
const nextConfig = {}

export default nextConfig

// 로컬 `next dev`에서도 Cloudflare 바인딩을 쓸 수 있게 함
import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev())

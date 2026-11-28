import { pageMetadata } from "@/lib/seo"
import { InboxPage } from "@/components/inbox/InboxPage"

export const metadata = pageMetadata({
  title: "알림함 | 정비핵",
  description: "이 폰에서 받은 교체 시기 알림을 다시 볼 수 있어요.",
  path: "/inbox",
  robots: { index: false, follow: false },
})

export default function Page() {
  return <InboxPage />
}

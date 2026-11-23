import { pageMetadata } from "@/lib/seo"
import { nearKind } from "@/lib/near"
import { NearPage } from "@/components/near/NearPage"

const kind = nearKind("gongim")!

export const metadata = pageMetadata({ title: `${kind.title} | 정비핵`, description: kind.description, path: "/near" })

export default function Page() {
  return <NearPage kind={kind} />
}

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { pageMetadata } from "@/lib/seo"
import { NEAR_KINDS, nearKind } from "@/lib/near"
import { NearPage } from "@/components/near/NearPage"

export const dynamicParams = false

/** 공임나라는 /near 가 대표 주소 */
export function generateStaticParams() {
  return NEAR_KINDS.filter((k) => k.slug !== "gongim").map((k) => ({ kind: k.slug }))
}

type Props = { params: Promise<{ kind: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const k = nearKind((await params).kind)
  if (!k || k.slug === "gongim") return {}
  return pageMetadata({ title: `${k.title} | 정비핵`, description: k.description, path: `/near/${k.slug}` })
}

export default async function Page({ params }: Props) {
  const k = nearKind((await params).kind)
  if (!k || k.slug === "gongim") notFound()
  return <NearPage kind={k} />
}

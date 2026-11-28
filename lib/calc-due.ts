/**
 * 정비비 계산기: 등록한 내 차의 교체 시기 목록(dueList 결과)에서 '갈 때 된 부품'(지남·곧)을
 * 계산기 부품 id로 바꾼다. (정비 탭과 같은 기준)
 */
import type { PartDue } from "./my-car"

interface CarLike {
  id: string
  parts: { id: string }[]
}

/** lib/seo.ts partSlug 와 같은 규칙: "kia-k3-bd-engine-oil" → "engine-oil" */
const slugOf = (carId: string, partId: string) =>
  partId.startsWith(`${carId}-`) ? partId.slice(carId.length + 1) : partId

/** 갈 때 된 부품(지남·곧)의 상태 글자 (정비 탭과 같은 '3개월 지남'·'2,500km 남음'), 계산기 부품 id → 글자 */
export function dueTexts(due: Pick<PartDue, "state" | "part" | "text">[], car: CarLike): Record<string, string> {
  const bySlug = new Map(due.filter((d) => d.state === "over" || d.state === "soon").map((d) => [d.part.slug, d.text]))
  const out: Record<string, string> = {}
  for (const p of car.parts) {
    const t = bySlug.get(slugOf(car.id, p.id))
    if (t) out[p.id] = t
  }
  return out
}

export function duePartIds(due: Pick<PartDue, "state" | "part">[], car: CarLike): string[] {
  const slugs = new Set(due.filter((d) => d.state === "over" || d.state === "soon").map((d) => d.part.slug))
  if (!slugs.size) return []
  return car.parts.filter((p) => slugs.has(slugOf(car.id, p.id))).map((p) => p.id)
}

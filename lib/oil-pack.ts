/**
 * 오일 상품명에서 한 번에 오는 양(L) 읽기와 '얼마나 더 사야 하는지' 안내.
 * 예: '4L' → 4, '1L x 6개' → 6, '1L 4개' → 4. 못 읽으면 null.
 */
export function packLiters(name: string): number | null {
  const m = name.match(/(\d+(?:\.\d+)?)\s*(?:L|리터)(?![a-z])/i)
  if (!m) return null
  const one = Number(m[1])
  if (!(one > 0) || one > 30) return null
  const rest = name.slice((m.index ?? 0) + m[0].length)
  const n = rest.match(/^\s*(?:[x×X*]\s*(\d{1,2})|(\d{1,2})\s*(?:개|통|병|ea|EA))/)
  const count = n ? Number(n[1] ?? n[2]) : 1
  return Math.round(one * count * 10) / 10
}

/** 필요량 안내 한 줄 (계산할 수 없으면 '모자란 만큼 더 사세요') */
export function oilNeedText(need: number, productName: string): string {
  const pack = packLiters(productName)
  if (pack == null) return `필요량은 ${need}L예요. 용량이 모자라면 모자란 만큼 더 사세요.`
  if (pack >= need) return `필요량은 ${need}L라 이 상품 하나면 돼요.`
  const more = Math.ceil((need - pack) * 10) / 10
  return `필요량은 ${need}L인데 이 상품은 ${pack}L라 ${more}L 더 필요해요.`
}

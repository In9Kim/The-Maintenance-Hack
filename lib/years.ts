/** "2018~2024" / "2020~현재" → 연식 목록 (최근 연식 먼저) */
export function yearsOf(range: string): number[] {
  const m = range.match(/(\d{4})\s*~\s*(\d{4}|현재)/)
  if (!m) return []
  const from = Number(m[1])
  const to = m[2] === "현재" ? new Date().getFullYear() + 1 : Number(m[2])
  return Array.from({ length: to - from + 1 }, (_, i) => to - i)
}

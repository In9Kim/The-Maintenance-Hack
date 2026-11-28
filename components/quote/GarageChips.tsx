"use client"

import type { GarageChip } from "@/lib/quote-saved"

/** 등록한 차가 여러 대일 때 드롭다운 대신 한 번에 고르는 칩 (견적서 분석·부품 확인에서 같이 씀) */
export function GarageChips({ chips, current, onPick }: { chips: GarageChip[]; current?: string; onPick: (c: GarageChip) => void }) {
  if (chips.length === 0) return null
  return (
    <div className="mb-3">
      <p className="text-[13px] font-semibold text-muted-foreground">등록한 차</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {chips.map((c) => {
          const on = c.key === current
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onPick(c)}
              aria-pressed={on}
              className={`min-h-[40px] max-w-full truncate whitespace-nowrap rounded-full border px-3.5 text-[14px] font-semibold ${
                on ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"
              }`}
            >
              {c.name}
              {c.year && <span className="num ml-1 font-normal text-muted-foreground">{c.year}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

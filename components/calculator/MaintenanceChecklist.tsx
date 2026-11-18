"use client"

import { useMemo } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn, formatPrice } from "@/lib/utils"
import { CATEGORY_LABELS, type MaintenancePart, type PartCategory } from "@/types"
import { intervalText } from "@/lib/seo"
import type { CarModel } from "@/types"


interface MaintenanceChecklistProps {
  car: CarModel
  selectedParts: Set<string>
  onToggle: (partId: string) => void
  onSelectAll: () => void
  onClearAll: () => void
}

export function MaintenanceChecklist({
  car,
  selectedParts,
  onToggle,
  onSelectAll,
  onClearAll,
}: MaintenanceChecklistProps) {
  // 카테고리별로 파츠 그룹화
  const grouped = useMemo(() => {
    const map = new Map<PartCategory, MaintenancePart[]>()
    for (const part of car.parts) {
      if (!map.has(part.category)) map.set(part.category, [])
      map.get(part.category)!.push(part)
    }
    return map
  }, [car.parts])

  const allSelected = selectedParts.size === car.parts.length
  const anySelected = selectedParts.size > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-bold">
          바꿀 소모품 {anySelected && <span className="num text-primary">{selectedParts.size}개</span>}
        </h2>
        <button
          onClick={allSelected ? onClearAll : onSelectAll}
          className="min-h-[44px] rounded-lg px-3 text-[14px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {allSelected ? "전체 해제" : "전체 선택"}
        </button>
      </div>
      <div className="space-y-5">
        {Array.from(grouped.entries()).map(([category, parts]) => (
          <div key={category}>
            <p className="mb-2 text-[13px] font-semibold text-muted-foreground">{CATEGORY_LABELS[category]}</p>
            <div className="space-y-2">
              {parts.map((part) => (
                <PartCard key={part.id} part={part} isChecked={selectedParts.has(part.id)} onToggle={() => onToggle(part.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface PartCardProps {
  part: MaintenancePart
  isChecked: boolean
  onToggle: () => void
}

function PartCard({ part, isChecked, onToggle }: PartCardProps) {
  const self = part.coupangPrice + part.laborCost
  const dealer = part.dealerPartPrice + part.dealerLaborCost
  const interval = intervalText(part)
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-[12px] border px-4 py-3.5 transition-colors",
        isChecked ? "border-primary bg-emerald-50/60" : "border-border bg-card hover:border-input"
      )}
    >
      <Checkbox checked={isChecked} onCheckedChange={onToggle} aria-label={part.name} className="mt-0.5 h-5 w-5" />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="font-semibold">{part.name}</span>
          <span className="num shrink-0 text-right">
            <span className="block font-bold text-primary">{formatPrice(self)}</span>
            <span className="price-was block text-[12px]">{formatPrice(dealer)}</span>
          </span>
        </span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
          {part.spec}
          {interval && <span className="whitespace-nowrap"> · {interval}마다</span>}
        </span>
      </span>
    </label>
  )
}

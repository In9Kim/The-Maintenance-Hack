"use client"

import { useMemo } from "react"
import {
  Droplets,
  Filter,
  Disc,
  Wind,
  Zap,
  Battery,
  Link2,
  Beaker,
  RefreshCw,
  Clock,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { cn, formatPrice } from "@/lib/utils"
import { CATEGORY_LABELS, CATEGORY_COLORS, type MaintenancePart, type PartCategory } from "@/types"
import type { CarModel } from "@/types"

const CATEGORY_ICONS: Record<PartCategory, React.ElementType> = {
  oil: Droplets,
  filter: Filter,
  brake: Disc,
  wiper: Wind,
  spark: Zap,
  battery: Battery,
  belt: Link2,
  fluid: Beaker,
}

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
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
            2
          </div>
          <h2 className="text-base font-semibold">정비 항목 선택</h2>
          {anySelected && (
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
              {selectedParts.size}개 선택
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={allSelected ? onClearAll : onSelectAll}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {allSelected ? "전체 해제" : "전체 선택"}
          </button>
        </div>
      </div>

      {/* 카테고리별 아이템 리스트 */}
      <div className="space-y-5">
        {Array.from(grouped.entries()).map(([category, parts]) => {
          const Icon = CATEGORY_ICONS[category]
          return (
            <div key={category}>
              {/* 카테고리 헤더 */}
              <div className="mb-2 flex items-center gap-2">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", CATEGORY_COLORS[category])}>
                  <Icon className="h-3 w-3" />
                  {CATEGORY_LABELS[category]}
                </span>
                <Separator className="flex-1" />
              </div>

              {/* 파츠 카드 리스트 */}
              <div className="space-y-2">
                {parts.map((part) => {
                  const isChecked = selectedParts.has(part.id)
                  const subtotal = part.coupangPrice + part.laborCost

                  return (
                    <PartCard
                      key={part.id}
                      part={part}
                      isChecked={isChecked}
                      subtotal={subtotal}
                      onToggle={() => onToggle(part.id)}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface PartCardProps {
  part: MaintenancePart
  isChecked: boolean
  subtotal: number
  onToggle: () => void
}

function PartCard({ part, isChecked, subtotal, onToggle }: PartCardProps) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        "group relative flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3.5 transition-all duration-150",
        isChecked
          ? "border-primary/40 bg-primary/5 shadow-sm shadow-primary/10"
          : "border-border bg-card hover:border-border/80 hover:bg-accent/30"
      )}
    >
      {/* 체크박스 */}
      <div className="mt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isChecked}
          onCheckedChange={onToggle}
          aria-label={part.name}
        />
      </div>

      {/* 항목 정보 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={cn("text-sm font-medium", isChecked && "text-foreground")}>
              {part.name}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{part.spec}</p>
          </div>

          {/* 소계 */}
          <div className="shrink-0 text-right">
            <p className={cn("text-sm font-semibold tabular-nums", isChecked ? "text-primary" : "text-foreground")}>
              {formatPrice(subtotal)}
            </p>
            <p className="text-xs text-muted-foreground">소계</p>
          </div>
        </div>

        {/* 가격 브레이크다운 */}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            부품 {formatPrice(part.coupangPrice)}
          </span>
          <span>+</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            공임 {part.laborCost === 0 ? "셀프 교체" : formatPrice(part.laborCost)}
          </span>

          {/* 교체 주기 */}
          {(part.intervalKm || part.intervalMonths) && (
            <span className="ml-auto flex items-center gap-1 text-muted-foreground/60">
              <RefreshCw className="h-2.5 w-2.5" />
              {part.intervalKm
                ? `${(part.intervalKm / 1000).toFixed(0)}만km`
                : ""}
              {part.intervalKm && part.intervalMonths ? " / " : ""}
              {part.intervalMonths ? (
                <span className="flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {part.intervalMonths}개월
                </span>
              ) : null}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

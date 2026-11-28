"use client"

import { useMemo, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn, formatPrice } from "@/lib/utils"
import { CATEGORY_LABELS, type MaintenancePart, type PartCategory } from "@/types"
import { intervalText } from "@/lib/seo"
import { cardIntervalText, splitChecklistParts } from "@/lib/checklist-order"
import type { CarModel } from "@/types"


interface MaintenanceChecklistProps {
  car: CarModel
  selectedParts: Set<string>
  onToggle: (partId: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  /** 내 차에서 갈 때 된 부품 id (정비 탭 기준 지남·곧). 맨 위에 보여 줌 */
  dueIds?: string[]
  /** 등록한 내 차를 고른 상태인지 */
  hasMyCar?: boolean
  /** 주소 ?part= 로 미리 체크된 부품 id. 맨 위에 보여 줌 (접힌 목록에 숨지 않게) */
  pinIds?: string[]
  /** 갈 때 된 부품의 상태 글자 ('3개월 지남'). 카드의 교체 주기 자리에 보여 줌 */
  dueTexts?: Record<string, string>
}

export function MaintenanceChecklist({
  car,
  selectedParts,
  onToggle,
  onSelectAll,
  onClearAll,
  dueIds,
  hasMyCar,
  pinIds,
  dueTexts,
}: MaintenanceChecklistProps) {
  const [showRest, setShowRest] = useState(false)

  // 위: 갈 때 된 부품 또는 많이 찾는 부품 / 아래: 나머지(접힘)
  const { top, rest } = useMemo(() => splitChecklistParts(car.parts, { dueIds, hasMyCar, pinIds }), [car.parts, dueIds, hasMyCar, pinIds])

  // 접힌 목록만 분류별로 묶음
  const grouped = useMemo(() => {
    const map = new Map<PartCategory, MaintenancePart[]>()
    for (const part of rest) {
      if (!map.has(part.category)) map.set(part.category, [])
      map.get(part.category)!.push(part)
    }
    return map
  }, [rest])

  const allSelected = selectedParts.size === car.parts.length
  const anySelected = selectedParts.size > 0
  const restChecked = rest.filter((p) => selectedParts.has(p.id)).length

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
      <div className="space-y-2">
        {top.map((part) => (
          <PartCard key={part.id} part={part} isChecked={selectedParts.has(part.id)} onToggle={() => onToggle(part.id)} dueText={dueTexts?.[part.id]} />
        ))}
      </div>
      {rest.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowRest((v) => !v)}
            aria-expanded={showRest}
            className="flex min-h-[44px] w-full items-center justify-center gap-1 rounded-[10px] border border-border bg-card px-3 text-[14px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <span className="whitespace-nowrap">{showRest ? "다른 부품 접기" : `다른 부품 ${rest.length}개 더 보기`}</span>
            {!showRest && restChecked > 0 && <span className="whitespace-nowrap text-primary">· {restChecked}개 고름</span>}
          </button>
          {showRest && (
            <div className="space-y-5">
              {Array.from(grouped.entries()).map(([category, parts]) => (
                <div key={category}>
                  <p className="mb-2 text-[13px] font-semibold text-muted-foreground">{CATEGORY_LABELS[category]}</p>
                  <div className="space-y-2">
                    {parts.map((part) => (
                      <PartCard key={part.id} part={part} isChecked={selectedParts.has(part.id)} onToggle={() => onToggle(part.id)} dueText={dueTexts?.[part.id]} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface PartCardProps {
  part: MaintenancePart
  isChecked: boolean
  onToggle: () => void
  /** 갈 때 된 부품이면 상태 글자 ('3개월 지남') — 왜 미리 체크됐는지 */
  dueText?: string
}

function PartCard({ part, isChecked, onToggle, dueText }: PartCardProps) {
  const [specOpen, setSpecOpen] = useState(false)
  const self = part.coupangPrice + part.laborCost
  const dealer = part.dealerPartPrice + part.dealerLaborCost
  const interval = cardIntervalText(intervalText(part))
  const spec = part.spec?.trim()
  return (
    <div
      className={cn(
        "rounded-[12px] border transition-colors",
        isChecked ? "border-primary bg-emerald-50/60" : "border-border bg-card hover:border-input"
      )}
    >
      <div className="flex items-start">
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 py-3.5 pl-4 pr-1">
          <Checkbox checked={isChecked} onCheckedChange={onToggle} aria-label={part.name} className="mt-0.5 h-5 w-5" />
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-3">
              <span className="break-keep font-semibold">{part.name}</span>
              <span className="num shrink-0 text-right">
                <span className="block font-bold text-primary">{formatPrice(self)}</span>
                <span className="price-was block whitespace-nowrap text-[12px]">센터 추정 {formatPrice(dealer)}</span>
              </span>
            </span>
            {dueText ? (
              <span className="mt-0.5 block whitespace-nowrap text-[13px] font-semibold text-[#B54708]">{dueText}</span>
            ) : (
              interval && <span className="mt-0.5 block whitespace-nowrap text-[13px] text-muted-foreground">{interval}</span>
            )}
          </span>
        </label>
        {spec && (
          // 규격은 (i)로만: label 밖이라 눌러도 체크가 바뀌지 않음
          <button
            type="button"
            onClick={() => setSpecOpen((v) => !v)}
            aria-expanded={specOpen}
            aria-label={`${part.name} 규격 보기`}
            className="flex h-11 w-10 shrink-0 items-center justify-center self-start text-muted-foreground hover:text-foreground"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      {spec && specOpen && <p className="-mt-1 pb-3 pl-12 pr-4 text-[13px] leading-relaxed text-muted-foreground">{spec}</p>}
    </div>
  )
}

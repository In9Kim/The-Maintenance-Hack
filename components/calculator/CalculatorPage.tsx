"use client"

import { useState, useMemo, useCallback } from "react"
import { CarSelector } from "./CarSelector"
import { MaintenanceChecklist } from "./MaintenanceChecklist"
import { CostDashboard } from "./CostDashboard"
import { Separator } from "@/components/ui/separator"
import { CAR_DATA } from "@/lib/data/cars"
import type { CarModel, CostSummary } from "@/types"
import type { GenerateCarInput } from "@/lib/gemini"

export function CalculatorPage() {
  const [selectedCarId, setSelectedCarId] = useState<string>(CAR_DATA[0]?.id ?? "")
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set())

  // AI로 생성된 차종을 세션 내 보관
  const [dynamicCars, setDynamicCars] = useState<CarModel[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // 정적 데이터 + 동적 데이터 병합
  const allCars = useMemo(() => [...CAR_DATA, ...dynamicCars], [dynamicCars])

  const selectedCar = useMemo(
    () => allCars.find((c) => c.id === selectedCarId),
    [allCars, selectedCarId]
  )

  function handleCarChange(carId: string) {
    setSelectedCarId(carId)
    setSelectedParts(new Set())
  }

  const handleToggle = useCallback((partId: string) => {
    setSelectedParts((prev) => {
      const next = new Set(prev)
      next.has(partId) ? next.delete(partId) : next.add(partId)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (!selectedCar) return
    setSelectedParts(new Set(selectedCar.parts.map((p) => p.id)))
  }, [selectedCar])

  const handleClearAll = useCallback(() => setSelectedParts(new Set()), [])

  // Gemini API 호출 → 동적 차종 생성. 성공 시 true 반환.
  const handleGenerateCar = useCallback(async (input: GenerateCarInput): Promise<boolean> => {
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch("/api/generate-car-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "데이터 생성에 실패했습니다.")

      const newCar: CarModel = data.car
      setDynamicCars((prev) =>
        prev.some((c) => c.id === newCar.id) ? prev : [...prev, newCar]
      )
      handleCarChange(newCar.id)
      return true
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "알 수 없는 오류")
      return false
    } finally {
      setIsGenerating(false)
    }
  }, [])

  // 비용 계산 (핵심 로직)
  const costSummary = useMemo((): CostSummary | null => {
    if (!selectedCar || selectedParts.size === 0) return null

    const checkedParts = selectedCar.parts.filter((p) => selectedParts.has(p.id))

    const items = checkedParts.map((part) => ({
      part,
      coupangSubtotal: part.coupangPrice + part.laborCost,
      dealerSubtotal: part.dealerPartPrice + part.dealerLaborCost,
    }))

    const coupangPartsTotal = checkedParts.reduce((s, p) => s + p.coupangPrice, 0)
    const coupangLaborTotal = checkedParts.reduce((s, p) => s + p.laborCost, 0)
    const coupangTotal = coupangPartsTotal + coupangLaborTotal

    const dealerPartsTotal = checkedParts.reduce((s, p) => s + p.dealerPartPrice, 0)
    const dealerLaborTotal = checkedParts.reduce((s, p) => s + p.dealerLaborCost, 0)
    const dealerTotal = dealerPartsTotal + dealerLaborTotal

    const savings = dealerTotal - coupangTotal
    const savingsPercent = Math.round((savings / dealerTotal) * 100)

    return {
      coupangPartsTotal,
      coupangLaborTotal,
      coupangTotal,
      dealerPartsTotal,
      dealerLaborTotal,
      dealerTotal,
      savings,
      savingsPercent,
      items,
    }
  }, [selectedCar, selectedParts])

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* 페이지 타이틀 */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">
          정비 비용{" "}
          <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
            계산기
          </span>
        </h1>
        <p className="mt-2 text-muted-foreground">
          공임나라 + 쿠팡 조합으로{" "}
          <span className="font-semibold text-primary">최대 60%</span>를 절약하세요
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* 왼쪽: 차량 선택 + 항목 체크리스트 */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <CarSelector
              allCars={allCars}
              selectedCarId={selectedCarId}
              onCarChange={handleCarChange}
              onGenerateCar={handleGenerateCar}
              isGenerating={isGenerating}
              generateError={generateError}
            />
          </div>

          {selectedCar ? (
            <div className="rounded-xl border border-border bg-card p-5">
              <MaintenanceChecklist
                car={selectedCar}
                selectedParts={selectedParts}
                onToggle={handleToggle}
                onSelectAll={handleSelectAll}
                onClearAll={handleClearAll}
              />
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              위에서 차량을 선택하면 정비 항목이 표시됩니다
            </div>
          )}
        </div>

        {/* 오른쪽: 비용 대시보드 (sticky) */}
        <div className="lg:sticky lg:top-[4.5rem] lg:h-fit">
          <div className="rounded-xl border border-border bg-card p-5">
            <CostDashboard car={selectedCar} summary={costSummary} />
          </div>
        </div>
      </div>

      {/* 하단 가이드 — 헤더 '가이드' 링크의 스크롤 타겟 */}
      <div id="guide-section" className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <GuideCard
          step="01"
          title="차량 선택"
          desc="내 차종과 세대를 선택하면 맞춤 부품 규격이 자동으로 로드됩니다. 없는 차종은 AI가 즉시 생성합니다."
        />
        <GuideCard
          step="02"
          title="항목 체크"
          desc="교체가 필요한 소모품을 선택하면 실시간으로 비용이 계산됩니다."
        />
        <GuideCard
          step="03"
          title="구매 & 예약"
          desc="쿠팡에서 직접 부품을 구매하고 공임나라에서 장착을 예약하세요."
        />
      </div>
    </div>
  )
}

function GuideCard({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="mb-2 text-xs font-bold text-primary">STEP {step}</p>
      <p className="mb-1.5 text-sm font-semibold">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  )
}

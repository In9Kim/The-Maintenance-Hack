"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { CarSelector } from "./CarSelector"
import { MaintenanceChecklist } from "./MaintenanceChecklist"
import { CostDashboard } from "./CostDashboard"
import { CAR_DATA } from "@/lib/data/cars"
import type { CarModel, CostSummary, PartCategory } from "@/types"
import type { GenerateCarInput } from "@/lib/gemini"

interface CalculatorPageProps {
  initialCarId?: string
  initialPartKeyword?: string
  /** 호환성 검증 페이지에서 넘어온 경우 true */
  isFromVerify?: boolean
  /** URL 쿼리의 원본 model 문자열 (매칭 실패 시 안내용) */
  initialModelQuery?: string
}

function inferCategory(keyword: string): PartCategory | null {
  const k = keyword.toLowerCase()
  if (k.includes("엔진오일")) return "oil"
  if (k.includes("브레이크오일") || (k.includes("브레이크") && k.includes("오일"))) return "fluid"
  if (k.includes("오일")) return "oil"
  if (k.includes("브레이크") || k.includes("패드")) return "brake"
  if (k.includes("에어클리너") || k.includes("캐빈") || k.includes("에어컨필터") || k.includes("필터")) return "filter"
  if (k.includes("와이퍼")) return "wiper"
  if (k.includes("점화플러그") || k.includes("플러그")) return "spark"
  if (k.includes("배터리")) return "battery"
  if (k.includes("벨트")) return "belt"
  if (k.includes("부동액") || k.includes("냉각수")) return "fluid"
  return null
}

export function CalculatorPage({
  initialCarId,
  initialPartKeyword,
  isFromVerify = false,
  initialModelQuery,
}: CalculatorPageProps = {}) {
  // URL 파라미터로 전달된 차종이 있으면 그것을, 없으면 빈 문자열(미선택 상태)
  const safeInitialCarId =
    initialCarId && CAR_DATA.some((c) => c.id === initialCarId)
      ? initialCarId
      : ""

  const [selectedCarId, setSelectedCarId] = useState<string>(safeInitialCarId)
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set())

  const [dynamicCars, setDynamicCars] = useState<CarModel[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generateInfo, setGenerateInfo] = useState<string | null>(null)

  const allCars = useMemo(() => [...CAR_DATA, ...dynamicCars], [dynamicCars])

  const selectedCar = useMemo(
    () => allCars.find((c) => c.id === selectedCarId),
    [allCars, selectedCarId]
  )

  const didPreCheck = useRef(false)

  // 마운트 시 전달받은 차량 정보 검증 로그
  useEffect(() => {
    const resolved = allCars.find((c) => c.id === selectedCarId)
    console.log("[Cost Calculator] 전달받은 차량 정보:", {
      queryModel: initialModelQuery ?? "(직접 접근)",
      resolvedCarId: selectedCarId || "(미매칭)",
      resolvedCarName: resolved
        ? `${resolved.brand} ${resolved.model} ${resolved.generation}`
        : "(선택 없음)",
      partKeyword: initialPartKeyword ?? "(없음)",
      fromVerify: isFromVerify,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (didPreCheck.current || !initialPartKeyword || !selectedCar) return
    didPreCheck.current = true

    const kw = initialPartKeyword.toLowerCase()
    const tokens = kw.split(/\s+/).filter((t) => t.length >= 2)

    // 1) 이름 직접 포함 여부
    let matched = selectedCar.parts.filter((p) =>
      tokens.some((t) => p.name.toLowerCase().includes(t))
    )

    // 2) 이름 매칭 없으면 카테고리로 폴백
    if (matched.length === 0) {
      const cat = inferCategory(kw)
      if (cat) matched = selectedCar.parts.filter((p) => p.category === cat)
    }

    if (matched.length > 0) {
      setSelectedParts(new Set(matched.map((p) => p.id)))
    }
  }, [selectedCar, initialPartKeyword])

  function handleCarChange(carId: string) {
    setSelectedCarId(carId)
    setSelectedParts(new Set())
    didPreCheck.current = false
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

  const handleGenerateCar = useCallback(async (input: GenerateCarInput): Promise<boolean> => {
    setIsGenerating(true)
    setGenerateError(null)
    setGenerateInfo(null)
    try {
      const res = await fetch("/api/generate-car-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "데이터 생성에 실패했습니다.")

      const newCar: CarModel = data.car

      if (data.duplicate) {
        setGenerateInfo(`이미 등록된 차종입니다: ${newCar.brand} ${newCar.model} ${newCar.generation}`)
        setDynamicCars((prev) => (prev.some((c) => c.id === newCar.id) ? prev : [...prev, newCar]))
        handleCarChange(newCar.id)
        return true
      }

      setDynamicCars((prev) => (prev.some((c) => c.id === newCar.id) ? prev : [...prev, newCar]))
      handleCarChange(newCar.id)
      return true
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "알 수 없는 오류")
      return false
    } finally {
      setIsGenerating(false)
    }
  }, [])

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
      coupangPartsTotal, coupangLaborTotal, coupangTotal,
      dealerPartsTotal, dealerLaborTotal, dealerTotal,
      savings, savingsPercent, items,
    }
  }, [selectedCar, selectedParts])

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
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

      {/* 호환성 검증에서 진입 시 안내 배너 */}
      {isFromVerify && selectedCar && (
        <div className="mb-6 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
          <span className="font-semibold text-primary">검증된 차량 자동 적용됨:</span>{" "}
          <strong className="text-foreground">
            {selectedCar.brand} {selectedCar.model} {selectedCar.generation}
          </strong>
          {initialPartKeyword && (
            <span className="text-muted-foreground">
              {" "}·{" "}
              <strong className="text-foreground">{initialPartKeyword}</strong> 항목이 자동 선택되었습니다.
            </span>
          )}
        </div>
      )}
      {isFromVerify && !selectedCar && initialModelQuery && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
          <span className="font-semibold">차종 DB 매칭 실패:</span>{" "}
          <span className="text-muted-foreground">
            <strong className="text-foreground">{initialModelQuery}</strong>와 일치하는 차종을
            찾지 못했습니다. 아래에서 차종을 직접 선택하거나 AI로 생성해주세요.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <CarSelector
              allCars={allCars}
              selectedCarId={selectedCarId}
              onCarChange={handleCarChange}
              onGenerateCar={handleGenerateCar}
              isGenerating={isGenerating}
              generateError={generateError}
              generateInfo={generateInfo}
              isFromVerify={isFromVerify && Boolean(selectedCarId)}
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

        <div className="lg:sticky lg:top-[4.5rem] lg:h-fit">
          <div className="rounded-xl border border-border bg-card p-5">
            <CostDashboard car={selectedCar} summary={costSummary} />
          </div>
        </div>
      </div>

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

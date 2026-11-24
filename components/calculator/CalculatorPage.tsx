"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { CarSelector } from "./CarSelector"
import { MaintenanceChecklist } from "./MaintenanceChecklist"
import { CostDashboard } from "./CostDashboard"
import { CAR_DATA } from "@/lib/data/cars"
import type { CarModel, CostSummary, PartCategory } from "@/types"
import type { GenerateCarInput } from "@/lib/gemini"
import { carEngines, partsForEngine } from "@/lib/engines"
import { formatPrice } from "@/lib/utils"

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

  const baseCar = useMemo(() => allCars.find((c) => c.id === selectedCarId), [allCars, selectedCarId])

  // 엔진마다 소모품 규격이 다른 차종(싼타페 TM 등)은 엔진을 골라야 합계가 겹치지 않음
  const engines = useMemo(() => (baseCar ? carEngines(baseCar) : []), [baseCar])
  const [selectedEngine, setSelectedEngine] = useState<string | null>(null)
  const activeEngine = engines.length ? (selectedEngine && engines.includes(selectedEngine) ? selectedEngine : engines[0]) : null
  const selectedCar = useMemo(
    () => (baseCar && activeEngine ? { ...baseCar, parts: partsForEngine(baseCar, activeEngine) } : baseCar),
    [baseCar, activeEngine]
  )

  const didPreCheck = useRef(false)

  // 마운트 시 전달받은 차량 정보 검증 로그
  useEffect(() => {
    const resolved = allCars.find((c) => c.id === selectedCarId)
    if (process.env.NODE_ENV !== "production") console.log("[Cost Calculator] 전달받은 차량 정보:", {
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
    setSelectedEngine(null)
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
    <div className="mx-auto max-w-5xl px-5 pb-28 pt-6 sm:pt-10 lg:pb-6">
      <h1 className="text-[28px] font-extrabold leading-[1.3] sm:text-[36px]">정비 비용 계산기</h1>
      <p className="mt-2 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
        이번에 바꿀 소모품만 체크하세요. 공식센터 견적과 부품을 직접 사서 공임나라에 맡길 때의 금액을 바로 비교해요.
      </p>

      {isFromVerify && !selectedCar && initialModelQuery && (
        <p className="mt-4 rounded-[10px] bg-[#FFF6ED] px-4 py-3 text-[14px] text-[#B54708]">
          <strong>{initialModelQuery}</strong>와 맞는 차종을 찾지 못했어요. 아래에서 직접 고르거나 AI로 규격을 만들어 보세요.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
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
            {selectedCar && engines.length > 1 && (
              <div className="mt-3">
                <p className="mb-2 text-[13px] font-semibold text-muted-foreground">엔진 (엔진마다 소모품 규격이 달라요)</p>
                <div role="radiogroup" aria-label="엔진 선택" className="flex flex-wrap gap-2">
                  {engines.map((e) => (
                    <button
                      key={e}
                      type="button"
                      role="radio"
                      aria-checked={e === activeEngine}
                      onClick={() => {
                        setSelectedEngine(e)
                        setSelectedParts(new Set())
                      }}
                      className={`min-h-[40px] rounded-full border px-3.5 text-[14px] font-semibold transition ${
                        e === activeEngine ? "border-primary bg-emerald-50 text-primary" : "border-border bg-card hover:border-input"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {selectedCar && (
            <MaintenanceChecklist
              car={selectedCar}
              selectedParts={selectedParts}
              onToggle={handleToggle}
              onSelectAll={handleSelectAll}
              onClearAll={handleClearAll}
            />
          )}
        </div>

        <section id="calc-result" aria-label="계산 결과" className="scroll-mt-20 lg:sticky lg:top-[4.5rem]">
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="mb-3 text-[17px] font-bold">계산 결과</h2>
            <CostDashboard car={selectedCar} summary={costSummary} />
          </div>
        </section>
      </div>

      {/* 휴대폰: 체크하는 동안 합계가 항상 보이는 아래 막대 */}
      {costSummary && (
        <div className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom))] z-40 md:bottom-0 border-t border-border bg-card/95 px-5 py-3 shadow-[0_-4px_16px_rgba(20,33,61,0.08)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <p className="num leading-tight">
              <span className="block text-[13px] text-muted-foreground">{costSummary.items.length}개 · 아끼는 돈</span>
              <span className="text-[20px] font-extrabold text-primary">{formatPrice(Math.max(costSummary.savings, 0))}</span>
            </p>
            <a
              href="#calc-result"
              className="inline-flex h-11 items-center rounded-[10px] bg-foreground px-4 text-[14px] font-bold text-background"
            >
              결과 보기
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

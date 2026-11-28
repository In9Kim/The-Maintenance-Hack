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
import { loadGarage, dueList, type MyCar } from "@/lib/my-car"
import { duePartIds, dueTexts } from "@/lib/calc-due"
import { splitChecklistParts } from "@/lib/checklist-order"
import { carShortName } from "@/lib/seo"
import { useAuthToken } from "@/components/my/useAuthToken"

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
  const [generateNeedsLogin, setGenerateNeedsLogin] = useState(false)
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
  const dueApplied = useRef("")

  // 등록한 내 차 (계산기 데이터에 있는 차만). 주소로 차가 넘어오면 쓰지 않음
  const fromUrl = Boolean(safeInitialCarId || initialModelQuery)
  const [garageCars, setGarageCars] = useState<MyCar[]>([])
  const [myCarId, setMyCarId] = useState<string>("")
  const [usingMyCar, setUsingMyCar] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // 내 차를 (다시) 고를 때마다 올림 — 같은 차를 다시 골라도 갈 때 된 부품 미리 체크가 다시 돌게
  const [pickNonce, setPickNonce] = useState(0)

  function selectMyCar(c: MyCar) {
    const car = CAR_DATA.find((x) => x.id === c.car.id)
    if (!car) return
    setSelectedCarId(car.id)
    setSelectedEngine(c.engine && carEngines(car).includes(c.engine) ? c.engine : null)
    setSelectedParts(new Set())
    setMyCarId(c.id ?? "")
    setUsingMyCar(true)
    setPickNonce((n) => n + 1)
    didPreCheck.current = false
    dueApplied.current = ""
  }

  // 주소로 넘어온 차가 없으면 등록한 내 차(와 엔진)를 미리 골라 둔다 (등록한 차를 다시 고르지 않게)
  useEffect(() => {
    if (fromUrl) {
      setLoaded(true)
      return
    }
    const g = loadGarage()
    const cars = g.cars.filter((c) => CAR_DATA.some((x) => x.id === c.car.id))
    setGarageCars(cars)
    const active = cars.find((c) => c.id === g.active) ?? cars[0]
    if (active) selectMyCar(active)
    setLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const my = garageCars.find((c) => c.id === myCarId) ?? null
  const isMyCarSelected = Boolean(usingMyCar && my && baseCar && baseCar.id === my.car.id)
  const myEngineFixed = Boolean(isMyCarSelected && my?.engine && engines.includes(my.engine))

  // 정비 탭 기준 '갈 때 된 부품'(지남·곧) — 등록한 차일 때만, ?part= 로 들어온 경우는 제외
  const dueIds = useMemo(
    () => (isMyCarSelected && my && selectedCar && !initialPartKeyword ? duePartIds(dueList(my), selectedCar) : []),
    [isMyCarSelected, my, selectedCar, initialPartKeyword]
  )
  // 미리 체크된 이유를 카드에 ('3개월 지남')
  const dueTextMap = useMemo(
    () => (dueIds.length && my && selectedCar ? dueTexts(dueList(my), selectedCar) : undefined),
    [dueIds, my, selectedCar]
  )

  // 차·엔진이 정해지면 갈 때 된 부품을 한 번 미리 체크
  useEffect(() => {
    if (!isMyCarSelected || initialPartKeyword) return
    const key = `${myCarId}|${activeEngine ?? ""}|${pickNonce}`
    if (dueApplied.current === key) return
    dueApplied.current = key
    if (dueIds.length) setSelectedParts(new Set(dueIds))
  }, [isMyCarSelected, initialPartKeyword, myCarId, activeEngine, dueIds, pickNonce])

  // AI로 규격 만들기는 로그인한 사람만 (서버가 계정 하루 한도로 셈)
  const { token } = useAuthToken()

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

  // 주소 ?part= 에 맞는 부품 id (견적서·부품 확인에서 넘어옴): 미리 체크하고 목록 맨 위에 보여 줌
  const urlPartIds = useMemo(() => {
    if (!initialPartKeyword || !selectedCar) return []
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

    return matched.map((p) => p.id)
  }, [selectedCar, initialPartKeyword])

  useEffect(() => {
    if (didPreCheck.current || !initialPartKeyword || !selectedCar) return
    didPreCheck.current = true
    if (urlPartIds.length > 0) setSelectedParts(new Set(urlPartIds))
  }, [selectedCar, initialPartKeyword, urlPartIds])

  function handleCarChange(carId: string) {
    setSelectedCarId(carId)
    setSelectedEngine(null)
    setSelectedParts(new Set())
    setUsingMyCar(false)
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
    setGenerateNeedsLogin(false)
    setGenerateInfo(null)
    try {
      const res = await fetch("/api/generate-car-data", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenerateNeedsLogin(res.status === 401 && data.login === true)
        throw new Error(data.error ?? "데이터 생성에 실패했습니다.")
      }

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
  }, [token])

  const costSummary = useMemo((): CostSummary | null => {
    if (!selectedCar || selectedParts.size === 0) return null

    // 체크 목록과 같은 순서(?part= 부품·갈 때 된 부품 먼저, 그다음 데이터 순서): 결과의 사진 상품 3개도 이 순서로
    const { top, rest } = splitChecklistParts(selectedCar.parts, { dueIds, hasMyCar: isMyCarSelected, pinIds: urlPartIds })
    const checkedParts = [...top, ...rest].filter((p) => selectedParts.has(p.id))
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
  }, [selectedCar, selectedParts, dueIds, isMyCarSelected, urlPartIds])

  const engineChips = selectedCar && engines.length > 1 && !myEngineFixed && (
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
  )

  const myCarName = (c: MyCar) => {
    const car = CAR_DATA.find((x) => x.id === c.car.id)
    return car ? carShortName(car) : c.car.name
  }

  const otherCarButton = (
    <button
      type="button"
      onClick={() => setShowPicker(true)}
      className="inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-[10px] border border-border px-3 text-[14px] font-semibold hover:border-input"
    >
      다른 차
    </button>
  )

  const showMyCar = garageCars.length > 0 && !showPicker

  return (
    <div className="mx-auto max-w-5xl px-5 pb-28 pt-6 sm:pt-10 lg:pb-6">
      <h1 className="text-[28px] font-extrabold leading-[1.3] sm:text-[36px]">정비 비용 계산기</h1>
      <p className="mt-2 max-w-xl break-keep text-[16px] leading-relaxed text-muted-foreground">
        바꿀 부품만 체크하면 센터 금액과 비교해 줘요.
      </p>

      {isFromVerify && !selectedCar && initialModelQuery && (
        <p className="mt-4 rounded-[10px] bg-[#FFF6ED] px-4 py-3 text-[14px] text-[#B54708]">
          <strong>{initialModelQuery}</strong>와 맞는 차종을 찾지 못했어요. 아래에서 직접 고르거나 AI로 규격을 만들어 보세요.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-6">
          {!loaded && !fromUrl ? (
            // 등록한 차를 읽기 전엔 회색 틀만 (첫 화면에서 차종 상자가 번쩍 뜨지 않게)
            <div className="h-14 animate-pulse rounded-2xl bg-muted" aria-hidden="true" />
          ) : showMyCar && garageCars.length === 1 ? (
            <div className="rounded-2xl border border-border bg-card px-4 py-2 sm:px-5">
              <div className="flex items-center gap-3">
                <p className="min-w-0 flex-1 break-keep text-[15px] leading-snug">
                  <span className="font-semibold text-muted-foreground">내 차</span>
                  {" · "}
                  <span className="font-bold">{myCarName(garageCars[0])}</span>
                  {myEngineFixed && my?.engine ? <> · {my.engine}</> : null}
                </p>
                {otherCarButton}
              </div>
              {engineChips && <div className="pb-2">{engineChips}</div>}
            </div>
          ) : showMyCar ? (
            <div className="rounded-2xl border border-border bg-card px-4 py-3 sm:px-5">
              <div className="flex items-start gap-3">
                <div role="radiogroup" aria-label="내 차 선택" className="flex min-w-0 flex-1 flex-wrap gap-2">
                  {garageCars.map((c) => {
                    const on = isMyCarSelected && c.id === myCarId
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => selectMyCar(c)}
                        className={`min-h-[40px] break-keep rounded-full border px-3.5 text-[14px] font-semibold transition ${
                          on ? "border-primary bg-emerald-50 text-primary" : "border-border bg-card hover:border-input"
                        }`}
                      >
                        {myCarName(c)}
                        {/* 고른 차의 엔진 (가솔린·디젤 중 어느 쪽으로 계산했는지) */}
                        {on && myEngineFixed && my?.engine ? <span className="whitespace-nowrap font-normal"> · {my.engine}</span> : null}
                      </button>
                    )
                  })}
                </div>
                {otherCarButton}
              </div>
              {engineChips}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              {garageCars.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const back = my ?? garageCars[0]
                    if (back) selectMyCar(back)
                    setShowPicker(false)
                  }}
                  className="mb-2 inline-flex min-h-[44px] items-center whitespace-nowrap text-[14px] font-semibold text-primary underline-offset-2 hover:underline"
                >
                  ← 내 차로 돌아가기
                </button>
              )}
              <CarSelector
                allCars={allCars}
                selectedCarId={selectedCarId}
                onCarChange={handleCarChange}
                onGenerateCar={handleGenerateCar}
                isGenerating={isGenerating}
                generateError={generateError}
                generateInfo={generateInfo}
                generateNeedsLogin={generateNeedsLogin}
                isFromVerify={isFromVerify && Boolean(selectedCarId)}
                title={showPicker ? "다른 차 고르기" : undefined}
              />
              {engineChips}
            </div>
          )}

          {selectedCar && (
            <MaintenanceChecklist
              car={selectedCar}
              selectedParts={selectedParts}
              onToggle={handleToggle}
              onSelectAll={handleSelectAll}
              onClearAll={handleClearAll}
              dueIds={dueIds}
              hasMyCar={isMyCarSelected}
              pinIds={urlPartIds}
              dueTexts={dueTextMap}
            />
          )}
        </div>

        <section id="calc-result" aria-label="계산 결과" className="scroll-mt-20 lg:sticky lg:top-[4.5rem]">
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="mb-3 text-[17px] font-bold">계산 결과</h2>
            <CostDashboard
              car={selectedCar}
              summary={costSummary}
              engine={
                myEngineFixed && my?.engine
                  ? my.engine
                  : engines.length > 1
                    ? activeEngine ?? undefined
                    : isMyCarSelected
                      ? my?.engine || undefined
                      : undefined
              }
            />
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

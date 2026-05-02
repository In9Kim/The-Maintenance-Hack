"use client"

import { useState, useMemo } from "react"
import { Car, Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import type { CarModel } from "@/types"
import type { GenerateCarInput } from "@/lib/gemini"

interface CarSelectorProps {
  allCars: CarModel[]
  selectedCarId: string
  onCarChange: (carId: string) => void
  onGenerateCar: (input: GenerateCarInput) => Promise<boolean>
  isGenerating: boolean
  generateError: string | null
}

const INPUT_CLS =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 outline-none focus:border-primary transition-colors"

export function CarSelector({
  allCars,
  selectedCarId,
  onCarChange,
  onGenerateCar,
  isGenerating,
  generateError,
}: CarSelectorProps) {
  const [showGenerate, setShowGenerate] = useState(false)
  const [genInput, setGenInput] = useState<GenerateCarInput>({
    brand: "",
    model: "",
    generation: "",
    yearRange: "",
    engineType: "",
  })

  const brands = useMemo(
    () => Array.from(new Set(allCars.map((c) => c.brand))),
    [allCars]
  )

  const selectedCar = useMemo(
    () => allCars.find((c) => c.id === selectedCarId),
    [allCars, selectedCarId]
  )

  const selectedBrand = selectedCar?.brand ?? ""

  const modelsForBrand = useMemo(
    () => allCars.filter((c) => c.brand === selectedBrand),
    [allCars, selectedBrand]
  )

  function handleBrandChange(brand: string) {
    const first = allCars.find((c) => c.brand === brand)
    if (first) onCarChange(first.id)
  }

  function setField<K extends keyof GenerateCarInput>(key: K, value: string) {
    setGenInput((prev) => ({ ...prev, [key]: value }))
  }

  async function handleGenerate() {
    if (!genInput.brand || !genInput.model || !genInput.engineType) return
    const success = await onGenerateCar(genInput)
    if (success) setShowGenerate(false)
  }

  const canGenerate =
    genInput.brand.trim() !== "" &&
    genInput.model.trim() !== "" &&
    genInput.engineType.trim() !== ""

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
          1
        </div>
        <h2 className="text-base font-semibold">차량 선택</h2>
      </div>

      {/* 브랜드 / 모델 드롭다운 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">브랜드</label>
          <Select value={selectedBrand} onValueChange={handleBrandChange}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="브랜드 선택" />
            </SelectTrigger>
            <SelectContent>
              {brands.map((brand) => (
                <SelectItem key={brand} value={brand}>
                  {brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">모델 / 세대</label>
          <Select
            value={selectedCarId}
            onValueChange={onCarChange}
            disabled={!selectedBrand}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="모델 선택" />
            </SelectTrigger>
            <SelectContent>
              {modelsForBrand.map((car: CarModel) => (
                <SelectItem key={car.id} value={car.id}>
                  {car.model} {car.generation}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 선택된 차량 정보 배지 */}
      {selectedCar && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <Car className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">
              {selectedCar.brand} {selectedCar.model}{" "}
              <span className="font-normal text-muted-foreground">{selectedCar.generation}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedCar.yearRange} · {selectedCar.engineTypes.join(" / ")}
            </p>
          </div>
          <span className="ml-auto rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
            {selectedCar.parts.length}개 항목
          </span>
        </div>
      )}

      {/* AI 생성 토글 버튼 */}
      <button
        onClick={() => setShowGenerate((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
      >
        <Sparkles className="h-3.5 w-3.5" />
        내 차종이 없나요? Gemini AI로 분석하기
        {showGenerate ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {/* AI 데이터 생성 폼 */}
      {showGenerate && (
        <div className="space-y-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-primary">Gemini AI 정비 데이터 생성</p>
          </div>
          <p className="text-xs text-muted-foreground">
            차량 정보를 입력하면 AI가 공임나라 기준 공임과 쿠팡 예상 부품가를 생성합니다.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">브랜드 *</label>
              <input
                className={INPUT_CLS}
                placeholder="예: BMW, 볼보, 포르쉐"
                value={genInput.brand}
                onChange={(e) => setField("brand", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">모델 *</label>
              <input
                className={INPUT_CLS}
                placeholder="예: 3시리즈, XC60"
                value={genInput.model}
                onChange={(e) => setField("model", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">세대 / 트림</label>
              <input
                className={INPUT_CLS}
                placeholder="예: G20 5세대"
                value={genInput.generation}
                onChange={(e) => setField("generation", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">연식 범위</label>
              <input
                className={INPUT_CLS}
                placeholder="예: 2019~현재"
                value={genInput.yearRange}
                onChange={(e) => setField("yearRange", e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">엔진 *</label>
              <input
                className={INPUT_CLS}
                placeholder="예: 2.0T 가솔린, 전기차 (RWD)"
                value={genInput.engineType}
                onChange={(e) => setField("engineType", e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !canGenerate}
            className="w-full gap-2"
            size="sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                AI 분석 중... (10~20초 소요)
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                AI 데이터 생성
              </>
            )}
          </Button>

          {generateError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {generateError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

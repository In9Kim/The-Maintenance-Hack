"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Link2,
  PencilLine,
  ShieldCheck,
  RotateCcw,
  Calculator,
  ArrowRight,
  ShoppingCart,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CompatibilityResult, PartAnalysis } from "@/lib/gemini"

// ─── 타입 ──────────────────────────────────────────────────────────
type ApiResponse = CompatibilityResult & {
  productInfo: string
  urlExtracted: boolean
  productCategory: string | null
  cacheHit?: boolean
  error?: string
  needsManualInput?: boolean
}

type InputMode = "url" | "manual"
type PageState = "idle" | "loading" | "result" | "error"

interface CompatibilityCheckerProps {
  heroMode?: boolean
}

// ─── 카테고리 목록 ──────────────────────────────────────────────────
const PART_CATEGORIES = [
  { id: "brake",   label: "브레이크 패드/디스크",   desc: "패드, 디스크, 캘리퍼" },
  { id: "oil",     label: "엔진오일 / 오일 필터",   desc: "오일, 오일필터" },
  { id: "filter",  label: "에어클리너 / 에어컨 필터", desc: "에어클리너, 캐빈필터" },
  { id: "battery", label: "배터리",                 desc: "12V, AGM, EFB" },
  { id: "spark",   label: "점화플러그",              desc: "플러그, 이리듐, 백금" },
  { id: "wiper",   label: "와이퍼 블레이드",         desc: "와이퍼, 블레이드" },
  { id: "belt",    label: "타이밍벨트 / 팬벨트",    desc: "타이밍, V벨트" },
  { id: "fluid",   label: "브레이크오일 / 냉각수",   desc: "DOT4, 부동액" },
] as const

type CategoryId = typeof PART_CATEGORIES[number]["id"]

// ─── 로딩 단계 ─────────────────────────────────────────────────────
const STEPS_URL    = ["차대번호 기반 제원 분석 중…", "상품 페이지 정보 대조 중…", "순정 품번 및 규격 교차 검증 중…", "호환성 최종 판정 중…"]
const STEPS_MANUAL = ["차대번호 기반 제원 분석 중…", "입력된 상품 정보 분석 중…",   "순정 품번 및 규격 교차 검증 중…", "호환성 최종 판정 중…"]
const STEP_DELAYS  = [2400, 5000, 7800]

// ─── 뱃지 설정 ────────────────────────────────────────────────────
const BADGE_CONFIG = {
  YES:       { label: "✅ 확정 호환",  icon: CheckCircle2, container: "border-emerald-500/30 bg-emerald-500/10", badge: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", icon_class: "text-emerald-400" },
  NO:        { label: "❌ 불일치",     icon: XCircle,      container: "border-red-500/30 bg-red-500/10",         badge: "bg-red-500/15 text-red-300 border border-red-500/30",         icon_class: "text-red-400"     },
  UNCERTAIN: { label: "⚠️ 확인 필요", icon: AlertTriangle, container: "border-amber-500/30 bg-amber-500/10",    badge: "bg-amber-500/15 text-amber-300 border border-amber-500/30",  icon_class: "text-amber-400"   },
}

const VERDICT_CONFIG = {
  YES:       { label: "확정 호환 ✅", class: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" },
  NO:        { label: "불일치 ❌",    class: "bg-red-500/15 text-red-300 border border-red-500/30"             },
  UNCERTAIN: { label: "확인 필요 ⚠️", class: "bg-amber-500/15 text-amber-300 border border-amber-500/30"      },
}

// ─── 하위 컴포넌트 ─────────────────────────────────────────────────
function SectionHeading({ num, title }: { num: string; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
        {num}
      </span>
      <h3 className="text-sm font-bold">{title}</h3>
    </div>
  )
}

function PartCard({ part }: { part: PartAnalysis }) {
  const vcfg = VERDICT_CONFIG[part.verdict]
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{part.part_name}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            예상 순정 품번: {part.oemNumber}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${vcfg.class}`}>
          {vcfg.label}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{part.reason}</p>
    </div>
  )
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 px-4 py-2.5 text-sm">
      <dt className="w-28 shrink-0 text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function StepIndicator({ steps, activeIdx }: { steps: string[]; activeIdx: number }) {
  return (
    <div className="mt-4 space-y-2 rounded-lg border border-border/50 bg-secondary/30 px-4 py-3">
      {steps.map((step, i) => {
        const done   = i < activeIdx
        const active = i === activeIdx
        return (
          <div
            key={i}
            className={`flex items-center gap-2.5 text-xs transition-all duration-500 ${
              active ? "text-primary" : done ? "text-muted-foreground/50" : "text-muted-foreground/25"
            }`}
          >
            {done   ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            : active ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            :           <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-current" />}
            <span className={done ? "line-through" : ""}>{step}</span>
          </div>
        )
      })}
    </div>
  )
}

// "기아 K3" → "K3", "현대 아반떼 CN7" → "아반떼 CN7" (첫 단어=브랜드 제거)
function extractModelName(manufacturerModel: string): string {
  const parts = manufacturerModel.trim().split(/\s+/)
  return parts.length > 1 ? parts.slice(1).join(" ") : manufacturerModel
}

function buildCoupangSearchUrl(query: string): string {
  const affiliateId = process.env.NEXT_PUBLIC_COUPANG_AFFILIATE_ID ?? ""
  return `https://link.coupang.com/a/search?q=${encodeURIComponent(query)}&lptag=${encodeURIComponent(affiliateId)}`
}

function ResultCard({ data, onReset, userInput }: { data: ApiResponse; onReset: () => void; userInput: string }) {
  const cfg  = BADGE_CONFIG[data.compatibility]
  const Icon = cfg.icon
  const firstPart = data.parts_analysis[0] ?? { part_name: "", oemNumber: "" }

  // 쿠팡 검색어: [사용자 입력 부품명] + [모델명]. 연식·브랜드·엔진 제원 제외.
  const modelName   = extractModelName(data.vehicle_spec.manufacturer_model)
  const inputPart   = userInput.trim() || firstPart.part_name
  const fallbackUrl = buildCoupangSearchUrl([inputPart, modelName].filter(Boolean).join(" "))

  const [coupangUrl, setCoupangUrl] = useState(fallbackUrl)
  const [coupangLoading, setCoupangLoading] = useState(true)

  // "2019년식" → 2019, "2020" → 2020 (숫자만 추출)
  const yearNum = parseInt(data.vehicle_spec.production_year ?? "")
  const yearQuery = !isNaN(yearNum) ? `&year=${yearNum}` : ""
  const calcUrl = `/calculator?model=${encodeURIComponent(
    data.vehicle_spec.manufacturer_model
  )}${yearQuery}&part=${encodeURIComponent(
    firstPart.part_name
  )}${data.productCategory ? `&category=${encodeURIComponent(data.productCategory)}` : ""}`

  useEffect(() => {
    fetch("/api/coupang-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputPart, specs: modelName }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { shortenUrl?: string } | null) => {
        if (json?.shortenUrl) setCoupangUrl(json.shortenUrl)
      })
      .catch(() => {})
      .finally(() => setCoupangLoading(false))
  }, [data, userInput])

  return (
    <div className={`mt-6 rounded-xl border p-5 ${cfg.container}`}>
      {/* 종합 판정 + 다시 검증 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className={`h-8 w-8 ${cfg.icon_class}`} />
          <span className={`rounded-full px-4 py-1.5 text-base font-bold ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          다시 검증
        </button>
      </div>

      <div className="mt-5 space-y-5">
        {/* 1. 제원 분석 */}
        <section>
          <SectionHeading num="1" title="차대번호(VIN) 제원 분석" />
          <dl className="divide-y divide-border/40 rounded-lg border border-border/60 bg-background/40">
            <SpecRow label="제조사 / 모델" value={data.vehicle_spec.manufacturer_model} />
            <SpecRow label="생산 연도"    value={data.vehicle_spec.production_year}     />
            <SpecRow label="엔진 / 제원"  value={data.vehicle_spec.engine_spec}         />
          </dl>
        </section>

        {/* 2. 부품별 호환성 */}
        <section>
          <SectionHeading num="2" title="부품별 호환성 확인 결과" />
          <div className="space-y-2">
            {data.parts_analysis.map((part, i) => <PartCard key={i} part={part} />)}
          </div>
        </section>

        {/* 3. 전문가 팁 */}
        <section>
          <SectionHeading num="3" title="정비 전문가의 팁" />
          <ul className="space-y-1.5 rounded-lg border border-border/60 bg-background/40 px-4 py-3">
            {data.expert_tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <span className="mt-0.5 shrink-0 text-primary">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 결론 */}
        <div className={`rounded-lg border px-4 py-3 ${cfg.container}`}>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">결론</p>
          <p className="mt-1 text-sm font-medium leading-relaxed">{data.conclusion}</p>
        </div>

        {/* ▶ 비용 계산기 CTA */}
        <Link
          href={calcUrl}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Calculator className="h-4 w-4" />
          이 부품으로 정비 비용 계산하기
          <ArrowRight className="h-4 w-4" />
        </Link>

        {/* ▶ 쿠팡 파트너스 CTA */}
        <div className="space-y-2">
          {data.cacheHit && (
            <p className="text-center text-xs font-semibold text-emerald-400">
              ✅ 이미 검증된 규격입니다
            </p>
          )}
          <a
            href={coupangUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#fe6001] px-4 py-3 text-sm font-bold text-white transition-all hover:bg-[#e55500]"
          >
            {coupangLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                수익 링크 생성 중…
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                쿠팡에서 검증된 호환 부품 최저가 확인
                <ExternalLink className="h-4 w-4" />
              </>
            )}
          </a>
          <p className="text-center text-xs text-gray-500">
            이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
          </p>
        </div>

        {data.productInfo && (
          <p className="text-[11px] text-muted-foreground/50">
            분석 기반:{" "}
            <span className="line-clamp-1 italic">{data.productInfo}</span>
          </p>
        )}
      </div>
    </div>
  )
}

// ─── 부품 카테고리 드롭다운 ────────────────────────────────────────
function CategorySelect({
  selected,
  onSelect,
}: {
  selected: CategoryId | ""
  onSelect: (id: CategoryId | "") => void
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">
        부품 카테고리
        <span className="ml-1.5 text-destructive">*</span>
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">필수 — 분석 정확도에 영향</span>
      </label>
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value as CategoryId | "")}
        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="">— 카테고리를 선택해주세요 (필수) —</option>
        {PART_CATEGORIES.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.label}  ·  {cat.desc}
          </option>
        ))}
      </select>
      {!selected && (
        <p className="mt-1.5 text-xs text-amber-400">
          ⚠ 카테고리를 선택해야 검증 버튼이 활성화됩니다.
        </p>
      )}
    </div>
  )
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────
export function CompatibilityChecker({ heroMode = false }: CompatibilityCheckerProps) {
  const [vin, setVin]                           = useState("")
  const [productUrl, setProductUrl]             = useState("")
  const [productText, setProductText]           = useState("")
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | "">("")
  const [inputMode, setInputMode]               = useState<InputMode>("url")
  const [pageState, setPageState]               = useState<PageState>("idle")
  const [result, setResult]                     = useState<ApiResponse | null>(null)
  const [errorMsg, setErrorMsg]                 = useState("")
  const [stepIdx, setStepIdx]                   = useState(0)
  // 하이드레이션 완료 전 클릭 입력이 무시되는 현상 방지
  const [mounted, setMounted]                   = useState(false)

  const vinFormatted = vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/gi, "")
  const steps = inputMode === "url" ? STEPS_URL : STEPS_MANUAL

  // 로딩 단계 순환
  useEffect(() => {
    if (pageState !== "loading") { setStepIdx(0); return }
    const timers = STEP_DELAYS.map((delay, i) => setTimeout(() => setStepIdx(i + 1), delay))
    return () => timers.forEach(clearTimeout)
  }, [pageState])

  // 클라이언트 마운트 완료 시점 감지 — 이 시점 이후에만 탭 이벤트가 동작함을 보장
  useEffect(() => { setMounted(true) }, [])

  function switchMode(mode: InputMode) {
    console.log("Current Tab Changed to:", mode)
    setInputMode(mode)
    setErrorMsg("")
    if (mode === "url") setSelectedCategory("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (vinFormatted.length !== 17) return

    setPageState("loading")
    setResult(null)
    setErrorMsg("")

    try {
      const body =
        inputMode === "url"
          ? { vin: vinFormatted, productUrl: productUrl.trim() }
          : { vin: vinFormatted, productText: productText.trim(), productCategory: selectedCategory || undefined }

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data: ApiResponse = await res.json()

      if (!res.ok) {
        if (data.needsManualInput) {
          setInputMode("manual")
          setPageState("idle")
          setErrorMsg("URL에서 상품 정보를 자동으로 가져오지 못했습니다. 상품명 또는 품번을 직접 입력해주세요.")
          return
        }
        throw new Error(data.error ?? "알 수 없는 오류")
      }

      setResult(data)
      setPageState("result")
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.")
      setPageState("error")
    }
  }

  function handleReset() {
    setPageState("idle")
    setResult(null)
    setErrorMsg("")
  }

  const canSubmit =
    vinFormatted.length === 17 &&
    (inputMode === "url"
      ? productUrl.trim().length > 0
      : productText.trim().length > 0 && selectedCategory !== "") &&
    pageState !== "loading"

  // 입력 크기: heroMode에서 더 크게
  const inputCls = heroMode
    ? "w-full rounded-lg border border-input bg-background px-4 py-4 text-base placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
    : "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"

  const vinInputCls = `${inputCls} font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal`

  return (
    <div className={heroMode ? "w-full" : "rounded-xl border border-border bg-card p-5"}>
      {/* 헤더 — 일반 모드에서만 표시 */}
      {!heroMode && (
        <div className="mb-5">
          <h2 className="text-lg font-bold">
            부품 호환성{" "}
            <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
              즉시 검증
            </span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            차대번호와 구매 예정 상품을 입력하면 AI가 호환 여부를 판정합니다
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* VIN 입력 */}
        <div>
          <label className={`mb-1.5 block font-semibold ${heroMode ? "text-base" : "text-sm"}`}>
            차대번호 (VIN)
            <span className="ml-1.5 font-normal text-muted-foreground">17자리</span>
          </label>
          <input
            type="text"
            value={vinFormatted}
            onChange={(e) => setVin(e.target.value)}
            maxLength={17}
            placeholder="KNAGM4A77G5139862"
            className={vinInputCls}
          />
          <div className="mt-1.5 flex justify-between">
            <p className="text-xs text-muted-foreground">자동차 등록증 또는 차량 앞유리 좌측 하단에서 확인</p>
            <span className={`font-mono text-xs ${vinFormatted.length === 17 ? "text-emerald-400" : "text-muted-foreground"}`}>
              {vinFormatted.length} / 17
            </span>
          </div>
        </div>

        {/* URL / 직접 입력 탭 — segmented control */}
        <div className="space-y-3">
          <div
            role="tablist"
            className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/30 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === "url"}
              disabled={!mounted}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); switchMode("url") }}
              className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 ${
                inputMode === "url"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Link2 className="h-3.5 w-3.5" />
              URL 입력
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === "manual"}
              disabled={!mounted}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); switchMode("manual") }}
              className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 ${
                inputMode === "manual"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <PencilLine className="h-3.5 w-3.5" />
              직접 입력
            </button>
          </div>

          {inputMode === "url" ? (
            <input
              type="url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="https://www.coupang.com/vp/products/..."
              className={inputCls}
            />
          ) : (
            <>
              {/* ① 카테고리 드롭다운 — 직접 입력 모드 필수 */}
              <CategorySelect selected={selectedCategory} onSelect={setSelectedCategory} />

              {/* ② 상품명/품번 텍스트 입력 */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-muted-foreground">
                  상품명 또는 품번
                </label>
                <textarea
                  value={productText}
                  onChange={(e) => setProductText(e.target.value)}
                  rows={heroMode ? 2 : 3}
                  placeholder={
                    selectedCategory === "brake"
                      ? "예: HP4098, 상신 하드론 K3 앞 브레이크패드"
                      : selectedCategory === "oil"
                      ? "예: SM-110, 기아 K3 1.6 엔진오일 필터"
                      : "예: 품번 또는 상품명 (예: 58101-H8A00)"
                  }
                  className={`${inputCls} resize-none`}
                />
              </div>
            </>
          )}
        </div>

        {/* 오류 메시지 */}
        {errorMsg && pageState !== "loading" && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3">
            <p className="text-xs text-amber-300">{errorMsg}</p>
          </div>
        )}

        {/* 개인정보 안내 */}
        <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            분석에 사용된 차대번호는 오직 부품 매칭을 위해서만 사용되며 서버에 개인정보로 저장되지
            않습니다.
          </p>
        </div>

        {/* 검증 버튼 */}
        <Button
          type="submit"
          className={`w-full ${heroMode ? "h-12 text-base font-bold" : ""}`}
          disabled={!canSubmit}
        >
          {pageState === "loading" ? (
            <><Loader2 className="animate-spin" />{steps[stepIdx]}</>
          ) : (
            "호환성 검증하기"
          )}
        </Button>

        {/* 4단계 진행 인디케이터 */}
        {pageState === "loading" && <StepIndicator steps={steps} activeIdx={stepIdx} />}
      </form>

      {/* 결과 카드 */}
      {pageState === "result" && result && (
        <ResultCard data={result} onReset={handleReset} userInput={productText} />
      )}

      {/* 시스템 오류 */}
      {pageState === "error" && (
        <div className="mt-4 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-red-400">분석 실패</p>
          <p className="mt-1 text-xs text-muted-foreground">{errorMsg}</p>
          <button
            onClick={handleReset}
            className="mt-2 text-xs text-primary underline underline-offset-2"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  )
}

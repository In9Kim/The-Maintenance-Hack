import type { CarModel, MaintenancePart } from "@/types"
import { CAR_DATA, getCarById } from "@/lib/data/cars"

/**
 * 배포 주소. 배포 후 .env(.local) 또는 Vercel 환경변수에
 * NEXT_PUBLIC_SITE_URL=https://내도메인 을 넣으면 사이트맵·canonical에 반영됩니다.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")

/** "kia-sorento-mq4-engine-oil" → "engine-oil" */
export function partSlug(car: CarModel, part: MaintenancePart): string {
  const prefix = `${car.id}-`
  return part.id.startsWith(prefix) ? part.id.slice(prefix.length) : part.id
}

export function getPartBySlug(car: CarModel, slug: string): MaintenancePart | undefined {
  return car.parts.find((p) => partSlug(car, p) === slug)
}

/** "기아 쏘렌토 MQ4" — 세대 표기에서 괄호 설명은 뺀다 */
export function carShortName(car: CarModel): string {
  const gen = car.generation.replace(/\s*\(.*?\)\s*/g, "").trim()
  return [car.brand, car.model, gen].filter(Boolean).join(" ")
}

/** 페이지 제목용 부품명: "브레이크 패드 (전)" → "앞 브레이크 패드" */
export function partTitleName(part: MaintenancePart): string {
  return part.name
    .replace(/(.+?)\s*\(전\)/, "앞 $1")
    .replace(/(.+?)\s*\(후\)/, "뒤 $1")
    .replace(/\s*\((캐빈|전면|AGM|LFP|4개|HEPA \+ 캐빈)\)/g, "")
    .trim()
}

export function partCost(part: MaintenancePart) {
  const self = part.coupangPrice + part.laborCost
  const dealer = part.dealerPartPrice + part.dealerLaborCost
  const savings = Math.max(dealer - self, 0)
  const savingsPercent = dealer > 0 ? Math.round((savings / dealer) * 100) : 0
  return { self, dealer, savings, savingsPercent }
}

export function intervalText(part: MaintenancePart): string | null {
  const bits: string[] = []
  if (part.intervalKm) bits.push(`${part.intervalKm.toLocaleString("ko-KR")}km`)
  if (part.intervalMonths) bits.push(`${part.intervalMonths}개월`)
  return bits.length ? bits.join(" 또는 ") : null
}

/** 계산기 페이지로 이 차종을 미리 선택해서 보내는 링크 */
export function calculatorHref(car: CarModel, part?: MaintenancePart): string {
  const params = new URLSearchParams({ model: `${car.model} ${car.generation}` })
  if (part) params.set("part", part.name)
  return `/calculator?${params.toString()}`
}

/** 정적 페이지를 만들 차종 (검증 안 된 AI 생성 차종은 제외) */
export function seoCars(): CarModel[] {
  return CAR_DATA.filter((c) => c.is_verified !== false && c.parts.length > 0)
}

export function getSeoCar(id: string): CarModel | undefined {
  const car = getCarById(id)
  return car && car.is_verified !== false ? car : undefined
}

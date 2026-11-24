import type { Metadata } from "next"
import type { CarModel, MaintenancePart } from "@/types"
import { CAR_DATA, getCarById } from "@/lib/data/cars"

/**
 * 배포 주소. 배포 후 .env(.local) 또는 Vercel 환경변수에
 * NEXT_PUBLIC_SITE_URL=https://내도메인 을 넣으면 사이트맵·canonical에 반영됩니다.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://maintenance-hack.wwe9459.workers.dev").replace(/\/$/, "")

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

/**
 * 소모품 페이지 검색 제목 (네이버 검색광고 키워드 도구 2026-11 조사, data/keyword-volumes.json)
 *  - 엔진오일은 "교환"이 "교체"보다 5~9배 많이 검색됨, 와이퍼는 "사이즈", 배터리는 "규격"
 */
export function partSeoTitle(car: CarModel, part: MaintenancePart): string {
  const name = carShortName(car)
  const variant = part.name.match(/\((.*?)\)/)?.[1]
  const n = part.name
  if (part.category === "oil") return `${name} 엔진오일 교환비용·규격·용량${variant ? ` (${variant})` : ""}`
  if (part.category === "wiper") return `${name} 와이퍼 사이즈·가격·교체 방법`
  if (part.category === "battery") return `${name} ${/12V/.test(n) ? "12V 보조배터리" : "배터리"} 규격·교체비용`
  if (part.category === "filter" && /에어컨/.test(n)) return `${name} 에어컨필터 규격·교체주기·가격`
  if (part.category === "filter" && /에어클리너/.test(n)) return `${name} 에어클리너 필터 규격·교체비용`
  if (part.category === "brake") return `${name} ${partTitleName(part).replace("브레이크 패드", "브레이크패드")} 교체비용·주기`
  if (part.category === "spark") return `${name} 점화플러그 규격·교체비용·주기`
  return `${name} ${partTitleName(part)} 교체 비용·규격`
}

/** 본문 제목 동사: 엔진오일은 "교환" */
export const changeWord = (part: MaintenancePart) => (part.category === "oil" ? "교환" : "교체")

export function partCost(part: MaintenancePart) {
  const self = part.coupangPrice + part.laborCost
  const dealer = part.dealerPartPrice + part.dealerLaborCost
  const savings = Math.max(dealer - self, 0)
  const savingsPercent = dealer > 0 ? Math.round((savings / dealer) * 100) : 0
  return { self, dealer, savings, savingsPercent }
}

/** 차종의 대표 엔진 기준 소모품 전체 교체 비용 */
export function carTotals(car: CarModel) {
  const engine = car.engineTypes[0]
  let dealer = 0
  let self = 0
  for (const p of car.parts) {
    if (p.engine && p.engine !== engine) continue
    const c = partCost(p)
    dealer += c.dealer
    self += c.self
  }
  return { dealer, self, save: Math.max(dealer - self, 0) }
}

export function intervalText(part: MaintenancePart): string | null {
  const bits: string[] = []
  if (part.intervalKm) bits.push(`${part.intervalKm.toLocaleString("ko-KR")}km`)
  if (part.intervalMonths) bits.push(`${part.intervalMonths}개월`)
  return bits.length ? bits.join(" 또는 ") : null
}

/** 금액 기준 문구: 데이터를 마지막으로 고친 달 (data/vehicles.json updatedAt) */
export function priceBasis(car: CarModel): string {
  const m = car.updatedAt?.match(/^(\d{4})-(\d{2})/)
  const when = m ? `부품가 ${m[1]}년 ${Number(m[2])}월 시세 기준` : "부품가는 시세 기준 예상치"
  return `공임나라 표준 공임 · ${when}`
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

export const SITE_NAME = "정비핵"

/**
 * 페이지 메타데이터 공통 형식: 제목·설명·canonical + 링크 공유용 Open Graph.
 * (Next.js는 og:title을 페이지 제목에서 물려받지 않고, 하위 openGraph가 상위를 통째로 덮어써서
 *  app/opengraph-image.png 자동 연결도 사라지므로 이미지까지 여기서 함께 넣는다)
 */
const OG_IMAGE = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "정비핵 - 공식센터 정비 견적을 쿠팡 부품과 공임나라로 비교하는 자동차 정비 비용 계산기",
}

export function pageMetadata(m: {
  /** "… | 정비핵" 형태의 전체 제목 */
  title: string
  description: string
  /** "/cars/kia-sorento-mq4" 형태. 홈은 "/" */
  path: string
  robots?: Metadata["robots"]
}): Metadata {
  const url = `${SITE_URL}${m.path}`
  return {
    title: m.title,
    description: m.description,
    alternates: { canonical: url },
    openGraph: {
      title: m.title.replace(/\s*\|\s*정비핵$/, ""),
      description: m.description,
      url,
      siteName: SITE_NAME,
      locale: "ko_KR",
      type: "website",
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
    ...(m.robots ? { robots: m.robots } : {}),
  }
}

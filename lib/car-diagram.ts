/**
 * 차종 페이지 "부품 위치로 보기" 도면 데이터.
 * 차 옆모습(차체 4종) 위에 부위(엔진룸·앞유리·실내·앞바퀴·뒷바퀴)를 두고, 소모품을 부위에 나눠 담는다.
 */
import type { CarModel, MaintenancePart } from "@/types"

export type BodyType = "sedan" | "suv" | "van" | "truck"
export type ZoneId = "engine" | "wiper" | "cabin" | "front" | "rear"

const BODY: Record<string, BodyType> = {
  "kia-carnival-ka4": "van",
  "hyundai-staria-us4": "van",
  "kia-ray-tam": "van",
  "kia-bongo3-pu": "truck",
  "kia-k5-dl3": "sedan",
  "hyundai-avante-cn7": "sedan",
  "hyundai-avante-ad": "sedan",
  "hyundai-grandeur-gn7": "sedan",
  "hyundai-grandeur-ig": "sedan",
  "hyundai-sonata-dn8": "sedan",
  "kia-k8-gl3": "sedan",
  "genesis-g80-rg3": "sedan",
  "tesla-model3-highland": "sedan",
  "kia-morning-ja": "sedan",
}

export function bodyTypeOf(car: Pick<CarModel, "id">): BodyType {
  return BODY[car.id] ?? "suv"
}

/** 엔진오일이 없는 차 = 전기차 (테슬라, 아이오닉5) */
export function isElectric(car: Pick<CarModel, "parts">): boolean {
  return !car.parts.some((p) => p.category === "oil")
}

export function zoneOf(part: Pick<MaintenancePart, "category" | "name">): ZoneId {
  const n = part.name
  switch (part.category) {
    case "wiper":
      return "wiper"
    case "brake":
      return /\(후|뒤|후륜|라이닝|리어/.test(n) ? "rear" : "front"
    case "filter":
      return /에어컨|캐빈|실내/.test(n) ? "cabin" : "engine"
    case "fluid":
      return /브레이크/.test(n) ? "front" : "engine"
    default:
      return "engine"
  }
}

export function zoneLabel(zone: ZoneId, opts: { ev: boolean; body: BodyType }): { title: string; hint: string } {
  switch (zone) {
    case "engine":
      if (opts.body === "truck") return { title: "엔진", hint: "운전석 아래에 엔진이 있어요" }
      return opts.ev ? { title: "보닛 아래", hint: "보조배터리·감속기가 있는 앞쪽 공간" } : { title: "엔진룸", hint: "보닛을 열면 보이는 부품" }
    case "wiper":
      return { title: "앞유리", hint: "와이퍼 블레이드" }
    case "cabin":
      return { title: "실내", hint: "조수석 글러브박스 안쪽에 에어컨 필터가 있어요" }
    case "front":
      return { title: "앞바퀴", hint: "바퀴 안쪽 브레이크 디스크·패드" }
    case "rear":
      return { title: "뒷바퀴", hint: "뒷바퀴 브레이크" }
  }
}

/**
 * 내 주변 정비소·세차장 지도 (/near, /near/[kind])
 * 카카오 로컬 키워드 검색 결과를 이름·업종으로 한 번 더 걸러서 엉뚱한 가게(예: "노트북공임나라")를 뺀다.
 */
export interface NearKind {
  slug: string
  label: string
  /** 카카오 키워드 검색어 */
  query: string
  /** 결과를 남기는 조건 */
  name?: RegExp
  category?: RegExp
  title: string
  description: string
  intro: string
  color: string
}

export const NEAR_KINDS: NearKind[] = [
  {
    slug: "gongim",
    label: "공임나라",
    query: "공임나라",
    name: /공임나라/,
    category: /자동차정비/,
    title: "근처 공임나라 찾기 - 가까운 지점 지도·전화·길찾기",
    description: "지금 위치에서 가까운 공임나라 지점을 지도와 거리순 목록으로 보여 줍니다. 부품을 직접 사서 맡길 곳을 찾을 때 쓰세요.",
    intro: "부품을 직접 사 가면 공임만 받고 교체해 주는 곳이에요. 방문 전에 전화로 예약하세요.",
    color: "#0B7A53",
  },
  {
    slug: "bluehands",
    label: "블루핸즈",
    query: "블루핸즈",
    name: /블루핸즈/,
    category: /자동차정비/,
    title: "근처 블루핸즈 찾기 - 현대 공식 정비 지점 지도",
    description: "가까운 현대자동차 블루핸즈 지점을 지도와 거리순 목록으로 보여 줍니다. 리콜·무상수리는 공식 서비스에서 받으세요.",
    intro: "현대·제네시스 공식 협력 정비소예요. 리콜과 보증 수리는 여기서 받아요.",
    color: "#002C5F",
  },
  {
    slug: "autoq",
    label: "오토큐",
    query: "오토큐",
    name: /오토큐|autoq/i,
    category: /자동차정비/,
    title: "근처 기아 오토큐 찾기 - 기아 공식 정비 지점 지도",
    description: "가까운 기아 오토큐 지점을 지도와 거리순 목록으로 보여 줍니다. 리콜·무상수리는 공식 서비스에서 받으세요.",
    intro: "기아 공식 협력 정비소예요. 리콜과 보증 수리는 여기서 받아요.",
    color: "#05141F",
  },
  {
    slug: "carwash",
    label: "세차장",
    query: "세차장",
    category: /세차/,
    title: "근처 세차장 찾기 - 셀프세차장·손세차장 지도",
    description: "지금 위치에서 가까운 셀프세차장과 손세차장을 지도와 거리순 목록으로 보여 줍니다.",
    intro: "셀프세차장과 손세차장을 함께 보여 줘요. 영업시간은 카카오맵에서 확인하세요.",
    color: "#1570EF",
  },
]

export const nearKind = (slug: string) => NEAR_KINDS.find((k) => k.slug === slug)

export interface KakaoPlace {
  id: string
  place_name: string
  category_name: string
  phone: string
  address_name: string
  road_address_name: string
  x: string
  y: string
  place_url: string
  distance: string
}

export function keepPlace(kind: NearKind, p: KakaoPlace): boolean {
  if (kind.name && !kind.name.test(p.place_name)) return false
  if (kind.category && !kind.category.test(p.category_name)) return false
  return true
}

/** 거리 표시: 950m / 1.2km / 12km */
export function distanceText(m: number): string {
  if (!Number.isFinite(m)) return ""
  if (m < 1000) return `${Math.round(m / 10) * 10}m`
  return m < 10000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m / 1000)}km`
}

/** 두 좌표 사이 거리(m) */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000, rad = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

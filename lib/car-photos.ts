/**
 * 차종별 대표 사진 (data/car-photos.json, Wikimedia Commons).
 * CC BY / CC BY-SA 사진이라 화면에 저작자·라이선스·원본 링크를 꼭 함께 표시한다.
 */
import raw from "@/data/car-photos.json"

export interface CarPhoto {
  src: string
  width: number
  height: number
  title: string
  page: string
  author: string
  license: string
  licenseUrl?: string
  confidence?: "high" | "medium"
  /** public/cars/ 에 저장한 사본 (1024px / 480px webp) */
  local: string
  localSmall: string
  /** 원본을 고쳤으면 무엇을 했는지 (CC BY-SA: 변경 사항 표시) */
  edited?: string
  original?: { local: string; localSmall: string; width: number; height: number }
}

const PHOTOS = ((raw as { photos?: Record<string, CarPhoto> }).photos ?? {}) as Record<string, CarPhoto>

export function carPhoto(carId: string): CarPhoto | undefined {
  return PHOTOS[carId]
}

export function allCarPhotos(): Record<string, CarPhoto> {
  return PHOTOS
}

/**
 * 부품 종류별 대표 사진 (data/part-photos.json, Wikimedia Commons).
 * credit=true(CC BY / BY-SA)인 사진은 화면에 저작자·라이선스·원본 링크를 함께 표시한다.
 * 종류 문자열은 components/PartIcon.tsx의 Kind와 같다('other' 제외). 파일 겹침을 피하려고 따로 정의.
 */
import raw from "@/data/part-photos.json"

export type PartPhotoKind = "oil" | "air" | "cabin" | "fuel" | "pad" | "disc" | "lining" | "spark" | "wiper" | "battery" | "fluid"

export const PART_PHOTO_KINDS: readonly PartPhotoKind[] = ["oil", "air", "cabin", "fuel", "pad", "disc", "lining", "spark", "wiper", "battery", "fluid"]

export interface PartPhoto {
  /** public/parts/{kind}.webp (480px 정사각형) */
  local: string
  /** public/parts/{kind}-128.webp (128px 정사각형) */
  localSmall: string
  title: string
  page: string
  author: string
  license: string
  licenseUrl?: string
  /** 원본을 고쳤으면 무엇을 했는지 (예: "정사각형으로 자름") */
  edited?: string
  /** 화면에 저작자 표시가 필요한지 (PD·CC0면 false, CC BY/BY-SA면 true) */
  credit: boolean
  /** 출처 목록에 쓸 한국어 이름 (예: '엔진오일') */
  label: string
}

const PHOTOS = ((raw as { photos?: Record<string, PartPhoto> }).photos ?? {}) as Record<string, PartPhoto>

export function partPhoto(kind: string): PartPhoto | undefined {
  if (!(PART_PHOTO_KINDS as readonly string[]).includes(kind)) return undefined
  return PHOTOS[kind]
}

export function allPartPhotos(): Array<{ kind: PartPhotoKind } & PartPhoto> {
  return PART_PHOTO_KINDS.filter((k) => PHOTOS[k]).map((k) => ({ kind: k, ...PHOTOS[k] }))
}

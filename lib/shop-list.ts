/**
 * "정비소에 보여주기" 리스트 — 직접 산 부품을 공임나라 같은 정비소에 보여 줄 목록.
 * 이 기기(localStorage)에만 저장한다. 차종(car model id)마다 따로.
 */

export const SHOP_LIST_KEY = "mh_shop_list"
export const SHOP_LIST_EVENT = "mh-shop-list"

export interface ShopItem {
  /** 정비핵 소모품이면 그 slug (규격·품번을 붙여 보여 줌). 견적서에서 온 다른 항목이면 없음 */
  slug?: string
  name: string
  /** 산(살) 상품 이름 */
  bought?: string
}

export type ShopLists = Record<string, ShopItem[]>

const same = (a: ShopItem, b: ShopItem) => (a.slug && b.slug ? a.slug === b.slug : a.name.trim() === b.name.trim())

export function parseShopLists(raw: string | null): ShopLists {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw)
    if (!v || typeof v !== "object" || Array.isArray(v)) return {}
    const out: ShopLists = {}
    for (const [k, list] of Object.entries(v)) {
      if (!Array.isArray(list)) continue
      out[k] = list
        .filter((x): x is ShopItem => !!x && typeof x === "object" && typeof (x as ShopItem).name === "string" && (x as ShopItem).name.trim() !== "")
        .slice(0, 30)
    }
    return out
  } catch {
    return {}
  }
}

export function loadShopList(carId: string): ShopItem[] {
  if (typeof window === "undefined") return []
  try {
    return parseShopLists(localStorage.getItem(SHOP_LIST_KEY))[carId] ?? []
  } catch {
    return []
  }
}

export function saveShopList(carId: string, items: ShopItem[]) {
  try {
    const all = parseShopLists(localStorage.getItem(SHOP_LIST_KEY))
    if (items.length) all[carId] = items.slice(0, 30)
    else delete all[carId]
    localStorage.setItem(SHOP_LIST_KEY, JSON.stringify(all))
    window.dispatchEvent(new Event(SHOP_LIST_EVENT))
  } catch {
    /* 저장 못 해도 화면은 동작 */
  }
}

/** 이미 있으면 그대로, 없으면 뒤에 붙임 */
export function addItem(list: ShopItem[], item: ShopItem): ShopItem[] {
  return list.some((x) => same(x, item)) ? list : [...list, { ...item, name: item.name.trim() }]
}

export function removeItem(list: ShopItem[], item: ShopItem): ShopItem[] {
  return list.filter((x) => !same(x, item))
}

export function hasItem(list: ShopItem[], item: ShopItem): boolean {
  return list.some((x) => same(x, item))
}

/** 전화로 물어볼 문장 */
export function phoneScript(carLine: string, items: ShopItem[]): string {
  const names = items.map((i) => i.name).join(", ")
  return `안녕하세요. ${carLine}인데요, ${names} 부품을 제가 직접 사서 가져가면 교체해 주실 수 있나요? 된다면 공임은 얼마인지, 예약이 필요한지 궁금합니다.`
}

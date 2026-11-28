// 브라우저(쿠팡 검색 결과 조각)에서 쓰므로 다른 데이터 파일을 import 하지 않는다

/**
 * 쿠팡 검색 결과 보여 줄 순서: 정비핵이 골라 둔 상품(pickId)은 맨 앞, 나머지 상위 상품은 가격순. 최대 max개.
 * (예전에는 상위 3개를 가격순으로만 정렬해서, 골라 둔 디젤 세트가 뒤로 밀리거나 잘렸음)
 */
export function orderCoupangItems<T extends { productId: number | string; price: number }>(list: T[], pickId?: number | null, max = 3): T[] {
  const pick = pickId ? list.find((x) => Number(x.productId) === Number(pickId)) : undefined
  const rest = list
    .filter((x) => x !== pick)
    .slice(0, pick ? max - 1 : max)
    .sort((a, b) => a.price - b.price)
  return pick ? [pick, ...rest] : rest
}

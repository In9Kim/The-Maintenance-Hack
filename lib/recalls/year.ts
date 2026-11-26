// 브라우저(리콜 띠)에서도 쓰므로 다른 데이터 파일을 import 하지 않는다

/** 리콜 띠에 필요한 최소 정보: 차종 이름 + 리콜마다 [id, 시작일, 생산 시작, 생산 끝] (최근 것 먼저) */
export interface CarRecallAlert {
  name: string
  r: [id: string, date: string, from: string, to: string][]
}

/**
 * 연식(○○년형)에 해당할 수 있는 리콜만. 연식 Y는 보통 Y-1년 하반기부터 Y년 말까지 생산된다고 보고
 * 생산 기간이 겹치면 해당 가능으로 친다 (정확한 해당 여부는 리콜센터에서 차대번호로 확인).
 * 연식이 없거나 생산 기간을 모르면 빼지 않는다.
 */
export function recallsForYear(a: CarRecallAlert, year?: number): CarRecallAlert["r"] {
  if (!year) return a.r
  const start = `${year - 1}-07-01`
  const end = `${year}-12-31`
  return a.r.filter(([, , from, to]) => !from || !to || (from <= end && to >= start))
}

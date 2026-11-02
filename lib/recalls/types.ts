/** 리콜 데이터 형식 (data/recalls.json, scripts/fetch-recalls.mjs가 생성) */

/** 리콜 대상 차명 한 줄 (같은 리콜이라도 차명·생산기간별로 여러 줄) */
export interface RecallItem {
  /** 원문 차명. 예: "쏘렌토(MQ4)", "Model 3" */
  name: string
  /** 생산기간 시작 (YYYY-MM-DD) */
  from: string
  /** 생산기간 끝 (YYYY-MM-DD) */
  to: string
}

/** 리콜 한 건 = 제작자 + 리콜개시일 + 리콜사유가 같은 줄을 묶은 것 */
export interface Recall {
  /** "2025-01-24-1a2b3c" 형태의 고정 ID */
  id: string
  /** 원문 제작자명. 예: "기아 주식회사" */
  maker: string
  /** 화면 표시용 제작사명. 예: "기아" */
  makerName: string
  /** 제작사 필터 주소용. 예: "kia" */
  makerSlug: string
  /** 리콜개시일 (YYYY-MM-DD) */
  startDate: string
  /** 리콜사유 원문 */
  reason: string
  /** 시정 방법. 현재 데이터(연간 공개 파일)에는 없어서 null — 실시간 API 승인 후 채움 */
  fix: string | null
  items: RecallItem[]
  /** 우리 데이터에 처음 들어온 날 (recalls_new.json 계산용) */
  firstSeen: string
}

export interface RecallData {
  /** 데이터 기준일: 원본 데이터셋의 기준일 중 가장 최근 (YYYY-MM-DD). 데이터가 없으면 null */
  dataAsOf: string | null
  /** 이 파일의 리콜 내용이 마지막으로 바뀐 날 */
  updatedAt: string | null
  /** 담긴 원본 데이터셋 기준일 목록 */
  datasets: string[]
  recalls: Recall[]
}

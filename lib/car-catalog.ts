/**
 * 차 등록용 전체 차종 목록 (모델 이름만). 정비핵에 부품 정보가 있는 차(data/vehicles.json)는 세대를 골라 등록하고,
 * 없는 차도 이름으로 등록할 수 있게 한다 (부품 정보는 '준비 중', 견적서·정비소·리콜은 그대로).
 * 국내 판매 중이거나 많이 굴러다니는 승용·RV 위주. 빠진 차는 '목록에 없어요'로 직접 적을 수 있다.
 */
export interface CatalogBrand {
  brand: string
  /** 검색용 다른 표기 */
  alias?: string[]
  imported?: boolean
  models: string[]
}

export const CAR_CATALOG: CatalogBrand[] = [
  {
    brand: "현대",
    alias: ["hyundai"],
    models: ["아반떼", "쏘나타", "그랜저", "아이오닉5", "아이오닉6", "아이오닉9", "코나", "베뉴", "투싼", "싼타페", "팰리세이드", "캐스퍼", "스타리아", "포터2", "넥쏘", "i30", "벨로스터", "엑센트", "아슬란", "맥스크루즈", "그랜드 스타렉스"],
  },
  {
    brand: "기아",
    alias: ["kia"],
    models: ["모닝", "레이", "K3", "K5", "K8", "K9", "스팅어", "셀토스", "니로", "스포티지", "쏘렌토", "모하비", "카니발", "EV3", "EV4", "EV5", "EV6", "EV9", "봉고3", "쏘울", "스토닉", "카렌스"],
  },
  { brand: "제네시스", alias: ["genesis"], models: ["G70", "G80", "G90", "GV60", "GV70", "GV80"] },
  { brand: "KG모빌리티", alias: ["쌍용", "kgm", "ssangyong"], models: ["토레스", "티볼리", "코란도", "렉스턴", "렉스턴 스포츠", "액티언"] },
  { brand: "쉐보레", alias: ["chevrolet", "GM대우", "한국GM"], models: ["트랙스", "트레일블레이저", "스파크", "말리부", "트래버스", "콜로라도", "타호", "이쿼녹스"] },
  { brand: "르노코리아", alias: ["르노", "renault", "르노삼성", "삼성"], models: ["그랑 콜레오스", "아르카나", "QM6", "SM6", "XM3", "QM3", "SM5"] },
  { brand: "테슬라", alias: ["tesla"], imported: true, models: ["Model 3", "Model Y", "Model S", "Model X"] },
  { brand: "BMW", imported: true, models: ["1시리즈", "3시리즈", "5시리즈", "7시리즈", "X1", "X3", "X5", "X7", "i4", "iX3", "i5"] },
  { brand: "벤츠", alias: ["mercedes", "메르세데스"], imported: true, models: ["A클래스", "C클래스", "E클래스", "S클래스", "GLA", "GLC", "GLE", "GLS", "CLA", "EQE"] },
  { brand: "아우디", alias: ["audi"], imported: true, models: ["A3", "A4", "A6", "A8", "Q3", "Q5", "Q7", "Q8 e-tron"] },
  { brand: "폭스바겐", alias: ["volkswagen", "vw"], imported: true, models: ["골프", "제타", "파사트", "티구안", "투아렉", "ID.4"] },
  { brand: "볼보", alias: ["volvo"], imported: true, models: ["S60", "S90", "XC40", "XC60", "XC90", "EX30"] },
  { brand: "토요타", alias: ["toyota"], imported: true, models: ["캠리", "프리우스", "RAV4", "시에나", "크라운"] },
  { brand: "렉서스", alias: ["lexus"], imported: true, models: ["ES", "NX", "RX", "UX"] },
  { brand: "혼다", alias: ["honda"], imported: true, models: ["어코드", "CR-V", "오딧세이"] },
  { brand: "미니", alias: ["mini"], imported: true, models: ["쿠퍼", "컨트리맨", "클럽맨"] },
  { brand: "포르쉐", alias: ["porsche"], imported: true, models: ["카이엔", "마칸", "파나메라", "타이칸", "911"] },
  { brand: "지프", alias: ["jeep"], imported: true, models: ["랭글러", "그랜드 체로키", "레니게이드"] },
  { brand: "포드", alias: ["ford"], imported: true, models: ["익스플로러", "머스탱", "레인저"] },
  { brand: "BYD", imported: true, models: ["아토3", "씰", "씨라이언7"] },
]

/** 검색용으로 공백·대소문자 무시 */
export const normName = (s: string) => s.toLowerCase().replace(/[\s\-_.]/g, "")

/** 정비핵 차량 데이터의 모델 이름이 목록과 조금 달라도 맞추기 (예: 봉고3) */
export function sameModel(a: string, b: string) {
  return normName(a) === normName(b)
}

/** 부품 정보가 없는 차의 id = "x:브랜드 모델" (화면 이름으로도 씀, 계정 저장 키 80자 이하). /cars/ 페이지가 없는 차 */
export const customCarId = (brand: string, model: string) => `x:${brand.trim()} ${model.trim()}`.replace(/\s+/g, " ").slice(0, 80)
export const isCustomCar = (id: string) => id.startsWith("x:")

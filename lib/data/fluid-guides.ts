/**
 * 소모품 표(data/vehicles.json)에 없는 정비 안내: 변속기 오일·냉각수.
 * 가격 데이터가 없어 비용 계산에는 넣지 않고, 공식 취급설명서로 확인한 규격·용량·주기만 둔다.
 * 확인 못 한 값(드레인 플러그·와셔 품번, 공임)은 넣지 않는다.
 */

export interface TransmissionRow {
  engine: string
  transmission: string
  fluid: string
  /** 설명서 '추천오일 및 용량'의 용량 (L). 정비소에서 실제로 갈아 넣는 양이 아니라 변속기 전체 용량 */
  capacity: string
  normal: string
  severe: string
  /** 소모품 표의 엔진 이름 (CarModel.engineTypes) — 주행거리별 목록에서 엔진을 나눌 때 */
  engineType: string
  /** 가혹 조건 교체 주기 (km) */
  severeKm?: number
  note?: string
}

export interface CoolantRow {
  transmission: string
  capacity: string
  engineType?: string
}

export interface FluidGuide {
  transmission: TransmissionRow[]
  transmissionNotes: string[]
  transmissionSource: string
  coolant: {
    rows: CoolantRow[]
    fluid: string
    mix: string
    interval: string
    firstKm: number
    firstYears: number
    thenKm: number
    thenYears: number
    notes: string[]
    source: string
  }
  /** 이 안내를 마지막으로 확인한 날 */
  checkedAt: string
}

export const FLUID_GUIDES: Record<string, FluidGuide> = {
  "kia-k3-bd": {
    checkedAt: "2026-11-25",
    transmission: [
      {
        engine: "스마트스트림 G1.6 가솔린",
        engineType: "G1.6 가솔린",
        transmission: "IVT (무단변속기)",
        fluid: "IVTF SP-CVT1 (기아 순정)",
        capacity: "6.7L",
        normal: "무점검·무교체",
        severe: "100,000km마다 교체",
        severeKm: 100000,
        note: "2019·2020년형 설명서는 엔진을 '감마II 1.6 MPI'로 표기 (같은 6.7L·SP-CVT1)",
      },
      {
        engine: "1.6 T-GDi 가솔린 (GT)",
        engineType: "G1.6 T-GDi 가솔린 (GT)",
        transmission: "더블 클러치 변속기 (DCT)",
        fluid: "2022년형 이후: 기아 순정 DCTF 70W SYNTHETIC PLUS · 2019~2021년형: SAE 70W, API GL-4 (HK SYN DCTF 70W 등)",
        capacity: "1.9~2.0L",
        normal: "무점검·무교체",
        severe: "120,000km마다 교체",
        severeKm: 120000,
        note: "주기는 2021·2022·2023년형 설명서 기준. 2019·2020년형 설명서 정기 점검표에서는 DCT 항목을 확인하지 못했어요",
      },
    ],
    transmissionNotes: [
      "설명서는 IVT 변속기 오일의 교환·보충을 기아 직영 서비스센터 또는 서비스협력사(오토큐)에서 하라고 안내하고, 비순정 오일을 쓰면 IVT 변속기 품질 보증이 안 된다고 적어 두었어요.",
      "설명서는 '순정품과 호환 가능하다고 적힌 오일'도 쓰지 말고 정품 IVTF(SP-CVT1)만 쓰라고 안내해요.",
      "표의 용량은 변속기 전체에 들어가는 양이에요. 오일을 갈 때 실제로 빠지고 다시 들어가는 양은 교환 방식에 따라 달라요.",
    ],
    transmissionSource: "기아 K3(BD) 국문 취급설명서 2019·2020·2021년형(PDF) '추천오일 및 용량'·'정기 점검', 2022·2023년형(웹 설명서) '추천오일 및 용량'·'통상 조건'·'가혹조건'",
    coolant: {
      rows: [
        { transmission: "IVT 차량 (1.6 가솔린)", capacity: "6.6L", engineType: "G1.6 가솔린" },
        { transmission: "DCT 차량 (GT 1.6 터보)", capacity: "6.9L", engineType: "G1.6 T-GDi 가솔린 (GT)" },
      ],
      fluid: "알루미늄 라디에이터용 인산염계 에틸렌글리콜 부동액과 물의 혼합액 (기아 사계절 순정 부동액 권장)",
      mix: "부동액 50% + 물 50% (출고 때는 부동액 45%). 부동액 농도가 60%를 넘거나 35% 아래면 엔진 내부 부식·과열 위험",
      interval: "처음 200,000km 또는 10년, 그다음부터 40,000km 또는 2년마다 교체",
      firstKm: 200000,
      firstYears: 10,
      thenKm: 40000,
      thenYears: 2,
      notes: [
        "냉각수 양은 엔진이 식었을 때 보조 탱크 옆면의 최대선(F)과 최소선(L) 사이에 있어야 해요. 모자라면 같은 비율로 섞어 최대선까지 채워요.",
        "엔진이 뜨거울 때 라디에이터 캡을 열면 뜨거운 냉각수가 뿜어져 나올 수 있어요. 반드시 식은 뒤에 여세요.",
        "냉각수가 자주 줄면 누수 점검이 먼저예요. 보충만 반복하지 마세요.",
      ],
      source: "기아 K3(BD) 국문 취급설명서 2019·2020·2021년형(PDF) '추천오일 및 용량'·'정기 점검'·'냉각수 점검', 2022·2023년형(웹 설명서) '추천오일 및 용량'·'통상 조건'",
    },
  },
}

export function fluidGuideFor(carId: string): FluidGuide | undefined {
  return FLUID_GUIDES[carId]
}

export const GUIDE_CAR_IDS = Object.keys(FLUID_GUIDES)

/** 정비 안내 페이지 (app/cars/[carId]/<slug>) */
export const GUIDE_PAGES = [
  { slug: "maintenance-schedule", label: "주행거리별 교체 목록", sub: "2만~20만 km에 뭘 갈아야 하나" },
  { slug: "transmission-oil", label: "미션오일", sub: "IVT·DCT 규격·용량·주기" },
  { slug: "coolant", label: "냉각수(부동액)", sub: "용량·혼합 비율·교체 주기" },
] as const

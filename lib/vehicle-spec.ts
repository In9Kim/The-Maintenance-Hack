import { decodeVehicleSpec, type VehicleSpec } from "@/lib/gemini"
import { lookupVehicleSpec, makeVinPrefix, sheetsEnabled, writeVehicleSpec } from "@/lib/googleSheets"
import { vinFacts } from "@/lib/vin"

/**
 * 차대번호 → 고정된 차량 정보
 *  1) 구글시트에 저장된 정보가 있으면 그대로 사용 (사람이 고친 값도 여기서 반영)
 *  2) 없으면 AI로 차량 정보만 해석 (브랜드·연식은 코드로 확정) → 저장
 *
 * 실패해도 null을 돌려줘서, 기존처럼 판정 단계에서 AI가 차량까지 해석하도록 둔다.
 */
export async function getFixedVehicleSpec(
  vin: string
): Promise<{ spec: VehicleSpec; source: "sheet" | "ai"; save?: () => Promise<void> } | null> {
  const prefix = makeVinPrefix(vin)
  const useSheets = sheetsEnabled()

  if (useSheets) {
    const saved = await lookupVehicleSpec(prefix)
    if (saved) return { spec: saved, source: "sheet" }
  }

  try {
    const spec = await decodeVehicleSpec(vin, vinFacts(vin))
    const identified = spec.manufacturer_model && !/확인 필요|알 수 없|unknown/i.test(spec.manufacturer_model)
    return {
      spec,
      source: "ai",
      // 모델을 확실히 알아낸 경우에만 저장 (응답을 먼저 보내고 뒤에서 저장)
      save: useSheets && identified ? () => writeVehicleSpec(prefix, spec) : undefined,
    }
  } catch (err) {
    console.error("[vehicle-spec]", err instanceof Error ? err.message : err)
    return null
  }
}

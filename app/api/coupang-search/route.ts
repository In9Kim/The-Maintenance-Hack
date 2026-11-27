import { NextRequest, NextResponse } from "next/server"
import { getSeoCar, partSlug } from "@/lib/seo"
import { allowSearch, coupangSearch } from "@/lib/coupang-api"
import { coupangPickFor } from "@/lib/coupang-links"

/**
 * /check 화면 안에서 쿠팡 상품 검색 (앱 이동 없이 고르기).
 * GET ?carId=…&part=부품주소  또는  ?carId=…&q=자유검색어 → 차 이름을 붙여 검색, 상위 10개 + 정비핵 추천 상품 표시
 */
/** 여러 부품에 두루 붙는 말 (구별에 쓰지 않음) */
const GENERIC = new Set(["브레이크", "엔진", "필터", "블레이드", "전면", "앞", "뒤", "전", "후", "세트", "12V", "4개", "프론트", "리어", "좌", "우", "좌우"])
/** 견적서에 흔한 다른 이름 (상품명에는 이쪽으로 적힌 경우가 많음) */
const ALIAS: Record<string, string[]> = { 하부암: ["로어암", "로워암", "컨트롤암"], 쇽업소버: ["쇼바", "쇼크업소버"], 점화플러그: ["플러그"], 미션오일: ["ATF", "오토미션오일"], 로어암: ["로우암", "로워암", "컨트롤암", "하부암"], 쇼바: ["쇽업", "쇼크업", "쇽업소버"], 엔진미미: ["엔진마운트", "엔진미미"], 미션미미: ["미션마운트"], 배터리: ["밧데리", "AGM", "CMF", "DIN"] }
/** 부품 검색에 같이 걸리는 공구·다른 부품 (점화플러그 렌치, 점화코일 세트, 습기건조기 등) */
const NOT_PART = /렌치|소켓|점화\s*코일|코일\s*\d|습기|건조기|스포일러|에어댐|사이드\s*스[커컷]|도어\s*모듈|충전기|점프|단자|와이퍼|가스\s*쇼바|도어\s*쇼바|트렁크|본넷|후드\s*리프트|부싱/
/** 차종 전용이라 상품명에 차 이름이 있어야 믿을 수 있는 부품 (배터리는 규격 공용 상품이 많아 제외) */
const CAR_SPECIFIC = new Set(["brake", "spark"])
/** 현대·기아 세대 코드 (상품명에 다른 세대 코드만 있으면 그 세대용) */
const GEN_CODES = /\b(BL|XM|UM|MQ4|TD|HD|MD|AD|CN7|YD|BD|JF|DL3|LF|YF|NF|DN8|HG|IG|GN7|TL|NX4|QL|NQ5|SL|KA4|YP|VQ|DM|TM|MX5|SP2|JA|TAM|SG2|DE|GL3|YG|TF)\b/g

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const car = getSeoCar(sp.get("carId") ?? "")
  if (!car) return NextResponse.json({ error: "차종을 먼저 골라 주세요." }, { status: 400 })
  const code = car.generation.split(/\s/)[0]
  const name = [car.model, /^[A-Z][A-Z0-9]{1,4}$/.test(code) ? code : ""].filter(Boolean).join(" ")
  const part = sp.get("part") ? car.parts.find((p) => partSlug(car, p) === sp.get("part")) : undefined
  const q = (sp.get("q") ?? "").trim().slice(0, 40)
  if (!part && q.length < 2) return NextResponse.json({ error: "찾을 부품을 고르거나 적어 주세요." }, { status: 400 })

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  // 하루 횟수는 쿠팡을 실제로 부를 때만 센다 (같은 검색어는 하루 저장돼서 공짜)
  let allowed: boolean | undefined
  const gate = async () => (allowed ??= await allowSearch(ip))
  const partName = part ? part.name.replace(/\s*\(.*?\)/g, "").replace(/\+/g, " ") : ""
  const keyword = part ? `${name} ${partName}` : q.includes(car.model) ? q : `${name} ${q}`
  try {
    // 쿠팡 검색은 비슷한 다른 부품(디스크 → 패드)이 섞여 나와서, 부품을 구별하는 낱말이 상품명에 있는 것만
    const base = (part ? partName : q).split(/\s+/).filter((w) => w.length >= 2 && !GENERIC.has(w))
    const words = base.flatMap((w) => [w, ...(ALIAS[w] ?? [])])
    const relevant = (list: Awaited<ReturnType<typeof coupangSearch>>) =>
      words.length ? list.filter((x) => words.some((w) => x.name.replace(/\s/g, "").includes(w))) : list
    const all = await coupangSearch(keyword, 10, gate)
    let kept = relevant(all)
    let items = kept.length >= 3 ? kept : all
    if (part && ["battery", "brake", "spark"].includes(part.category)) {
      // 배터리·브레이크·점화플러그: 관련 없는 상품으로 채우지 않는다 (적으면 적은 대로)
      const front = /\(전\)|앞/.test(part.name)
      const rear = /\(후\)|뒤/.test(part.name)
      const model = car.model.replace(/\s/g, "")
      const both = /앞뒤|앞,뒤|앞\/뒤/
      const genCode = /^[A-Z][A-Z0-9]{1,4}$/.test(code) ? code.toUpperCase() : ""
      items = kept.filter((x) => {
        const n = x.name.replace(/\s/g, "")
        if (NOT_PART.test(x.name)) return false
        if (CAR_SPECIFIC.has(part.category) && !n.includes(model)) return false
        // 같은 차 이름의 다른 세대 상품 (쏘렌토 MQ4에 '구형 BL'·'UM' 패드) 제외: 세대 코드가 적혀 있는데 우리 코드가 없으면
        if (CAR_SPECIFIC.has(part.category) && genCode) {
          const codes: string[] = x.name.toUpperCase().match(GEN_CODES) ?? []
          if (codes.length && !codes.includes(genCode)) return false
        }
        // 앞·뒤 한쪽만인 상품 걸러내기 (앞뒤 세트는 둘 다 통과)
        const frontOnly = /앞|전륜|전브레이크/.test(n) && !/뒤|뒷|후륜/.test(n)
        const rearOnly = /뒤|뒷|후륜/.test(n) && !/앞|전륜/.test(n)
        if (front && rearOnly && !both.test(n)) return false
        if (rear && frontOnly && !both.test(n)) return false
        return true
      })
    }
    if (!part) {
      // 직접 적은 검색어: 맞는 상품이 없으면 쿠팡이 엉뚱한 상품(샴푸 등)을 돌려줌 → 관련 있는 것만. 없으면 다른 이름으로 한 번 더
      const alt = base.length ? ALIAS[base[base.length - 1]]?.[0] : undefined
      // 세대 코드(BD)를 붙이면 안 나오는 상품이 많아서, 없으면 차 이름만으로 한 번 더
      if (!kept.length && name !== car.model && !q.includes(car.model)) kept = relevant(await coupangSearch(`${car.model} ${q}`, 10, gate))
      if (!kept.length && alt) kept = relevant(await coupangSearch(`${car.model} ${alt}`, 10, gate))
      // 차 이름이 상품명에 없는 건 다른 용도(낚시용 워터펌프 등)일 가능성이 커서 뺌
      const model = car.model.replace(/\s/g, "")
      const genCode = /^[A-Z][A-Z0-9]{1,4}$/.test(code) ? code.toUpperCase() : ""
      items = kept.filter((x) => {
        if (!x.name.replace(/\s/g, "").includes(model)) return false
        // 공구·다른 부품 (쇼바 검색에 도어 가스쇼바 등). 검색어에 그 말이 있으면 통과
        if (NOT_PART.test(x.name) && !NOT_PART.test(q)) return false
        // 다른 세대 코드만 적힌 상품 (K3 BD인데 'YD'용)
        const codes: string[] = x.name.toUpperCase().match(GEN_CODES) ?? []
        if (genCode && codes.length && !codes.includes(genCode)) return false
        return true
      })
      // 우리 세대 코드(BD)가 적힌 상품을 앞으로
      if (genCode) items = [...items].sort((a, b) => Number(b.name.toUpperCase().includes(genCode)) - Number(a.name.toUpperCase().includes(genCode)))
    }
    const pick = part ? coupangPickFor(part) : undefined
    return NextResponse.json(
      { keyword, pickId: pick?.productId ? Number(pick.productId) : null, items },
      { headers: { "Cache-Control": "public, max-age=600" } },
    )
  } catch (e) {
    if (e instanceof Error && e.message === "LIMIT") return NextResponse.json({ error: "오늘 검색을 많이 했어요. 내일 다시 이용해 주세요." }, { status: 429 })
    return NextResponse.json({ error: "쿠팡 검색이 잠시 안 돼요. 조금 뒤 다시 시도해 주세요." }, { status: 502 })
  }
}

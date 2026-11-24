/**
 * 엔진오일 규격(점도 + 가솔린/디젤)마다 쿠팡에서 3가지 선택지를 골라 data/coupang-oil-tiers.json에 저장한다.
 *  - oem:     현대·기아 순정(현대모비스) 엔진오일
 *  - value:   잘 알려진 브랜드 중 1L당 가장 싼 것 (가성비)
 *  - premium: 상위 라인 (모빌1·캐스트롤 엣지·쉘 힐릭스 울트라·모튤·킥스 파오·지크 TOP)
 * 모두 상품명에 점도가 있어야 하고, 디젤이면 ACEA C 등급, 가솔린이면 API SP(또는 GF-6) 표기가 있어야 통과.
 * 차종마다 다시 찾지 않고 규격별로 한 번만 찾아서, 화면에서 그 차의 필요 용량과 비교해 보여 준다.
 *
 * 실행: node scripts/pick-coupang-oil-tiers.mjs   (.env.local 의 쿠팡 키 사용, 값은 출력하지 않음)
 */
import { readFileSync, writeFileSync } from "node:fs"
import { search, env, viscosityOf, litersOf } from "./pick-coupang-oil.mjs"

const OUT = "data/coupang-picks.json" // 추천 상품 파일 안의 oilTiers 칸에 함께 저장 (빌드가 파일 하나로 읽게)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const norm = (s) => s.toUpperCase().replace(/\s+/g, "").replace(/-/g, "")

const BRANDS = /킥스|KIXX|지크|ZIC|엑스티어|XTEER|에스오일|S-OIL|세븐|모빌|MOBIL|쉘|SHELL|캐스트롤|CASTROL|토탈|TOTAL|모튤|MOTUL|발보린|VALVOLINE|리퀴몰리|LIQUI|모비스|순정/i
const OEM = /모비스|현대\s*순정|기아\s*순정|현대기아\s*순정/
const PREMIUM = /모빌\s*1|MOBIL\s*1|캐스트롤\s*엣지|CASTROL\s*EDGE|힐릭스\s*울트라|HELIX\s*ULTRA|모튤|MOTUL|파오|PAO|지크\s*TOP|ZIC\s*TOP/i
const BAD = /세트|필터|급유기|주유기|펌프|교환기|코팅제|첨가제|쌍용|KGM|토요타|도요타|TOYOTA|렉서스|혼다|닛산|르노|쉐보레|BMW|벤츠|아우디|폭스바겐|볼보|포드|중고|리필|공임/i

/** 상품명에서 전체 용량(L). "1L x 4", "4L+1L", "1L 4개" 도 계산 */
export function totalLiters(title) {
  const plus = title.match(/(\d(?:\.\d)?)\s*L\s*\+\s*(\d(?:\.\d)?)\s*L/i)
  if (plus) return +plus[1] + +plus[2]
  const cnt = title.match(/(?<![\d.])(\d(?:\.\d)?)\s*L\b[^\d]{0,12}?(\d{1,2})\s*(?:개|통|병|EA)/i)
  if (cnt && +cnt[2] > 1 && +cnt[2] <= 12) return +cnt[1] * +cnt[2]
  return litersOf(title)
}

/** 점도는 상품명에 꼭 있어야. 디젤은 ACEA C 등급도 꼭 (DPF 보호). 가솔린 등급(SP·GF-6)은 상품명에 없을 수 있어 따로 표시 */
export function specOk(title, { visc, diesel }) {
  const t = norm(title)
  if (visc && !t.includes(norm(visc))) return false
  if (diesel) return /C[235]/.test(title.toUpperCase()) && !/가솔린\s*전용/.test(title)
  return !/디젤\s*전용|DPF|ACEA\s*C|\bC[235]\b/i.test(title)
}
export const gradeShown = (title, diesel) => (diesel ? /C[235]/.test(title.toUpperCase()) : /\bSP\b|SQ|GF-?[67]/i.test(title))

async function main() {
  const ak = env("COUPANG_ACCESS_KEY")
  const sk = env("COUPANG_SECRET_KEY")
  if (!ak || !sk) throw new Error(".env.local 에 쿠팡 키가 없습니다")
  const raw = JSON.parse(readFileSync("data/vehicles.json", "utf8"))
  const cars = raw.cars ?? raw
  const keys = new Map()
  /** 소모품 id → 규격 키 (화면은 이 표만 보고 3가지를 고른다) */
  const byPart = {}
  for (const c of cars)
    for (const p of c.parts.filter((x) => x.category === "oil")) {
      const diesel = /디젤/.test(`${p.engine ?? ""} ${p.name}`) || /ACEA\s*C/.test(p.spec)
      const visc = viscosityOf(p.spec)
      const key = tierKey(visc, diesel)
      keys.set(key, { visc, diesel })
      byPart[p.id] = { key, visc, diesel, need: Number(p.spec.match(/(\d+(?:\.\d)?)\s*L\b/)?.[1] ?? 0) || null }
    }
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const file = JSON.parse(readFileSync(OUT, "utf8"))
  const out = { checkedAt: today, byPart, tiers: {} }
  const save = () => writeFileSync(OUT, JSON.stringify({ ...file, oilTiers: out }, null, 2) + "\n")

  for (const [key, ctx] of keys) {
    const v = ctx.visc ?? ""
    const d = ctx.diesel ? "디젤 C5 " : ""
    const queries = [
      `현대모비스 순정 엔진오일 ${d}${v}`,
      `킥스 ${d}${v} 4L`,
      `지크 ${d}${v} 4L`,
      `엑스티어 ${d}${v} 4L`,
      `모빌1 ${d}${v}`,
      `쉘 힐릭스 울트라 ${d}${v}`,
      `캐스트롤 엣지 ${d}${v}`,
    ]
    const seen = new Map()
    for (const q of queries) {
      try {
        for (const x of await search(q, ak, sk)) if (!seen.has(x.productId)) seen.set(x.productId, x)
      } catch (e) {
        console.log(`  (검색 실패: ${q}) ${e.message}`)
      }
      await sleep(2500)
    }
    const ok = [...seen.values()]
      .filter((x) => !BAD.test(x.productName) && BRANDS.test(x.productName) && specOk(x.productName, ctx))
      .map((x) => ({ ...x, liters: totalLiters(x.productName), grade: gradeShown(x.productName, ctx.diesel) }))
      .filter((x) => x.liters && x.liters >= 1 && x.liters <= 8)
    const perL = (x) => x.productPrice / x.liters
    // 상품명에 등급(SP 등)이 적힌 것을 먼저, 그다음 1L당 싼 순
    const pickOf = (list) => list.sort((a, b) => Number(b.grade) - Number(a.grade) || perL(a) - perL(b))[0]
    const oem = pickOf(ok.filter((x) => OEM.test(x.productName)))
    const premium = pickOf(ok.filter((x) => PREMIUM.test(x.productName) && !OEM.test(x.productName)))
    const value = pickOf(ok.filter((x) => !OEM.test(x.productName) && x !== premium && x.liters >= 4))
    const pack = (x) =>
      x && { name: x.productName, price: x.productPrice, liters: x.liters, gradeShown: x.grade, url: x.productUrl, image: x.productImage, rocket: !!x.isRocket }
    out.tiers[key] = { oem: pack(oem), value: pack(value), premium: pack(premium) }
    console.log(`${key}: 순정 ${oem ? "✔" : "✗"} ${oem?.productName.slice(0, 40) ?? ""} | 가성비 ${value ? "✔" : "✗"} ${value?.productName.slice(0, 40) ?? ""} | 프리미엄 ${premium ? "✔" : "✗"} ${premium?.productName.slice(0, 40) ?? ""}`)
    save()
  }
}

export function tierKey(visc, diesel) {
  return `${visc ?? "?"}|${diesel ? "diesel" : "gas"}`
}

if (process.argv[1]?.endsWith("pick-coupang-oil-tiers.mjs")) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}

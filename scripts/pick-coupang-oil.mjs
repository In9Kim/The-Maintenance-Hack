/**
 * 엔진오일마다 쿠팡에서 "이거 사면 된다" 상품 하나를 골라 data/coupang-picks.json에 저장한다.
 *
 * 고르는 순서 (쿠팡 파트너스 검색 API, 링크는 파트너스 링크로 나온다)
 *  1) 차종 전용 "엔진오일 세트" (오일 + 그 차 오일필터): "{차종} {세대} {배기량} {연료} 엔진오일세트"
 *     → 상품명에 차종(또는 세대 코드)·점도가 있고, 다른 연료·다른 배기량이 적혀 있지 않아야 통과
 *  2) 없으면 같은 점도·등급의 오일 4L 이상 단품: "엔진오일 {점도} {등급} 4L"
 *     → 상품명에 점도·등급이 있고, 다른 차 이름이 없어야 통과
 *  둘 다 없으면 고르지 않는다 (화면은 기존 검색 링크만 보여 준다).
 *
 * 실행: node scripts/pick-coupang-oil.mjs [--all]   (.env.local 의 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY, 값은 출력하지 않음)
 * 이미 고른 소모품은 --all 이 아니면 건너뛴다. 가격은 조회한 날 기준이라 화면에 날짜를 함께 적는다.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { createHmac } from "node:crypto"

const OUT = "data/coupang-picks.json"
const PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/search"

function env(name) {
  if (process.env[name]) return process.env[name]
  if (!existsSync(".env.local")) return ""
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, "")
  }
  return ""
}

const norm = (s) => s.toUpperCase().replace(/\s+/g, "").replace(/-/g, "")
export const viscosityOf = (s) => s.match(/\b(\d{1,2}W-?\d{2})\b/i)?.[1].toUpperCase().replace(/W-?/, "W-") ?? null
export const gradeOf = (s) => (/\bSP\b|GF-6/i.test(s) ? "SP" : /\bC5\b/.test(s) ? "C5" : /\bC3\b/.test(s) ? "C3" : /\bC2\b/.test(s) ? "C2" : null)
export const fuelOf = (s) => (/디젤/.test(s) ? "디젤" : /하이브리드|HEV/i.test(s) ? "하이브리드" : /LPG|LPi/i.test(s) ? "LPG" : /가솔린/.test(s) ? "가솔린" : null)
export const displacementOf = (s) => s.match(/(?<![\d.])(\d\.\d)(?!\d)(?!\s*(?:L\b|리터))/i)?.[1] ?? null
/** 단품 오일은 잘 알려진 브랜드만 */
const OIL_BRANDS = /킥스|KIXX|지크|ZIC|엑스티어|XTEER|에스오일|S-OIL|세븐|모빌|MOBIL|쉘|SHELL|캐스트롤|CASTROL|토탈|TOTAL|모튤|MOTUL|발보린|VALVOLINE|리퀴몰리|LIQUI/i
/** 우리 데이터에 없는 옛 세대 코드 (상품명에 있으면 다른 세대) */
const LEGACY_CODES = ["HD", "MD", "LF", "YF", "NF", "TL", "QL", "SL", "UM", "XM", "YP", "TF", "JF", "HG", "DM", "DH", "OS", "SK3", "TA", "EV"]
const isTurbo = (s) => /T-?GDi|터보|\d\.\dT\b|TGDI/i.test(s)
const OTHER_MAKERS = /쌍용|KGM|토요타|도요타|TOYOTA|렉서스|혼다|닛산|르노|쉐보레|GM대우|BMW|벤츠|아우디|폭스바겐|볼보|포드/i

/** 차종 전용 세트 상품이 이 차·엔진에 맞는지 */
export function setMatches(title, { model, code, visc, grade, grades = [], fuel, disp, turbo, multi, codes = [] }) {
  const t = norm(title)
  if (!t.includes(norm(model)) && !(code && t.includes(norm(code)))) return false
  if (code && !t.includes(norm(code))) return false // 세대 코드가 꼭 있어야 (아반떼 AD ↔ CN7 구분)
  if (!code && codes.some((c) => t.includes(norm(c)))) return false
  if (LEGACY_CODES.some((c) => c !== code && new RegExp(`(^|[^A-Z])${c}([^A-Z0-9]|$)`).test(title.toUpperCase()))) return false
  if (visc) {
    if (!t.includes(norm(visc))) return false
  } else if (!(grades.length ? grades : grade ? [grade] : []).some((g) => t.includes(g))) return false // 점도가 없으면(디젤) 등급(C2·C3·C5)이라도 맞아야
  const tf = fuelOf(title)
  if (fuel ? tf && tf !== fuel : tf && tf !== "가솔린") return false
  const td = displacementOf(title)
  if (disp && td && td !== disp) return false
  if (!disp && td && multi) return false
  if (isTurbo(title) && turbo === false && /터보|T-?GDi/i.test(title)) return false
  if (turbo && /MPI/i.test(title)) return false
  if (/공임/.test(title)) return false
  return /세트|필터/.test(title)
}

/** 단품 오일이 점도·등급에 맞고 다른 차 전용이 아닌지 */
export function oilMatches(title, { visc, grade, carNames }) {
  const t = norm(title)
  if (!visc || !t.includes(norm(visc))) return false
  if (grade && !new RegExp(`\\b${grade}\\b`, "i").test(title.replace(/GF-6A?/i, "SP"))) return false
  if (!/\b[4-7]\s*L\b|[4-7]리터/i.test(title)) return false
  if (/급유기|주유기|펌프|교환기|코팅제|첨가제/.test(title) || OTHER_MAKERS.test(title) || !OIL_BRANDS.test(title)) return false
  return !carNames.some((n) => n.length >= 2 && t.includes(norm(n)))
}

async function search(keyword, ak, sk) {
  const query = `keyword=${encodeURIComponent(keyword)}&limit=10`
  const d = new Date()
  const p = (x) => String(x).padStart(2, "0")
  const dt = `${String(d.getUTCFullYear()).slice(-2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  const sig = createHmac("sha256", sk).update(dt + "GET" + PATH + query).digest("hex")
  const r = await fetch(`https://api-gateway.coupang.com${PATH}?${query}`, {
    headers: { Authorization: `CEA algorithm=HmacSHA256, access-key=${ak}, signed-date=${dt}, signature=${sig}` },
  })
  const j = await r.json().catch(() => ({}))
  if (r.status !== 200 || String(j.rCode) !== "0") throw new Error(`쿠팡 검색 실패 ${r.status} ${j.rCode ?? ""} ${j.rMessage ?? ""}`.slice(0, 160))
  return j.data?.productData ?? []
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const ak = env("COUPANG_ACCESS_KEY")
  const sk = env("COUPANG_SECRET_KEY")
  if (!ak || !sk) throw new Error(".env.local 에 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 가 없습니다")
  const all = process.argv.includes("--all")
  const raw = JSON.parse(readFileSync("data/vehicles.json", "utf8"))
  const cars = raw.cars ?? raw
  const carNames = [...new Set(cars.flatMap((c) => [c.model, c.generation.split(/\s/)[0]]))]
  const codes = [...new Set(cars.map((c) => c.generation.split(/\s/)[0]).filter((c) => /^[A-Z][A-Z0-9]{1,4}$/.test(c)))]
  const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { picks: {} }
  out._설명 = "엔진오일별 쿠팡 추천 상품 (scripts/pick-coupang-oil.mjs가 만듦, 손으로 고치지 않음). price는 checkedAt 날짜 기준"
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  let picked = 0, none = 0

  for (const car of cars) {
    for (const part of car.parts.filter((p) => p.category === "oil")) {
      if (!all && out.picks[part.id]) continue
      const engine = part.engine ?? (car.engineTypes.length === 1 ? car.engineTypes[0] : "")
      const code = car.generation.split(/\s/)[0]
      const ctx = {
        model: car.model,
        code: /^[A-Z][A-Z0-9]{1,4}$/.test(code) ? code : "",
        visc: viscosityOf(part.spec) ?? viscosityOf(part.coupangKeyword ?? ""),
        grade: gradeOf(part.spec),
        grades: [...new Set(part.spec.match(/C[235]/g) ?? [])],
        fuel: fuelOf(`${engine} ${part.name}`),
        disp: displacementOf(engine) ?? displacementOf(part.spec),
        turbo: engine ? isTurbo(engine) : null,
        multi: car.parts.filter((p) => p.category === "oil").length > 1,
        carNames,
        codes,
      }
      let pick = null
      const q1 = [car.model, ctx.code, ctx.disp, ctx.fuel, "엔진오일세트"].filter(Boolean).join(" ")
      const r1 = await search(q1, ak, sk)
      await sleep(2500)
      const hit1 = r1.find((x) => setMatches(x.productName, ctx))
      if (hit1) pick = { kind: "set", query: q1, item: hit1 }
      else if (ctx.visc) {
        const q2 = ["엔진오일", ctx.visc, ctx.grade ?? "", "4L"].filter(Boolean).join(" ")
        const r2 = await search(q2, ak, sk)
        await sleep(2500)
        const hit2 = r2.find((x) => oilMatches(x.productName, ctx))
        if (hit2) pick = { kind: "oil", query: q2, item: hit2 }
      }
      if (pick) {
        out.picks[part.id] = {
          kind: pick.kind,
          name: pick.item.productName,
          price: pick.item.productPrice,
          url: pick.item.productUrl,
          image: pick.item.productImage,
          rocket: !!pick.item.isRocket,
          query: pick.query,
          checkedAt: today,
        }
        picked++
        console.log(`✔ ${part.id} [${pick.kind}] ${pick.item.productName.slice(0, 60)}`)
      } else {
        delete out.picks[part.id]
        none++
        console.log(`✗ ${part.id} 맞는 상품 없음 (${q1})`)
      }
      writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n")
    }
  }
  console.log(`골라짐 ${picked}, 못 고름 ${none}`)
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("pick-coupang-oil.mjs")) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}

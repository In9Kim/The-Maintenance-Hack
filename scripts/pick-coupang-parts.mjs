/**
 * 와이퍼·에어컨필터·에어클리너마다 쿠팡에서 "이거 사면 된다" 상품 하나를 골라 data/coupang-picks.json에 저장한다.
 * (엔진오일은 scripts/pick-coupang-oil.mjs가 같은 파일에 저장한다)
 *
 * 맞는 상품 판정 (애매하면 고르지 않는다 → 화면은 예상가와 검색 링크만 보여 준다)
 *  - 와이퍼: 상품명에 운전석·조수석 길이(예: 650·400)가 둘 다 있고, 리필 고무만 파는 상품이 아니며,
 *            다른 차 이름이 없어야 (내 차 이름은 있어도 됨). 테슬라처럼 전용 와이퍼는 차 이름이 꼭 있어야
 *  - 필터:  상품명에 내 차 이름(또는 세대 코드)이 있고, 세대 코드나 연식으로 같은 세대인지 확인,
 *            다른 연료 전용(하이브리드·디젤 등)이 아니고, 에어컨필터↔에어클리너가 섞인 세트가 아니어야.
 *            소모품 데이터에 순정 품번이 있으면 그 품번이 상품명에 있어야
 *
 * 실행: node scripts/pick-coupang-parts.mjs [--all]   (.env.local 의 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY, 값은 출력하지 않음)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { env, search, yearsOf, carYears, fuelOf, displacementOf } from "./pick-coupang-oil.mjs"

const OUT = "data/coupang-picks.json"
const norm = (s) => String(s).toUpperCase().replace(/[\s\-_/()[\]]/g, "")

/** 쇼핑몰에서 같이 쓰는 차 이름 */
const ALIAS = { 쏘나타: ["소나타"], 그랜저: ["그랜져"], 싼타페: ["산타페"], 팰리세이드: ["펠리세이드"], 쏘렌토: ["소렌토"], 아반떼: ["아반테"], "Model 3": ["모델3", "모델 3"], "Model Y": ["모델Y", "모델 Y"], 아이오닉5: ["아이오닉 5"], 봉고3: ["봉고"] }
/** 우리 데이터에 없는 다른 차 이름 (와이퍼처럼 차 이름 없이도 맞는 상품에서 걸러내기용) */
const OTHER_MODELS = ["카렌스", "말리부", "스파크", "트랙스", "QM6", "SM6", "XM3", "티볼리", "코란도", "렉스턴", "올란도", "크루즈", "아베오", "i30", "i40", "벨로스터", "베뉴", "엑센트", "프라이드", "포르테", "쏘울", "모하비", "제네시스", "에쿠스", "아슬란", "오피러스", "로체", "스토닉", "EV6", "EV9", "아이오닉6", "트레일블레이저", "이쿼녹스", "포터", "마이티", "G70", "G90", "GV60", "EQ900", "투리스모"]
const MAKERS = /토요타|도요타|TOYOTA|렉서스|혼다|닛산|BMW|벤츠|아우디|폭스바겐|볼보|포드|미니|포르쉐|지프|푸조|캐딜락|쉐보레|르노/i
/** 우리 데이터에 없는 옛 세대 코드 */
const LEGACY_CODES = ["HD", "MD", "LF", "YF", "NF", "TL", "QL", "SL", "UM", "XM", "YP", "TF", "JF", "HG", "DM", "DH", "OS", "SK3", "TA", "IG", "AD", "CN7", "DN8", "DL3", "MQ4", "KA4", "NX4", "GN7", "MX5", "TM", "NQ5", "SP2", "GL3", "SX2", "LX2", "AX1", "BD", "JA", "US4", "SG2", "RG3", "JX1", "JK1"]

const hasWord = (title, w) => new RegExp(`(^|[^A-Z0-9])${w}([^A-Z0-9]|$)`).test(title.toUpperCase())
const overlap = (a, b) => !!a && !!b && a[0] <= b[1] && b[0] <= a[1]

/** 와이퍼 규격 "운전석 650mm · 조수석 400mm" → [650, 400] */
export function wiperLengths(spec) {
  const m = String(spec).match(/운전석\s*(\d{3})\s*mm.*?조수석\s*(\d{3})\s*mm/)
  return m ? [+m[1], +m[2]] : null
}

/** 순정 품번 (예: 97133-L1100, 28113-BY100) */
export function partNumbersOf(s) {
  return [...new Set(String(s).toUpperCase().match(/\b\d{5}-?[A-Z0-9]{5}\b/g) ?? [])].map((p) => p.replace("-", ""))
}

function modelIn(title, model, alias = []) {
  const t = norm(title)
  return [model, ...alias].some((m) => t.includes(norm(m)))
}

/** 상품명에 적힌 차 이름들 (우리 데이터 + 그 밖의 흔한 차) 중 내 차가 아닌 것 */
function otherCarsIn(title, { model, alias = [], others = [] }) {
  const raw = String(title).toUpperCase()
  const mine = [model, ...alias].map(norm)
  // 뒤에 한글이 바로 붙으면 다른 낱말 (레이 ↔ 레이븐). 띄어쓰기가 있는 원래 상품명에서 본다
  const esc = (x) => x.split("").map((ch) => (/[A-Z0-9가-힣]/.test(ch) ? ch : /\s/.test(ch) ? "\s*" : "\\" + ch)).join("")
  const found = (m) => new RegExp(esc(String(m).toUpperCase()) + (norm(m).length <= 2 ? "(?![가-힣])" : "")).test(raw)
  return [...new Set([...others, ...OTHER_MODELS])].filter((m) => norm(m).length >= 2 && found(m) && !mine.some((x) => x.includes(norm(m)) || norm(m).includes(x)))
}
/** 내 차 이름은 있는데 다른 세대 코드만 적혀 있으면(아반떼HD ↔ CN7) 다른 세대 */
function otherGeneration(title, code) {
  if (!code) return false
  return !hasWord(title, code) && LEGACY_CODES.some((c) => c !== code && new RegExp(`(^|[^A-Z0-9])${c}([^A-Z0-9]|$)`).test(title.toUpperCase().replace(/[가-힣]/g, " ")))
}
/** 여러 차·여러 품번 중 골라 사는 상품 (어떤 게 오는지·가격이 옵션마다 다름) */
function optionListing(title, ctx) {
  return otherCarsIn(title, ctx).length >= 2 || partNumbersOf(title).length >= 3
}
/** 묶음 수량 "10개" (없으면 1) */
const qtyOf = (title) => Math.max(1, ...[...String(title).matchAll(/(\d+)\s*개(?:입)?/g)].map((m) => +m[1]).filter((n) => n < 50))

export function wiperMatches(title, ctx) {
  const { model, alias = [], lengths, dedicated, code } = ctx
  if (!lengths) return false
  const t = String(title)
  if (/리필|고무만|교체용\s*고무|레인\s*코트|발수제|유리막|와셔액|암\b|와이퍼암/.test(t)) return false
  if (!/와이퍼/.test(t)) return false
  const nums = (t.match(/(?<!\d)(\d{3})(?=\s*(?:mm|MM|\+|-|\/|,|\s|$|㎜))/g) ?? []).map(Number)
  if (!lengths.every((l) => nums.includes(l))) return false
  // 길이가 셋 이상 적힌 상품(여러 사이즈 중 고르기)은 어떤 게 오는지 몰라서 제외
  if (new Set(nums.filter((n) => n >= 300 && n <= 750)).size > 2) return false
  const mine = modelIn(t, model, alias)
  if (dedicated && !mine) return false
  if (MAKERS.test(t) || optionListing(t, ctx)) return false
  if (!mine && otherCarsIn(t, ctx).length) return false
  if (mine && otherGeneration(t, code)) return false
  return /세트|2개|2P|운전석\s*\+\s*조수석|1세트|\+/.test(t.toUpperCase())
}

export function filterMatches(title, ctx) {
  const { kind, model, alias = [], code, years, fuel, multiFuel, pns = [], disps } = ctx
  const t = String(title)
  if (/공임|장착|교환권/.test(t)) return false
  if (qtyOf(t) >= 5) return false
  if (/리어|후면|뒷좌석/.test(t) && !/전면|앞/.test(t)) return false
  if (optionListing(t, ctx)) return false
  // 에어클리너는 엔진마다 다름: 상품명 배기량이 우리 엔진과 다르거나, 엔진이 여럿인데 특정 배기량 전용이면 제외
  const td = displacementOf(t)
  if (kind === "air" && td && !(disps?.length === 1 && disps[0] === td)) return false
  const cabin = /에어컨|캐빈|히터|항균|활성탄/.test(t)
  const air = /에어\s*크리너|에어\s*클리너|에어\s*휠[타터]|엔진\s*에어\s*필터|에어필터/.test(t.replace(/에어컨\s*필터/g, ""))
  if (kind === "cabin" ? !cabin || air : !air || cabin) return false
  if (/오일\s*필터|엔진오일|오일\+|\+\s*오일/.test(t)) return false // 오일필터와 묶인 세트
  if (pns.length) return pns.some((p) => norm(t).includes(p)) && (modelIn(t, model, alias) || !otherCarsIn(t, ctx).length)
  const hasModel = modelIn(t, model, alias)
  const hasCode = !!code && hasWord(t, code)
  if (!hasModel) return false
  if (code && !hasCode && !overlap(yearsOf(t), years)) return false
  if (otherGeneration(t, code)) return false
  const tf = fuelOf(t)
  if (tf && fuel && tf !== fuel) return false
  if (tf && !fuel && multiFuel) return false
  return true
}

async function main() {
  const ak = env("COUPANG_ACCESS_KEY")
  const sk = env("COUPANG_SECRET_KEY")
  if (!ak || !sk) throw new Error(".env.local 에 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 가 없습니다")
  const all = process.argv.includes("--all")
  const only = process.argv.find((a) => a.startsWith("--car="))?.slice(6)
  const raw = JSON.parse(readFileSync("data/vehicles.json", "utf8"))
  const cars = raw.cars ?? raw
  const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { picks: {} }
  out._설명 = "소모품별 쿠팡 추천 상품 (scripts/pick-coupang-oil.mjs · pick-coupang-parts.mjs가 고르고 refresh-coupang-prices.mjs가 매일 가격 갱신, 손으로 고치지 않음). price는 checkedAt 날짜 기준"
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  let picked = 0, none = 0

  const names = (c) => [c.model, ...(ALIAS[c.model] ?? [])]
  for (const car of cars) {
    if (only && car.id !== only) continue
    const others = cars.filter((c) => c.model !== car.model).flatMap(names)
    const code0 = car.generation.split(/\s/)[0]
    const code = /^[A-Z][A-Z0-9]{1,4}$/.test(code0) ? code0 : ""
    const alias = ALIAS[car.model] ?? []
    const fuels = new Set(car.engineTypes.map((e) => fuelOf(e) ?? "가솔린"))
    for (const part of car.parts) {
      const kind = part.category === "wiper" ? "wiper" : part.category === "filter" ? (/에어컨|캐빈/.test(part.name) ? "cabin" : "air") : null
      if (!kind) continue
      const engines = part.engine ? [part.engine] : car.engineTypes
      const ctx = {
        others,
        disps: engines.length === 1 && displacementOf(engines[0]) ? [displacementOf(engines[0])] : [],
        kind,
        model: car.model,
        alias,
        code,
        years: carYears(car.yearRange),
        fuel: part.engine ? fuelOf(part.engine) ?? "가솔린" : fuels.size === 1 ? [...fuels][0] : null,
        multiFuel: fuels.size > 1,
        pns: partNumbersOf(`${part.spec} ${part.coupangKeyword ?? ""}`),
        lengths: wiperLengths(part.spec),
        dedicated: /Model|아이오닉/.test(car.model),
      }
      const ok = (title) => (kind === "wiper" ? wiperMatches(title, ctx) : filterMatches(title, ctx))
      if (kind === "wiper" && !ctx.lengths) continue // 길이를 모르면 고를 수 없음
      const prev = out.picks[part.id]
      const prevOk = prev && prev.kind === kind && ok(prev.name)
      if (prevOk && !all) continue

      const seen = new Map()
      const run = async (q) => {
        try {
          for (const x of await search(q, ak, sk)) if (!seen.has(x.productId)) seen.set(x.productId, { ...x, _q: q })
        } catch (e) {
          console.log(`  (검색 실패: ${q}) ${e.message}`)
        }
        await sleep(2500)
      }
      const name = [car.model, code].filter(Boolean).join(" ")
      if (kind === "wiper") {
        await run(`${name} 와이퍼`)
        if (![...seen.values()].some((x) => ok(x.productName))) await run(`와이퍼 ${ctx.lengths[0]}mm ${ctx.lengths[1]}mm 세트`)
      } else {
        if (ctx.pns.length) await run(ctx.pns.map((p) => p.replace(/^(\d{5})/, "$1-")).join(" "))
        else await run(`${name} ${kind === "cabin" ? "에어컨필터" : "에어클리너 필터"}`)
      }
      const cands = [...seen.values()].filter((x) => ok(x.productName))
      // 내 차 이름·세대 코드가 적힌 상품 → 로켓배송 → 검색 순위
      const score = (x) => (modelIn(x.productName, ctx.model, alias) ? 2 : 0) + (code && hasWord(x.productName, code) ? 2 : 0) + (x.isRocket ? 1 : 0) - (qtyOf(x.productName) > 2 ? 2 : 0)
      cands.sort((x, y) => score(y) - score(x) || x.rank - y.rank)
      const it = cands[0]
      if (it) {
        out.picks[part.id] = {
          kind,
          name: it.productName,
          price: it.productPrice,
          url: it.productUrl,
          image: it.productImage,
          rocket: !!it.isRocket,
          productId: it.productId,
          query: it._q,
          checkedAt: today,
        }
        picked++
        console.log(`✔ ${part.id} [${kind}] ${it.productPrice}원 ${it.productName.slice(0, 70)}`)
      } else if (prevOk) {
        picked++
      } else {
        delete out.picks[part.id]
        none++
        console.log(`✗ ${part.id} 맞는 상품 없음`)
      }
      writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n")
    }
  }
  console.log(`골라짐 ${picked}, 못 고름 ${none}`)
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("pick-coupang-parts.mjs")) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}

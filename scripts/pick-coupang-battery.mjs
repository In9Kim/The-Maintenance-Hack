/**
 * 배터리 규격(data/battery-fitment.json)마다 쿠팡 상품 하나를 골라 data/coupang-picks.json에 "battery:규격" 키로 저장한다.
 * 같은 차종도 트림마다 규격이 달라서, 차가 아니라 규격 단위로 고른다 (화면: "라벨이 AGM70L이면 → 이 상품").
 *
 * 맞는 상품 판정 (애매하면 고르지 않는다)
 *  - 상품명에 그 규격 코드가 정확히 있어야 (예: AGM70L = "AGM70"·"AGM 70"·"57020"·"LN3")
 *  - AGM ↔ 일반(MF·DIN)이 섞이면 안 됨, 다른 용량 코드가 같이 적힌 옵션 상품도 제외
 *  - 출장·방문 교체 서비스, 충전기·점프스타터, 중고·재생 배터리 제외
 *
 * 실행: node scripts/pick-coupang-battery.mjs   (.env.local 의 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY, 값은 출력하지 않음)
 */
import { readFileSync, writeFileSync } from "node:fs"
import { env, search } from "./pick-coupang-oil.mjs"

const OUT = "data/coupang-picks.json"
const N = (s) => String(s).toUpperCase().replace(/\s+/g, " ")

/** 규격 → 상품명 판정 정규식 (공백·하이픈 무시) */
export const BATTERY_CODES = {
  "AGM 56020": { q: "AGM60L 배터리", agm: true, re: /AGM ?-?60(?!\d)|56020|LN2/, ah: 60 },
  "AGM 57020": { q: "AGM70L 배터리", agm: true, re: /AGM ?-?70(?!\d)|57020|LN3/, ah: 70 },
  "AGM 58020": { q: "AGM80L 배터리", agm: true, re: /AGM ?-?80(?!\d)|58020|LN4/, ah: 80 },
  "AGM 59521": { q: "AGM95L 배터리", agm: true, re: /AGM ?-?95(?!\d)|59521|LN5/, ah: 95 },
  "MF 56219": { q: "56219 배터리 DIN62L", agm: false, re: /56219|DIN ?-?62(?!\d)|CMF ?62(?!\d)/, ah: 62 },
  "MF 57413": { q: "57413 배터리 DIN74L", agm: false, re: /57413|DIN ?-?74(?!\d)/, ah: 74 },
  "MF 59043": { q: "59043 배터리 DIN90L", agm: false, re: /59043|DIN ?-?90(?!\d)/, ah: 90 },
  "MF 60038": { q: "60038 배터리 DIN100L", agm: false, re: /60038|DIN ?-?100(?!\d)/, ah: 100 },
  "MF 54459": { q: "54459 배터리 DIN44L", agm: false, re: /54459|DIN ?-?44(?!\d)/, ah: 44 },
  "MF 60L": { q: "CMF60L 배터리", agm: false, re: /(?<![\dA-Z])C?MF ?60L(?![\dA-Z])|(?<![\dA-Z])60L(?![\dA-Z])/, ah: 60 },
  "MF 40FL": { q: "40FL 배터리", agm: false, re: /40FL(?![\dA-Z])/, ah: 40 },
  "MF 100L": { q: "CMF100L 배터리", agm: false, re: /(?<![\dA-Z])C?MF ?100L(?![\dA-Z])|(?<![\dA-Z])100L(?![\dA-Z])/, ah: 100 },
  "MF 100R": { q: "CMF100R 배터리", agm: false, re: /(?<![\dA-Z])C?MF ?100R(?![\dA-Z])|(?<![\dA-Z])100R(?![\dA-Z])/, ah: 100 },
  "MF 90L": { q: "CMF90L 배터리", agm: false, re: /(?<![\dA-Z])C?MF ?90L(?![\dA-Z])|(?<![\dA-Z])90L(?![\dA-Z])/, ah: 90 },
  "MF 80L": { q: "CMF80L 배터리", agm: false, re: /(?<![\dA-Z])C?MF ?80L(?![\dA-Z])|(?<![\dA-Z])80L(?![\dA-Z])/, ah: 80 },
}

/** 다른 용량이 같이 적혀 있으면(옵션 상품) 어떤 게 오는지 몰라서 제외 */
const SIZES = /(?:AGM|DIN|CMF|MF) ?-?(\d{2,3})(?!\d)|(?<![\dA-Z])(\d{2,3})[LR](?![\dA-Z])/g

export function batteryMatches(title, code) {
  const spec = BATTERY_CODES[code]
  if (!spec) return false
  const t = N(title)
  if (!/배터리|밧데리|BATTERY/.test(t)) return false
  if (/출장|방문|장착 ?서비스|교체 ?서비스|충전기|점프|스타터|중고|재생|리퍼|보조 ?배터리|오토바이|바이크|캠핑|파워뱅크/.test(t)) return false
  if (!spec.re.test(t)) return false
  if (spec.agm !== /AGM/.test(t)) return false
  // 일반 MF 규격(60L·80L·90L·100L·100R)은 DIN 규격과 크기가 달라서 DIN 상품은 제외
  if (!spec.agm && /^MF \d+[A-Z]+$/.test(code) && /DIN/.test(t)) return false
  // 단자 방향(L·R)을 둘 다 파는 옵션 상품은 어떤 게 오는지 몰라서 제외
  const lr = code.match(/(\d+)([LR])$/)
  if (lr && new RegExp(`(?<![\\dA-Z])(?:C?MF ?)?${lr[1]}${lr[2] === "L" ? "R" : "L"}(?![\\dA-Z])`).test(t)) return false
  const sizes = new Set([...t.matchAll(SIZES)].map((m) => +(m[1] ?? m[2])).filter((n) => n >= 35 && n <= 120))
  if ([...sizes].some((n) => n !== spec.ah)) return false
  return true
}

async function main() {
  const ak = env("COUPANG_ACCESS_KEY")
  const sk = env("COUPANG_SECRET_KEY")
  if (!ak || !sk) throw new Error(".env.local 에 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 가 없습니다")
  const fit = JSON.parse(readFileSync("data/battery-fitment.json", "utf8"))
  const codes = [...new Set(Object.values(fit.cars).flatMap((c) => c.options.map((o) => o.code)))]
  const out = JSON.parse(readFileSync(OUT, "utf8"))
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  for (const code of codes) {
    const spec = BATTERY_CODES[code]
    if (!spec) {
      console.log(`? ${code} 판정 규칙 없음`)
      continue
    }
    let items = []
    try {
      items = await search(spec.q, ak, sk)
    } catch (e) {
      console.log(`  (검색 실패: ${spec.q}) ${e.message}`)
    }
    await sleep(2500)
    const cands = items.filter((x) => batteryMatches(x.productName, code))
    // 로켓배송 → 검색 순위
    cands.sort((a, b) => (b.isRocket ? 1 : 0) - (a.isRocket ? 1 : 0) || a.rank - b.rank)
    const it = cands[0]
    const key = `battery:${code}`
    if (it) {
      out.picks[key] = { kind: "battery", name: it.productName, price: it.productPrice, url: it.productUrl, image: it.productImage, rocket: !!it.isRocket, productId: it.productId, query: spec.q, checkedAt: today }
      console.log(`✔ ${code} ${it.productPrice}원 ${it.productName.slice(0, 70)}`)
    } else {
      delete out.picks[key]
      console.log(`✗ ${code} 맞는 상품 없음 (검색 ${items.length}개)`)
    }
    writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n")
  }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("pick-coupang-battery.mjs")) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}

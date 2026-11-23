/**
 * 소모품마다 쿠팡 파트너스 "검색 링크"를 만들어 data/coupang-search-links.json에 저장한다.
 *
 * - 검색어는 차종 데이터의 coupangKeyword를 그대로 쓴다.
 * - kind: "spec"  = 규격(점도·등급)만 맞으면 되는 소모품 (엔진오일). 검색 결과가 모두 그 규격.
 *         "car"   = 차종 전용 부품 (필터·패드·와이퍼·배터리 등). 화면에 "구매 전 순정 품번 확인" 안내를 붙인다.
 * - 링크는 정적 파일로 저장하므로 사이트가 클릭마다 쿠팡 API를 부르지 않는다.
 *
 * 실행: node scripts/build-coupang-search-links.mjs   (.env.local의 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 사용, 값은 출력하지 않음)
 * 이미 있는 링크는 검색어가 같으면 그대로 두고, 새 소모품·바뀐 검색어만 새로 만든다. --all 이면 전부 다시 만든다.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { createHmac } from "node:crypto"

const OUT = "data/coupang-search-links.json"
const PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink"
const BATCH = 10

function env(name) {
  if (process.env[name]) return process.env[name]
  if (!existsSync(".env.local")) return ""
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, "")
  }
  return ""
}

export function kindOf(part) {
  return part.category === "oil" && /\d+W-?\d+|ACEA|API\s*S[NP]/i.test(`${part.coupangKeyword} ${part.spec}`) ? "spec" : "car"
}

export const searchUrl = (q) => `https://www.coupang.com/np/search?q=${encodeURIComponent(q)}`

function datetime() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0")
  return `${String(d.getUTCFullYear()).slice(-2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
}

async function deeplink(urls, ak, sk) {
  const dt = datetime()
  const sig = createHmac("sha256", sk).update(dt + "POST" + PATH).digest("hex")
  const res = await fetch(`https://api-gateway.coupang.com${PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Authorization: `CEA algorithm=HmacSHA256, access-key=${ak}, signed-date=${dt}, signature=${sig}`,
    },
    body: JSON.stringify({ coupangUrls: urls }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.rCode !== "0") throw new Error(`쿠팡 API 오류 ${res.status} ${json.rCode ?? ""} ${json.rMessage ?? ""}`)
  return json.data
}

async function main() {
  const ak = env("COUPANG_ACCESS_KEY"), sk = env("COUPANG_SECRET_KEY")
  if (!ak || !sk) throw new Error("COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY가 없습니다")
  const all = process.argv.includes("--all")
  const cars = JSON.parse(readFileSync("data/vehicles.json", "utf8")).cars
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")).links ?? {} : {}

  const links = {}
  const todo = []
  for (const car of cars) {
    for (const part of car.parts) {
      const query = (part.coupangKeyword || `${car.model} ${part.name}`).trim()
      const kind = kindOf(part)
      const old = prev[part.id]
      if (!all && old && old.query === query) links[part.id] = { ...old, kind }
      else todo.push({ id: part.id, query, kind })
    }
  }

  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH)
    const data = await deeplink(chunk.map((t) => searchUrl(t.query)), ak, sk)
    const byOrigin = new Map(data.map((d) => [d.originalUrl ?? d.originUrl, d.shortenUrl]))
    chunk.forEach((t, j) => {
      const url = byOrigin.get(searchUrl(t.query)) ?? data[j]?.shortenUrl
      if (!url) throw new Error(`링크를 받지 못함: ${t.id}`)
      links[t.id] = { kind: t.kind, query: t.query, url }
    })
    process.stdout.write(`\r만든 링크 ${Math.min(i + BATCH, todo.length)}/${todo.length}`)
    await new Promise((r) => setTimeout(r, 1200))
  }
  if (todo.length) process.stdout.write("\n")

  const sorted = Object.fromEntries(Object.keys(links).sort().map((k) => [k, links[k]]))
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        _설명: "소모품별 쿠팡 파트너스 검색 링크 (scripts/build-coupang-search-links.mjs가 만듦, 손으로 고치지 않음). kind spec=규격 검색, car=차종 검색(구매 전 품번 확인)",
        links: sorted,
      },
      null,
      2
    ) + "\n"
  )
  console.log(`저장: ${OUT} (전체 ${Object.keys(sorted).length}개, 새로 만듦 ${todo.length}개)`)
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("build-coupang-search-links.mjs")) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}

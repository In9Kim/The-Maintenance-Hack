/**
 * 견적서 분석 모델 비교 (가상 견적서 4장, 정답 truth.json).
 * 운영과 같은 지시문(lib/quote-analyze.ts buildQuotePrompt)·같은 JSON 형식으로 모델마다 돌려
 * 항목 찾기·금액·판정·개인정보 누출·시간·비용을 잰다.
 *
 * 실행: ANTHROPIC_API_KEY=… [GEMINI_API_KEY=…] node scripts/quote-eval/run.mjs [모델,모델…]
 *   기본 모델: claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5, gemini-3.8-flash (키 없는 쪽은 건너뜀)
 *   키 값은 출력하지 않는다.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { buildQuotePrompt, QUOTE_SCHEMA } from "../../lib/quote-analyze.ts"

const DIR = dirname(fileURLToPath(import.meta.url))
const truth = JSON.parse(readFileSync(join(DIR, "truth.json"), "utf8"))
const cars = JSON.parse(readFileSync(join(DIR, "../../data/vehicles.json"), "utf8")).cars
const car = cars.find((c) => c.id === truth.car)
const prompt = buildQuotePrompt(car, car.parts, 2021, "G1.6 가솔린")

/** USD / 100만 토큰 (platform.claude.com 가격표, 2026-11-27 확인) */
const PRICE = { "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5] }
const WON = 1450 // 환율 대략값 (확인 필요)

async function claude(model, b64, effort = "medium") {
  const body = {
    model,
    max_tokens: 16000,
    output_config: { ...(effort ? { effort } : {}), format: { type: "json_schema", schema: QUOTE_SCHEMA } },
    messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: b64 } }, { type: "text", text: prompt }] }],
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify(body),
  })
  const txt = await res.text()
  if (!res.ok) {
    if (effort && /effort/i.test(txt)) return claude(model, b64, null) // effort를 안 받는 모델
    throw new Error(`HTTP ${res.status} ${txt.slice(0, 200)}`)
  }
  const j = JSON.parse(txt)
  const out = j.content.filter((c) => c.type === "text").map((c) => c.text).join("")
  const [pi, po] = PRICE[model] ?? [0, 0]
  const usd = (j.usage.input_tokens * pi + j.usage.output_tokens * po) / 1e6
  return { result: JSON.parse(out), raw: out, usd, tokens: `${j.usage.input_tokens}/${j.usage.output_tokens}` }
}

/** Gemini 스키마는 type 배열(["integer","null"])을 못 받아 nullable로 바꾼다 */
function toGemini(s) {
  if (Array.isArray(s)) return s.map(toGemini)
  if (!s || typeof s !== "object") return s
  const o = {}
  for (const [k, v] of Object.entries(s)) {
    if (k === "additionalProperties") continue
    if (k === "type" && Array.isArray(v)) {
      o.type = v.find((t) => t !== "null")
      o.nullable = v.includes("null")
    } else o[k] = toGemini(v)
  }
  return o
}
async function gemini(model, b64) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: "image/png", data: b64 } }, { text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: toGemini(QUOTE_SCHEMA) },
    }),
  })
  const txt = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} ${txt.slice(0, 200)}`)
  const j = JSON.parse(txt)
  const out = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? ""
  return { result: JSON.parse(out), raw: out, usd: 0, tokens: `${j.usageMetadata?.promptTokenCount}/${j.usageMetadata?.candidatesTokenCount}` }
}

/** 한 장 채점 */
function grade(c, r, raw) {
  const s = { found: 0, total: c.items.length, price: 0, priceTotal: 0, verdict: 0, kind: 0, extra: 0, readable: r.readable === c.readable, pii: truth.pii.filter((p) => raw.includes(p)), miss: [], wrong: [] }
  const used = new Set()
  for (const t of c.items) {
    const re = new RegExp(t.kw)
    const i = r.items.findIndex((x, k) => !used.has(k) && re.test(x.name))
    if (i < 0) {
      s.miss.push(t.kw)
      continue
    }
    used.add(i)
    const x = r.items[i]
    s.found++
    if (t.verdict.includes(x.verdict)) s.verdict++
    else s.wrong.push(`${x.name}: ${x.verdict} (정답 ${t.verdict.join("/")})`)
    if (t.kind.includes(x.kind)) s.kind++
    for (const f of ["parts", "labor"]) {
      if (!(f in t)) continue
      s.priceTotal++
      const got = x[f === "parts" ? "parts_price" : "labor_price"]
      if ((got || null) === t[f]) s.price++
      else s.wrong.push(`${x.name} ${f === "parts" ? "부품" : "공임"}: ${got} (정답 ${t[f]})`)
    }
  }
  const opt = c.optional.map((o) => new RegExp(o))
  s.extra = r.items.filter((x, k) => !used.has(k) && !opt.some((o) => o.test(x.name))).map((x) => x.name)
  return s
}

const models = (process.argv[2] ?? "claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5,gemini-3.8-flash").split(",")
const report = []
for (const model of models) {
  const isG = model.startsWith("gemini")
  if (isG ? !process.env.GEMINI_API_KEY : !process.env.ANTHROPIC_API_KEY) {
    console.log(`(건너뜀: ${model} 키 없음)`)
    continue
  }
  const sum = { model, found: 0, total: 0, price: 0, priceTotal: 0, verdict: 0, kind: 0, extra: [], readable: 0, pii: [], usd: 0, sec: 0, errors: [], wrong: [], miss: [] }
  for (const c of truth.cases) {
    const b64 = readFileSync(join(DIR, "cases", c.file)).toString("base64")
    const t0 = Date.now()
    try {
      const r = await (isG ? gemini(model, b64) : claude(model, b64))
      const g = grade(c, r.result, r.raw)
      sum.sec += (Date.now() - t0) / 1000
      sum.usd += r.usd
      for (const k of ["found", "total", "price", "priceTotal", "verdict", "kind"]) sum[k] += g[k]
      sum.readable += g.readable ? 1 : 0
      sum.extra.push(...g.extra.map((e) => `${c.file}: ${e}`))
      sum.pii.push(...g.pii)
      sum.wrong.push(...g.wrong.map((e) => `${c.file}: ${e}`))
      sum.miss.push(...g.miss.map((e) => `${c.file}: ${e}`))
      console.log(`${model} ${c.file} ${((Date.now() - t0) / 1000).toFixed(0)}초 토큰 ${r.tokens} 찾음 ${g.found}/${g.total}`)
    } catch (e) {
      sum.errors.push(`${c.file}: ${e.message}`)
      console.log(`${model} ${c.file} 실패 ${e.message}`)
    }
  }
  report.push(sum)
}

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "-")
const lines = [
  "| 모델 | 항목 찾기 | 금액 정확 | 판정 일치 | 권고/작업 구분 | 견적서 아님 판별 | 없는 항목 지어냄 | 개인정보 누출 | 4장 시간 | 4장 비용 |",
  "|---|---|---|---|---|---|---|---|---|---|",
  ...report.map((s) => `| ${s.model} | ${s.found}/${s.total} | ${pct(s.price, s.priceTotal)} | ${pct(s.verdict, s.found)} | ${pct(s.kind, s.found)} | ${s.readable}/${truth.cases.length} | ${s.extra.length} | ${s.pii.length} | ${s.sec.toFixed(0)}초 | ${s.usd ? `$${s.usd.toFixed(4)} (약 ${Math.round(s.usd * WON)}원)` : "무료"} |`),
  "",
  ...report.flatMap((s) => [`### ${s.model}`, ...[...s.miss.map((m) => `- 못 찾음 ${m}`), ...s.wrong.map((w) => `- 틀림 ${w}`), ...s.extra.map((e) => `- 지어냄? ${e}`), ...s.pii.map((p) => `- 개인정보 ${p}`), ...s.errors.map((e) => `- 오류 ${e}`)], ""]),
]
console.log("\n" + lines.join("\n"))
writeFileSync(join(DIR, "result.md"), lines.join("\n") + "\n")
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n", { flag: "a" })

#!/usr/bin/env node
// 정비핵 주간 보고서: 지난주(월~일, 한국시간)와 그 전 주를 비교해 마크다운으로 출력
//
//  - Cloudflare Web Analytics: 방문·페이지뷰·유입 경로·인기 페이지   (CF_API_TOKEN: Account Analytics Read)
//  - 쿠팡 파트너스: 클릭·주문·수익·많이 눌린 상품                      (COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY)
//  - 구글 서치콘솔: 클릭·노출·검색어·페이지                            (GSC_SA_KEY: 서비스 계정 JSON 전체)
// 키가 없는 항목은 "연결 안 됨"으로 표시하고 나머지는 계속 만든다.
//
// 사용: node scripts/weekly-report.mjs > report.md
import { createHmac, createSign } from "node:crypto"

const HOST = "jungbihack.com"
const DAY = 86400000

// ── 날짜 (한국시간 기준 지난 월~일) ─────────────────────────────
const kstToday = new Date(Date.now() + 9 * 3600000) // UTC 필드에 한국 날짜가 들어간 Date
kstToday.setUTCHours(0, 0, 0, 0)
const dow = (kstToday.getUTCDay() + 6) % 7 // 월=0
const thisMon = new Date(kstToday - dow * DAY)
const W = { start: new Date(thisMon - 7 * DAY), end: new Date(thisMon - DAY) } // 지난주
const P = { start: new Date(thisMon - 14 * DAY), end: new Date(thisMon - 8 * DAY) } // 그 전 주
const iso = (d) => d.toISOString().slice(0, 10)
const ymd = (d) => iso(d).replaceAll("-", "")
const md = (d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`

const n = (x) => Math.round(x ?? 0).toLocaleString("ko-KR")
const diff = (a, b) => {
  if (!b) return a ? "신규" : "-"
  const p = Math.round(((a - b) / b) * 100)
  return `${p > 0 ? "▲" : p < 0 ? "▼" : ""}${Math.abs(p)}%`
}
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").slice(0, 60)

// ── Cloudflare ──────────────────────────────────────────────
async function cf() {
  const token = process.env.CF_API_TOKEN
  if (!token) return null
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  let acct = process.env.CF_ACCOUNT_ID
  if (!acct) {
    const a = await (await fetch("https://api.cloudflare.com/client/v4/accounts", { headers: h })).json()
    acct = a.result?.[0]?.id
    if (!acct) throw new Error("Cloudflare 계정을 찾지 못함 (토큰 권한 확인)")
  }
  // Web Analytics의 date는 UTC. 한국 날짜와 하루 이내로 어긋날 수 있음 (주간 추세 보기에는 충분)
  const range = (r) => `{requestHost:"${HOST}",date_geq:"${iso(r.start)}",date_leq:"${iso(r.end)}"}`
  const q = `{viewer{accounts(filter:{accountTag:"${acct}"}){
    cur:rumPageloadEventsAdaptiveGroups(limit:1,filter:${range(W)}){count sum{visits}}
    prev:rumPageloadEventsAdaptiveGroups(limit:1,filter:${range(P)}){count sum{visits}}
    ref:rumPageloadEventsAdaptiveGroups(limit:8,filter:${range(W)},orderBy:[sum_visits_DESC]){sum{visits} dimensions{refererHost}}
    path:rumPageloadEventsAdaptiveGroups(limit:8,filter:${range(W)},orderBy:[count_DESC]){count dimensions{requestPath}}
  }}}`
  const r = await (await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: h, body: JSON.stringify({ query: q }) })).json()
  if (r.errors?.length) throw new Error(`Cloudflare: ${r.errors[0].message}`)
  const a = r.data.viewer.accounts[0]
  return {
    views: a.cur[0]?.count ?? 0,
    visits: a.cur[0]?.sum.visits ?? 0,
    pViews: a.prev[0]?.count ?? 0,
    pVisits: a.prev[0]?.sum.visits ?? 0,
    refs: a.ref.map((x) => [x.dimensions.refererHost || "(직접 방문·북마크)", x.sum.visits]),
    paths: a.path.map((x) => [x.dimensions.requestPath, x.count]),
  }
}

// ── 쿠팡 파트너스 ─────────────────────────────────────────────
async function coupangGet(path, query) {
  const ak = process.env.COUPANG_ACCESS_KEY, sk = process.env.COUPANG_SECRET_KEY
  const d = new Date(), p = (x) => String(x).padStart(2, "0")
  const dt = `${String(d.getUTCFullYear()).slice(-2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  const sig = createHmac("sha256", sk).update(dt + "GET" + path + query).digest("hex")
  const r = await fetch(`https://api-gateway.coupang.com${path}?${query}`, {
    headers: { Authorization: `CEA algorithm=HmacSHA256, access-key=${ak}, signed-date=${dt}, signature=${sig}` },
  })
  const j = await r.json().catch(() => ({}))
  if (r.status !== 200 || String(j.rCode) !== "0") throw new Error(`쿠팡 ${path.split("/").pop()}: ${r.status} ${j.rMessage ?? ""}`)
  return j.data ?? []
}
async function coupang() {
  if (!process.env.COUPANG_ACCESS_KEY || !process.env.COUPANG_SECRET_KEY) return null
  const base = "/v2/providers/affiliate_open_api/apis/openapi/v1/reports/"
  const q = (r) => `startDate=${ymd(r.start)}&endDate=${ymd(r.end)}`
  const sum = (rows) => rows.reduce((s, x) => ({ click: s.click + (x.click ?? 0), order: s.order + (x.order ?? 0), cancel: s.cancel + (x.cancel ?? 0), gmv: s.gmv + Number(x.gmv ?? 0), commission: s.commission + Number(x.commission ?? 0) }), { click: 0, order: 0, cancel: 0, gmv: 0, commission: 0 })
  const [cur, prev, clicks] = await Promise.all([coupangGet(base + "commission", q(W)), coupangGet(base + "commission", q(P)), coupangGet(base + "clicks", q(W))])
  const byTag = {}
  for (const c of clicks) {
    const k = /^\d+$/.test(c.ctag ?? "") || !c.ctag ? "(상품 직접 링크)" : c.ctag
    byTag[k] = (byTag[k] ?? 0) + (c.click ?? 0)
  }
  return { cur: sum(cur), prev: sum(prev), top: Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 8) }
}

// ── 구글 서치콘솔 (서비스 계정) ───────────────────────────────
async function gscToken(sa) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const now = Math.floor(Date.now() / 1000)
  const body = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`
  const sig = createSign("RSA-SHA256").update(body).sign(sa.private_key, "base64url")
  const r = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${body}.${sig}` }) })).json()
  if (!r.access_token) throw new Error(`서치콘솔 로그인 실패: ${r.error_description ?? r.error}`)
  return r.access_token
}
async function gsc() {
  if (!process.env.GSC_SA_KEY) return null
  const sa = JSON.parse(process.env.GSC_SA_KEY)
  const h = { Authorization: `Bearer ${await gscToken(sa)}`, "Content-Type": "application/json" }
  const sites = (await (await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: h })).json()).siteEntry ?? []
  const site = process.env.GSC_SITE || sites.map((s) => s.siteUrl).find((u) => u.includes(HOST))
  if (!site) throw new Error(`서치콘솔에서 ${HOST} 속성을 못 찾음 (서비스 계정 ${sa.client_email}을 사용자로 추가했는지 확인)`)
  const query = async (r, dims, rowLimit = 10) => {
    const res = await (await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, { method: "POST", headers: h, body: JSON.stringify({ startDate: iso(r.start), endDate: iso(r.end), dimensions: dims, rowLimit }) })).json()
    if (res.error) throw new Error(`서치콘솔: ${res.error.message}`)
    return res.rows ?? []
  }
  const [cur, prev, qs, pages] = await Promise.all([query(W, []), query(P, []), query(W, ["query"]), query(W, ["page"])])
  return { site, cur: cur[0] ?? {}, prev: prev[0] ?? {}, qs, pages }
}

// ── 보고서 ───────────────────────────────────────────────────
const settle = async (f) => { try { return { v: await f() } } catch (e) { return { err: e.message } } }
const [C, K, G] = await Promise.all([settle(cf), settle(coupang), settle(gsc)])
const out = []
const say = (s = "") => out.push(s)
const missing = (name, how) => say(`_${name} 연결 안 됨: ${how}_\n`)

say(`## 정비핵 주간 보고 ${md(W.start)}~${md(W.end)}`)
say(`비교: 그 전 주 ${md(P.start)}~${md(P.end)}\n`)

say(`### 방문 (Cloudflare Web Analytics, ${HOST})`)
if (C.err) say(`⚠️ ${C.err}\n`)
else if (!C.v) missing("Cloudflare", "저장소 시크릿 CF_API_TOKEN (Account Analytics Read)")
else {
  const c = C.v
  say(`| 지표 | 지난주 | 그 전 주 | 변화 |\n|---|---:|---:|---:|`)
  say(`| 방문 | ${n(c.visits)} | ${n(c.pVisits)} | ${diff(c.visits, c.pVisits)} |`)
  say(`| 페이지뷰 | ${n(c.views)} | ${n(c.pViews)} | ${diff(c.views, c.pViews)} |\n`)
  if (c.refs.length) say(`**유입 경로**: ${c.refs.map(([k, v]) => `${esc(k)} ${n(v)}`).join(" · ")}\n`)
  if (c.paths.length) say(`**많이 본 페이지**\n\n| 페이지 | 조회 |\n|---|---:|\n${c.paths.map(([k, v]) => `| ${esc(decodeURIComponent(k))} | ${n(v)} |`).join("\n")}\n`)
}

say(`### 쿠팡 파트너스`)
if (K.err) say(`⚠️ ${K.err}\n`)
else if (!K.v) missing("쿠팡", "저장소 시크릿 COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY")
else {
  const { cur: k, prev: p, top } = K.v
  say(`| 지표 | 지난주 | 그 전 주 | 변화 |\n|---|---:|---:|---:|`)
  say(`| 클릭 | ${n(k.click)} | ${n(p.click)} | ${diff(k.click, p.click)} |`)
  say(`| 주문 (취소) | ${n(k.order)} (${n(k.cancel)}) | ${n(p.order)} (${n(p.cancel)}) | ${diff(k.order, p.order)} |`)
  say(`| 판매액 | ${n(k.gmv)}원 | ${n(p.gmv)}원 | ${diff(k.gmv, p.gmv)} |`)
  say(`| 수익 | **${n(k.commission)}원** | ${n(p.commission)}원 | ${diff(k.commission, p.commission)} |\n`)
  say(`도메인 값(월 약 1,330원) 기준: 지난주 수익이 주당 약 310원을 ${k.commission >= 310 ? "넘었어요 ✅" : "아직 못 넘었어요"}.\n`)
  if (top.length) say(`**많이 눌린 링크**: ${top.map(([t, c]) => `${esc(t)} ${c}`).join(" · ")}\n`)
}

say(`### 구글 검색 (서치콘솔)`)
if (G.err) say(`⚠️ ${G.err}\n`)
else if (!G.v) missing("서치콘솔", "저장소 시크릿 GSC_SA_KEY (서비스 계정 JSON)")
else {
  const { cur: g, prev: gp, qs, pages } = G.v
  say(`| 지표 | 지난주 | 그 전 주 | 변화 |\n|---|---:|---:|---:|`)
  say(`| 클릭 | ${n(g.clicks)} | ${n(gp.clicks)} | ${diff(g.clicks ?? 0, gp.clicks ?? 0)} |`)
  say(`| 노출 | ${n(g.impressions)} | ${n(gp.impressions)} | ${diff(g.impressions ?? 0, gp.impressions ?? 0)} |`)
  say(`| 평균 순위 | ${g.position ? g.position.toFixed(1) : "-"} | ${gp.position ? gp.position.toFixed(1) : "-"} | |\n`)
  if (qs.length) say(`**검색어 (노출 많은 순)**\n\n| 검색어 | 노출 | 클릭 | 순위 |\n|---|---:|---:|---:|\n${qs.sort((a, b) => b.impressions - a.impressions).map((r) => `| ${esc(r.keys[0])} | ${n(r.impressions)} | ${n(r.clicks)} | ${r.position.toFixed(1)} |`).join("\n")}\n`)
  if (pages.length) say(`**페이지 (노출 많은 순)**\n\n| 페이지 | 노출 | 클릭 |\n|---|---:|---:|\n${pages.sort((a, b) => b.impressions - a.impressions).map((r) => `| ${esc(decodeURIComponent(r.keys[0].replace(/^https?:\/\/[^/]+/, "")) || "/")} | ${n(r.impressions)} | ${n(r.clicks)} |`).join("\n")}\n`)
  say(`_서치콘솔 데이터는 2~3일 늦게 들어와서 일요일 숫자가 덜 잡혀 있을 수 있어요._\n`)
}

say(`---\n직접 볼 것: 네이버 서치어드바이저 (API 없음) · 관리자 페이지 https://${HOST}/admin`)
console.log(out.join("\n"))

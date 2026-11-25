"use client"

/**
 * 차종 페이지 "부품 위치로 보기": 차 옆모습 도면에서 부위를 누르면 그 부분으로 확대되고
 * (바퀴 → 브레이크 디스크·캘리퍼·패드, 보닛 → 엔진룸 부품, 앞유리 → 와이퍼, 실내 → 에어컨 필터)
 * 옆(휴대폰은 아래)에 그 부위 소모품의 규격·비용·구매 링크가 나온다.
 */
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import type { BodyType, ZoneId } from "@/lib/car-diagram"
import { OutboundLink } from "@/components/seo/OutboundLink"
import { CoupangPickCard } from "@/components/cars/CoupangPickCard"
import { NaverCompareLink } from "@/components/cars/NaverCompareLink"
import { AFFILIATE_TEXT } from "@/components/seo/Shared"
import type { CoupangChoice } from "@/lib/coupang-links"

export interface DiagramPart {
  id: string
  name: string
  spec: string
  href: string
  interval?: string
  dealer: number
  self: number
  zone: ZoneId
  /** 소모품 분류 (oil·filter·spark·battery …): 엔진룸 그림의 부품과 짝짓기 */
  cat: string
  choices: CoupangChoice[]
  /** 네이버쇼핑 같은 검색어 링크 */
  naver?: string
}

/** 엔진룸 그림 속 부품 → 소모품 찾기 */
type BayKind = "oil" | "spark" | "air" | "battery"
const BAY_LABEL: Record<BayKind, string> = { oil: "엔진오일", spark: "점화플러그", air: "에어클리너", battery: "배터리" }
function bayPart(parts: DiagramPart[], k: BayKind) {
  return parts.find((p) => p.zone === "engine" && (k === "air" ? p.cat === "filter" : p.cat === k))
}

interface Props {
  carId: string
  carName: string
  body: BodyType
  zones: { id: ZoneId; title: string; hint: string }[]
  parts: DiagramPart[]
}

const W = 800
const H = 340
const FULL = { x: 0, y: 0, w: W, h: H }

/** 차체별 외곽선·창문·부위 위치 (앞이 오른쪽) */
const SHAPES: Record<
  BodyType,
  { body: string; glass: string; pillar: number[]; wheels: [number, number]; wy: number; r: number; spots: Record<ZoneId, [number, number]>; hood: string; ground: number }
> = {
  sedan: {
    body: "M60,250 L60,215 Q62,190 95,182 L180,170 Q250,112 330,102 L470,100 Q540,102 600,160 L700,175 Q745,182 748,215 L748,250 Q748,262 735,262 L670,262 A60,60 0 0 0 550,262 L250,262 A60,60 0 0 0 130,262 L75,262 Q60,262 60,250 Z",
    glass: "M200,168 Q262,120 332,112 L458,110 Q512,112 560,160 Z",
    pillar: [392, 112, 392, 168],
    wheels: [190, 610],
    wy: 262,
    r: 48,
    spots: { engine: [668, 196], wiper: [572, 150], cabin: [478, 196], front: [610, 262], rear: [190, 262] },
    hood: "M600,160 L700,175 Q745,182 748,215 L748,232 L590,232 Z",
    ground: 312,
  },
  suv: {
    body: "M55,255 L55,165 Q58,140 90,130 L150,96 Q170,82 200,80 L520,80 Q560,82 590,110 L640,160 L720,178 Q752,186 752,220 L752,255 Q752,268 738,268 L675,268 A65,65 0 0 0 545,268 L255,268 A65,65 0 0 0 125,268 L70,268 Q55,268 55,255 Z",
    glass: "M165,150 L195,100 Q205,92 220,92 L515,92 Q545,94 565,115 L605,150 Z",
    pillar: [400, 92, 400, 150],
    wheels: [190, 610],
    wy: 268,
    r: 52,
    spots: { engine: [690, 202], wiper: [612, 140], cabin: [500, 196], front: [610, 268], rear: [190, 268] },
    hood: "M640,160 L720,178 Q752,186 752,220 L752,236 L630,236 Z",
    ground: 322,
  },
  van: {
    body: "M50,258 L50,105 Q52,78 85,76 L560,74 Q600,76 625,100 L690,165 L725,175 Q752,183 752,215 L752,258 Q752,270 738,270 L675,270 A65,65 0 0 0 545,270 L255,270 A65,65 0 0 0 125,270 L65,270 Q50,270 50,258 Z",
    glass: "M75,150 L75,100 Q78,90 92,90 L555,88 Q585,90 600,108 L640,150 Z",
    pillar: [430, 88, 430, 150],
    wheels: [190, 610],
    wy: 270,
    r: 52,
    spots: { engine: [712, 205], wiper: [652, 145], cabin: [540, 200], front: [610, 270], rear: [190, 270] },
    hood: "M690,165 L725,175 Q752,183 752,215 L752,238 L680,238 Z",
    ground: 324,
  },
  truck: {
    body: "M470,262 L470,96 Q472,72 500,70 L640,70 Q690,72 705,110 L738,172 Q752,190 752,215 L752,256 Q752,268 738,268 L695,268 A58,58 0 0 0 579,268 L470,268 Z M40,250 L40,165 L462,165 L462,250 Q462,262 450,262 L240,262 A58,58 0 0 0 124,262 L52,262 Q40,262 40,250 Z",
    glass: "M560,150 L560,86 L640,86 Q672,88 685,115 L702,150 Z",
    pillar: [560, 86, 560, 150],
    wheels: [182, 637],
    wy: 266,
    r: 46,
    spots: { engine: [612, 214], wiper: [690, 130], cabin: [520, 200], front: [637, 266], rear: [182, 266] },
    hood: "M560,180 L700,180 L700,240 L560,240 Z",
    ground: 318,
  },
}

function zoneView(body: BodyType, zone: ZoneId) {
  const s = SHAPES[body]
  const [x, sy] = s.spots[zone]
  const wheel = zone === "front" || zone === "rear"
  const y = wheel ? sy - 24 : sy
  const w = zone === "front" || zone === "rear" ? 330 : 280
  const h = (w * H) / W
  return { x: Math.min(Math.max(x - w / 2, 0), W - w), y: Math.min(Math.max(y - h / 2, 0), H - h), w, h }
}

/** 원호 경로 (각도: 0°=오른쪽, 시계 방향이 +) */
function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)]
  const [x0, y0] = p(a0)
  const [x1, y1] = p(a1)
  return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}`
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`

export function CarDiagram({ carId, carName, body, zones, parts }: Props) {
  const s = SHAPES[body]
  const [zone, setZone] = useState<ZoneId | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [vb, setVb] = useState(FULL)
  const vbRef = useRef(FULL)
  const raf = useRef<number | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const animateTo = useCallback((to: typeof FULL) => {
    if (raf.current) cancelAnimationFrame(raf.current)
    const from = vbRef.current
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) {
      vbRef.current = to
      setVb(to)
      return
    }
    const t0 = performance.now()
    const dur = 650
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur)
      const e = 1 - Math.pow(1 - k, 3)
      const cur = {
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
        w: from.w + (to.w - from.w) * e,
        h: from.h + (to.h - from.h) * e,
      }
      vbRef.current = cur
      setVb(cur)
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }, [])

  // 부위를 누르면 그 자리로 확대만 한다 (화면을 아래로 내리지 않음). 첫 소모품을 골라 둔다.
  const open = (z: ZoneId | null) => {
    setZone(z)
    setSel(z ? parts.find((p) => p.zone === z)?.id ?? null : null)
    animateTo(z ? zoneView(body, z) : FULL)
  }
  const pickBay = (k: BayKind) => {
    const p = bayPart(parts, k)
    if (p) setSel(p.id)
  }

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current)
  }, [])

  const zoneParts = zone ? parts.filter((p) => p.zone === zone) : []
  const info = zones.find((z) => z.id === zone)
  const zoomed = zone !== null
  const hasZone = (z: ZoneId) => zones.some((x) => x.id === z)

  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr] lg:items-start">
      <div>
        <div className="relative overflow-hidden rounded-[18px] border border-border bg-[linear-gradient(180deg,#EEF2F7_0%,#F8FAFC_62%,#E6EBF2_100%)]">
          <svg
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            className="block h-auto w-full touch-manipulation select-none"
            role="img"
            aria-label={`${carName} 부품 위치 도면`}
          >
            <defs>
              <radialGradient id="cd-tire" cx="50%" cy="50%" r="50%">
                <stop offset="70%" stopColor="#1F2A3D" />
                <stop offset="100%" stopColor="#0E1626" />
              </radialGradient>
              <linearGradient id="cd-body" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#DCE3EC" />
              </linearGradient>
              <radialGradient id="cd-disc" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#E4E8EE" />
                <stop offset="100%" stopColor="#9AA5B4" />
              </radialGradient>
            </defs>

            {/* 바닥 그림자 */}
            <ellipse cx={W / 2} cy={s.ground - 4} rx={360} ry={10} fill="#14213D" opacity={0.12} />

            {/* 차체 */}
            <path d={s.body} fill="url(#cd-body)" stroke="#14213D" strokeWidth={2.5} strokeLinejoin="round" />
            <path d={s.glass} fill="#B9C6D8" stroke="#14213D" strokeWidth={2} strokeLinejoin="round" opacity={0.9} />
            <line x1={s.pillar[0]} y1={s.pillar[1]} x2={s.pillar[2]} y2={s.pillar[3]} stroke="#14213D" strokeWidth={6} />
            {/* 헤드램프·테일램프 */}
            <rect x={W - 70} y={s.wy - 70} width={22} height={10} rx={4} fill="#FDE68A" stroke="#14213D" strokeWidth={1.5} />
            <rect x={body === "truck" ? 44 : 58} y={s.wy - 72} width={12} height={14} rx={3} fill="#F87171" stroke="#14213D" strokeWidth={1.5} />

            {/* 엔진룸: 확대하면 보닛이 투명해지고 부품이 보인다 */}
            <g style={{ transition: "opacity .4s" }} opacity={zone === "engine" ? 1 : 0}>
              <path d={s.hood} fill="#14213D" opacity={0.08} />
              <EngineBay
                x={s.spots.engine[0]}
                y={s.spots.engine[1]}
                ev={zones.find((z) => z.id === "engine")?.title === "보닛 아래"}
                active={zone === "engine"}
                has={(k) => !!bayPart(parts, k)}
                selected={(k) => bayPart(parts, k)?.id === sel}
                onPick={pickBay}
              />
            </g>

            {/* 와이퍼 */}
            <Wipers x={s.spots.wiper[0]} y={s.spots.wiper[1]} active={zone === "wiper"} />

            {/* 실내 에어컨 필터 */}
            <g style={{ transition: "opacity .4s" }} opacity={zone === "cabin" ? 1 : 0}>
              <CabinFilter x={s.spots.cabin[0]} y={s.spots.cabin[1]} />
            </g>

            {/* 바퀴 */}
            {s.wheels.map((cx, i) => {
              const z: ZoneId = i === 0 ? "rear" : "front"
              return <Wheel key={cx} cx={cx} cy={s.wy} r={s.r} detail={zone === z} />
            })}

            {/* 부위 버튼 (전체 화면일 때) */}
            {(Object.keys(s.spots) as ZoneId[])
              .filter(hasZone)
              .map((z) => {
                const [x, y] = s.spots[z]
                const label = zones.find((q) => q.id === z)!.title
                return (
                  <g
                    key={z}
                    role="button"
                    tabIndex={zoomed ? -1 : 0}
                    aria-label={`${label} 부품 보기`}
                    onClick={() => open(z)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open(z))}
                    className="cursor-pointer outline-none [&:focus-visible>circle:last-of-type]:stroke-[#0B7A53]"
                    style={{ transition: "opacity .3s", opacity: zoomed ? 0 : 1, pointerEvents: zoomed ? "none" : "auto" }}
                  >
                    <circle cx={x} cy={y} r={30} fill="transparent" />
                    <circle cx={x} cy={y} r={13} fill="#0B7A53" opacity={0.3} className="cd-pulse" style={{ transformOrigin: `${x}px ${y}px` }} />
                    <circle cx={x} cy={y} r={10} fill="#0B7A53" stroke="#fff" strokeWidth={3} />
                    <g transform={`translate(${x},${y - 24})`} className="max-sm:hidden">
                      <rect x={-label.length * 7 - 8} y={-13} width={label.length * 14 + 16} height={24} rx={12} fill="#14213D" />
                      <text textAnchor="middle" y={4} fontSize={13} fontWeight={700} fill="#fff">
                        {label}
                      </text>
                    </g>
                  </g>
                )
              })}
          </svg>

          {zoomed && (
            <button
              type="button"
              onClick={() => open(null)}
              className="absolute left-3 top-3 inline-flex min-h-[40px] items-center rounded-full bg-card/95 px-3.5 text-[14px] font-semibold shadow ring-1 ring-border hover:bg-card active:translate-y-px"
            >
              ← 전체 보기
            </button>
          )}
        </div>

        {/* 부위 바로가기 (키보드·휴대폰용) */}
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="부위 선택">
          {zones.map((z) => (
            <li key={z.id}>
              <button
                type="button"
                onClick={() => open(zone === z.id ? null : z.id)}
                aria-pressed={zone === z.id}
                className={`inline-flex min-h-[40px] items-center rounded-full border px-3.5 text-[14px] font-semibold transition active:translate-y-px ${
                  zone === z.id ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {z.title}
                <span className={`num ml-1.5 text-[12px] ${zone === z.id ? "text-background/70" : "text-muted-foreground"}`}>
                  {parts.filter((p) => p.zone === z.id).length}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div ref={panelRef} className="scroll-mt-20" aria-live="polite">
        {!zone ? (
          <div className="rounded-[18px] border border-dashed border-border bg-card p-5">
            <p className="font-bold">초록 점을 눌러 보세요</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              바퀴를 누르면 브레이크 패드가, 보닛을 누르면 엔진룸 부품이 확대돼요. 부위별로 규격과 교체 비용, 구매 링크를 바로 볼 수 있어요.
            </p>
          </div>
        ) : (
          <div className="rounded-[18px] border border-border bg-card p-4 sm:p-5">
            <p className="text-[13px] text-muted-foreground">{info?.hint}</p>
            <h3 className="mt-0.5 text-[19px] font-bold">{info?.title} 소모품</h3>
            {zoneParts.length > 1 && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`${info?.title} 소모품 고르기`}>
                {zoneParts.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSel(p.id)}
                      aria-pressed={p.id === sel}
                      className={`min-h-[36px] rounded-full border px-3 text-[13px] font-semibold transition ${
                        p.id === sel ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground/40"
                      }`}
                    >
                      {p.name.replace(/\s*\+\s*오일필터/, "")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {zoneParts
              .filter((p) => p.id === sel)
              .map((p) => {
                const pick = p.choices.find((c) => c.kind === "pick")
                const rest = p.choices.filter((c) => c.kind !== "pick")
                return (
                  <div key={p.id} className="mt-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[16px] font-bold">{p.name}</p>
                      {p.interval && <span className="shrink-0 text-[12px] text-muted-foreground">{p.interval}</span>}
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{p.spec}</p>
                    <p className="num mt-1.5 text-[14px]">
                      공식센터(추정) <span className="price-was">{won(p.dealer)}</span>
                      {" → "}직접 구매 <b className="text-primary">{won(p.self)}</b>
                    </p>
                    {pick && (
                      <div className="mt-3">
                        <CoupangPickCard pick={pick} carId={carId} partId={p.id} compact />
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <Link href={p.href} className="inline-flex min-h-[40px] items-center text-[13px] font-semibold underline decoration-border underline-offset-4 hover:decoration-primary">
                        규격·교체 방법 자세히
                      </Link>
                      {rest.slice(0, 1).map((c) => (
                        <OutboundLink
                          key={c.url}
                          href={c.url}
                          target="coupang"
                          carId={carId}
                          partId={p.id}
                          sponsored
                          className="inline-flex h-10 items-center rounded-[10px] bg-primary px-4 text-[14px] font-bold text-primary-foreground transition hover:brightness-110 active:translate-y-px"
                        >
                          쿠팡에서 가격 보기
                        </OutboundLink>
                      ))}
                      {p.naver && <NaverCompareLink url={p.naver} carId={carId} partId={p.id} />}
                    </div>
                    {p.choices.length > 0 && <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{AFFILIATE_TEXT}</p>}
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}

/** 바퀴: 확대하면 휠이 비치고 브레이크 디스크·캘리퍼·패드가 보인다 */
function Wheel({ cx, cy, r, detail }: { cx: number; cy: number; r: number; detail: boolean }) {
  const spokes = Array.from({ length: 5 }, (_, i) => (i * 72 * Math.PI) / 180)
  const disc = r * 0.66
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="url(#cd-tire)" />
      <circle cx={cx} cy={cy} r={r * 0.72} fill="#C7D0DC" stroke="#14213D" strokeWidth={1.5} />
      {/* 브레이크 (확대 시) */}
      <g style={{ transition: "opacity .45s" }} opacity={detail ? 1 : 0}>
        <circle cx={cx} cy={cy} r={disc} fill="url(#cd-disc)" stroke="#5B6779" strokeWidth={1} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 * Math.PI) / 180
          return <circle key={i} cx={cx + Math.cos(a) * disc * 0.72} cy={cy + Math.sin(a) * disc * 0.72} r={1.3} fill="#5B6779" />
        })}
        <circle cx={cx} cy={cy} r={disc * 0.38} fill="#8794A6" stroke="#5B6779" />
        {/* 캘리퍼(빨강)가 디스크 가장자리를 물고, 그 안쪽의 패드(초록)가 디스크를 눌러 차를 세운다 */}
        <path d={arc(cx, cy, disc + 3, -75, -15)} stroke="#B42318" strokeWidth={16} strokeLinecap="round" fill="none" />
        <path d={arc(cx, cy, disc - 6, -70, -20)} stroke="#0B7A53" strokeWidth={6} strokeLinecap="round" fill="none" className="cd-glow" />
        <g fontSize={9} fontWeight={700}>
          <line x1={cx + disc * 0.62} y1={cy - disc * 0.62} x2={cx + r + 22} y2={cy - r - 12} stroke="#0B7A53" strokeWidth={1.2} />
          <text x={cx + r + 25} y={cy - r - 9} fill="#0B7A53">브레이크 패드</text>
          <line x1={cx + (disc + 10) * 0.26} y1={cy - (disc + 10) * 0.97} x2={cx - 10} y2={cy - r - 22} stroke="#B42318" strokeWidth={1.2} />
          <text x={cx - 13} y={cy - r - 19} textAnchor="end" fill="#B42318">캘리퍼</text>
          <line x1={cx - disc * 0.55} y1={cy + disc * 0.35} x2={cx - r - 14} y2={cy + r * 0.75} stroke="#4A5A72" strokeWidth={1.2} />
          <text x={cx - r - 17} y={cy + r * 0.75 + 3} textAnchor="end" fill="#4A5A72">브레이크 디스크</text>
        </g>
      </g>
      {/* 휠 스포크 (확대 시 흐려짐) */}
      <g style={{ transition: "opacity .45s" }} opacity={detail ? 0.18 : 1}>
        {spokes.map((a, i) => (
          <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * r * 0.7} y2={cy + Math.sin(a) * r * 0.7} stroke="#4A5A72" strokeWidth={7} strokeLinecap="round" />
        ))}
        <circle cx={cx} cy={cy} r={r * 0.16} fill="#4A5A72" />
      </g>
    </g>
  )
}

function EngineBay({
  x,
  y,
  ev,
  active,
  has,
  selected,
  onPick,
}: {
  x: number
  y: number
  ev: boolean
  active: boolean
  has: (k: BayKind) => boolean
  selected: (k: BayKind) => boolean
  onPick: (k: BayKind) => void
}) {
  // 확대된 엔진룸에서 부품을 누르면 그 소모품을 고른다 (고른 부품은 초록 테두리)
  const hit = (k: BayKind, box: [number, number, number, number]) =>
    active && has(k) ? (
      <g
        role="button"
        tabIndex={0}
        aria-label={`${BAY_LABEL[k]} 보기`}
        aria-pressed={selected(k)}
        onClick={() => onPick(k)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(k))}
        className="cursor-pointer outline-none"
      >
        <rect
          x={box[0]}
          y={box[1]}
          width={box[2]}
          height={box[3]}
          rx={5}
          fill="transparent"
          stroke={selected(k) ? "#0B7A53" : "#94A3B8"}
          strokeWidth={selected(k) ? 1.8 : 0.8}
          strokeDasharray={selected(k) ? undefined : "3 2"}
        />
      </g>
    ) : null
  return (
    <g fontSize={7} fontWeight={700}>
      {ev ? (
        <>
          <rect x={x - 46} y={y - 14} width={44} height={26} rx={3} fill="#14213D" />
          <rect x={x - 40} y={y - 19} width={7} height={5} fill="#B42318" />
          <rect x={x - 16} y={y - 19} width={7} height={5} fill="#4A5A72" />
          <text x={x - 24} y={y + 3} textAnchor="middle" fill="#fff">
            12V
          </text>
          <text x={x - 24} y={y + 24} textAnchor="middle" fill="#14213D">
            보조배터리
          </text>
          {hit("battery", [x - 50, y - 24, 52, 54])}
          <rect x={x + 6} y={y - 10} width={40} height={22} rx={8} fill="#8794A6" stroke="#14213D" />
          <text x={x + 26} y={y + 24} textAnchor="middle" fill="#14213D">
            감속기
          </text>
        </>
      ) : (
        <>
          {/* 엔진 블록 */}
          <rect x={x - 30} y={y - 16} width={52} height={34} rx={5} fill="#8794A6" stroke="#14213D" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={x - 24 + i * 11} y={y - 22} width={6} height={8} rx={1.5} fill="#7C3AED" className="cd-glow" />
          ))}
          <text x={x - 4} y={y - 28} textAnchor="middle" fill="#7C3AED">
            점화플러그
          </text>
          <circle cx={x + 12} cy={y - 6} r={5} fill="#F59E0B" stroke="#14213D" className="cd-glow" />
          <line x1={x + 16} y1={y - 3} x2={x + 34} y2={y + 26} stroke="#B45309" strokeWidth={0.8} />
          <text x={x + 36} y={y + 32} textAnchor="middle" fill="#B45309">
            엔진오일
          </text>
          {/* 에어클리너 */}
          <rect x={x - 62} y={y - 14} width={26} height={20} rx={4} fill="#1570EF" opacity={0.85} />
          <text x={x - 49} y={y + 15} textAnchor="middle" fill="#1570EF">
            에어클리너
          </text>
          {/* 배터리 */}
          <rect x={x + 28} y={y - 12} width={22} height={16} rx={2} fill="#14213D" />
          <text x={x + 39} y={y - 17} textAnchor="middle" fill="#14213D">
            배터리
          </text>
          {hit("spark", [x - 30, y - 36, 50, 22])}
          {hit("oil", [x + 2, y - 13, 44, 50])}
          {hit("air", [x - 66, y - 18, 34, 40])}
          {hit("battery", [x + 25, y - 26, 30, 32])}
        </>
      )}
    </g>
  )
}

function Wipers({ x, y, active }: { x: number; y: number; active: boolean }) {
  return (
    <g style={{ transition: "opacity .4s" }} opacity={active ? 1 : 0}>
      <g className={active ? "cd-wipe" : ""} style={{ transformOrigin: `${x - 30}px ${y + 8}px` }}>
        <line x1={x - 30} y1={y + 8} x2={x + 6} y2={y - 34} stroke="#14213D" strokeWidth={3} strokeLinecap="round" />
        <line x1={x - 6} y1={y - 8} x2={x + 10} y2={y - 40} stroke="#0B7A53" strokeWidth={4} strokeLinecap="round" />
      </g>
      <text x={x + 14} y={y + 2} fontSize={8} fontWeight={700} fill="#0B7A53">
        와이퍼 블레이드
      </text>
    </g>
  )
}

function CabinFilter({ x, y }: { x: number; y: number }) {
  return (
    <g fontSize={7.5} fontWeight={700}>
      <rect x={x - 30} y={y - 14} width={60} height={30} rx={4} fill="#fff" stroke="#14213D" strokeDasharray="3 2" />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1={x - 24 + i * 6} y1={y - 9} x2={x - 24 + i * 6} y2={y + 11} stroke="#1570EF" strokeWidth={2} className="cd-glow" />
      ))}
      <text x={x} y={y + 28} textAnchor="middle" fill="#1570EF">
        에어컨 필터
      </text>
      <text x={x} y={y - 19} textAnchor="middle" fill="#4A5A72" fontWeight={500}>
        글러브박스 안쪽
      </text>
    </g>
  )
}

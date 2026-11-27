/**
 * 부품 이름 앞의 작은 그림 + 한 줄 설명 (부품 이름만 봐서는 뭔지 모르는 사람을 위해).
 * 이름의 낱말로 종류를 고른다. 모르는 이름은 렌치 그림, 설명 없음.
 */
type Kind = "oil" | "air" | "cabin" | "fuel" | "pad" | "disc" | "lining" | "spark" | "wiper" | "battery" | "fluid" | "other"

const LOOK: { kind: Kind; re: RegExp; desc: string }[] = [
  { kind: "oil", re: /엔진\s*오일/, desc: "엔진 속을 매끄럽게 하는 기름이에요" },
  { kind: "cabin", re: /에어컨\s*필터|캐빈/, desc: "차 안으로 들어오는 바람을 거르는 필터예요" },
  { kind: "air", re: /에어\s*클리너|에어\s*필터|흡기/, desc: "엔진으로 들어가는 공기를 거르는 필터예요" },
  { kind: "fuel", re: /연료\s*필터/, desc: "연료 속 찌꺼기를 거르는 필터예요" },
  { kind: "pad", re: /브레이크\s*패드/, desc: "바퀴를 잡아 차를 세우는 마찰재예요" },
  { kind: "disc", re: /디스크/, desc: "브레이크 패드가 잡는 바퀴 안쪽 쇠 원판이에요" },
  { kind: "lining", re: /라이닝/, desc: "뒷바퀴를 잡는 드럼 브레이크 마찰재예요" },
  { kind: "spark", re: /점화\s*플러그|스파크\s*플러그/, desc: "엔진 안에서 불꽃을 튀겨 연료를 태워요" },
  { kind: "wiper", re: /와이퍼/, desc: "앞유리 빗물을 닦는 고무 날이에요" },
  { kind: "battery", re: /배터리|밧데리/, desc: "시동을 걸고 차에 전기를 대 주는 배터리예요" },
  { kind: "fluid", re: /브레이크\s*(오일|액)/, desc: "브레이크 페달 힘을 바퀴까지 전하는 기름이에요" },
  { kind: "fluid", re: /감속기|미션\s*오일|변속기/, desc: "기어를 보호하는 기름이에요" },
  { kind: "fluid", re: /냉각수|부동액/, desc: "엔진이 뜨거워지지 않게 식히는 물이에요" },
]

export function partLook(name: string): { kind: Kind; desc: string } {
  const hit = LOOK.find((l) => l.re.test(name))
  return hit ? { kind: hit.kind, desc: hit.desc } : { kind: "other", desc: "" }
}

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const

function Glyph({ kind }: { kind: Kind }) {
  switch (kind) {
    case "oil":
      return (
        <>
          <path {...P} d="M4 10h9l3-2h3l-2 3v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
          <path {...P} d="M7 10V8h4v2" />
          <path {...P} d="M20 14c0 1-.6 1.6-1.2 1.6S17.6 15 17.6 14c0-.8 1.2-2.2 1.2-2.2S20 13.2 20 14z" />
        </>
      )
    case "air":
    case "fuel":
      return (
        <>
          <rect {...P} x="3.5" y="6" width="17" height="12" rx="1.5" />
          <path {...P} d="M6 8.5l1.5 7 1.5-7 1.5 7 1.5-7 1.5 7 1.5-7 1.5 7 1.5-7" />
        </>
      )
    case "cabin":
      return (
        <>
          <path {...P} d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5" />
          <path {...P} d="M3 12h16a2.5 2.5 0 1 1-2.5 2.5" />
          <path {...P} d="M3 16h7" />
        </>
      )
    case "pad":
      return (
        <>
          <path {...P} d="M4 15a8 8 0 0 1 16 0l-3 .5a5 5 0 0 0-10 0z" />
          <path {...P} d="M8 18h8" />
        </>
      )
    case "disc":
      return (
        <>
          <circle {...P} cx="12" cy="12" r="8.5" />
          <circle {...P} cx="12" cy="12" r="3" />
          <path {...P} d="M12 4.5v1.5M12 18v1.5M4.5 12H6M18 12h1.5" />
        </>
      )
    case "lining":
      return (
        <>
          <circle {...P} cx="12" cy="12" r="8.5" />
          <path {...P} d="M7 8.5a6 6 0 0 0 0 7M17 8.5a6 6 0 0 1 0 7" />
        </>
      )
    case "spark":
      return (
        <>
          <path {...P} d="M10 3h4v4h-4zM9 7h6l-1 6h-4z" />
          <path {...P} d="M11 13h2v4h-2zM12 17v2.5M12 19.5h2" />
        </>
      )
    case "wiper":
      return (
        <>
          <path {...P} d="M3.5 17a10 10 0 0 1 17 0" />
          <path {...P} d="M12 18L6.5 8.5" />
          <circle {...P} cx="12" cy="18" r="1.2" />
        </>
      )
    case "battery":
      return (
        <>
          <rect {...P} x="3.5" y="7.5" width="17" height="11" rx="1.5" />
          <path {...P} d="M7 7.5V5.5h2v2M15 7.5V5.5h2v2M6.5 13h3M8 11.5v3M14.5 13h3" />
        </>
      )
    case "fluid":
      return (
        <>
          <path {...P} d="M12 3.5s6 6.3 6 10.5a6 6 0 0 1-12 0c0-4.2 6-10.5 6-10.5z" />
          <path {...P} d="M9 14.5c1 .8 2 .8 3 0s2-.8 3 0" />
        </>
      )
    default:
      return <path {...P} d="M14.5 4.5a4 4 0 0 0-5 5L4 15l2.5 2.5 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2-.5-.5-2z" />
  }
}

/** 부품 그림 타일 (기본 40px) */
export function PartIcon({ name, size = 40 }: { name: string; size?: number }) {
  const { kind } = partLook(name)
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-[10px] bg-[#ECFDF3] text-[#067647]" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size * 0.66} height={size * 0.66}>
        <Glyph kind={kind} />
      </svg>
    </span>
  )
}

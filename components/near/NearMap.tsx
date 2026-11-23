"use client"

/**
 * 내 주변 공임나라·블루핸즈·오토큐·세차장 지도.
 * 카카오 지도 JavaScript SDK(services 라이브러리)로 지도와 장소 검색을 모두 브라우저에서 처리한다.
 * (JS 키는 공개용이고 카카오 콘솔에 등록한 도메인에서만 작동, lib/kakao.ts)
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { KAKAO_JS_KEY } from "@/lib/kakao"
import { distanceText, haversine, keepPlace, nearKind, type KakaoPlace } from "@/lib/near"
import { track } from "@/lib/track"

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    kakao?: any
  }
}

const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 }
const RADIUS = 20000

type Status = "idle" | "locating" | "searching" | "done" | "error"
interface Place extends KakaoPlace {
  meters: number
}

/** 마지막으로 찾은 위치 (다음 방문 때 위치 권한을 다시 묻지 않으려고). 이 브라우저에만 저장 */
const LOC_KEY = "mh_near_loc"
const LOC_DAYS = 30
interface SavedLoc {
  lat: number
  lng: number
  label: string
  t: number
}
function readLoc(): SavedLoc | null {
  try {
    const v = JSON.parse(localStorage.getItem(LOC_KEY) ?? "null") as SavedLoc | null
    if (v && Number.isFinite(v.lat) && Number.isFinite(v.lng) && Date.now() - v.t < LOC_DAYS * 864e5) return v
  } catch {
    /* 저장소를 못 쓰면 매번 새로 찾음 */
  }
  return null
}
function saveLoc(lat: number, lng: number, label: string) {
  try {
    localStorage.setItem(LOC_KEY, JSON.stringify({ lat: +lat.toFixed(4), lng: +lng.toFixed(4), label, t: Date.now() }))
  } catch {
    /* 무시 */
  }
}

let sdkPromise: Promise<any> | null = null
function loadKakao(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"))
  if (window.kakao?.maps?.services) return Promise.resolve(window.kakao)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script")
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&libraries=services&autoload=false`
    s.async = true
    s.onload = () => {
      if (!window.kakao?.maps) return reject(new Error("sdk"))
      window.kakao.maps.load(() => resolve(window.kakao))
    }
    s.onerror = () => reject(new Error("sdk"))
    document.head.appendChild(s)
  })
  sdkPromise.catch(() => {
    sdkPromise = null
  })
  return sdkPromise
}

/** 카카오 키워드 검색 한 페이지 (15개) */
function searchPage(kakao: any, query: string, opts: Record<string, unknown>): Promise<{ data: KakaoPlace[]; end: boolean; status: string }> {
  return new Promise((resolve) => {
    const places = new kakao.maps.services.Places()
    places.keywordSearch(
      query,
      (data: KakaoPlace[], status: string, pagination: any) => {
        resolve({ data: status === kakao.maps.services.Status.OK ? data : [], end: !pagination?.hasNextPage, status })
      },
      opts
    )
  })
}

function pinHtml(n: number, color: string, active: boolean) {
  const size = active ? 34 : 28
  return `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;cursor:pointer">
    <div style="min-width:${size}px;height:${size}px;padding:0 6px;border-radius:${size}px;background:${active ? "#14213D" : color};color:#fff;font:700 ${active ? 15 : 13}px/1 Pretendard,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(20,33,61,.35);border:2px solid #fff">${n}</div>
    <div style="width:2px;height:8px;background:${active ? "#14213D" : color}"></div>
  </div>`
}

/** kind는 정규식을 담고 있어 서버→브라우저로 넘길 수 없으므로 주소 이름(slug)만 받는다 */
export function NearMap({ slug }: { slug: string }) {
  const kind = nearKind(slug)!
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const overlays = useRef<any[]>([])
  const meOverlay = useRef<any>(null)
  const listRef = useRef<HTMLOListElement>(null)

  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [places, setPlaces] = useState<Place[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [area, setArea] = useState("")
  const [center, setCenter] = useState<{ lat: number; lng: number; label: string } | null>(null)
  const [moved, setMoved] = useState(false)
  const [variant, setVariant] = useState(kind.variants?.[0]?.id ?? "")
  const query = kind.variants?.find((v) => v.id === variant)?.query ?? kind.query

  /** 지도에 번호 핀 다시 그리기 */
  const drawPins = useCallback(
    (list: Place[], activeId: string | null) => {
      const kakao = window.kakao
      const map = mapRef.current
      if (!kakao || !map) return
      overlays.current.forEach((o) => o.setMap(null))
      overlays.current = list.map((p, i) => {
        const el = document.createElement("div")
        el.innerHTML = pinHtml(i + 1, kind.color, p.id === activeId)
        el.addEventListener("click", () => {
          setActive(p.id)
          document.getElementById(`place-${p.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" })
        })
        const o = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(Number(p.y), Number(p.x)),
          content: el,
          yAnchor: 0,
          zIndex: p.id === activeId ? 10 : 1,
        })
        o.setMap(map)
        return o
      })
    },
    [kind.color]
  )

  /** 기준 위치 주변에서 검색 (최대 45개 → 걸러서 거리순) */
  const searchAround = useCallback(
    async (lat: number, lng: number, label: string) => {
      setStatus("searching")
      setError("")
      setMoved(false)
      try {
        const kakao = await loadKakao()
        const map = mapRef.current
        const loc = new kakao.maps.LatLng(lat, lng)
        setCenter({ lat, lng, label })

        meOverlay.current?.setMap(null)
        meOverlay.current = new kakao.maps.CustomOverlay({
          position: loc,
          content:
            '<div style="width:16px;height:16px;border-radius:50%;background:#1570EF;border:3px solid #fff;box-shadow:0 0 0 6px rgba(21,112,239,.2)"></div>',
          xAnchor: 0.5,
          yAnchor: 0.5,
          zIndex: 0,
        })
        meOverlay.current.setMap(map)

        const found: KakaoPlace[] = []
        for (let page = 1; page <= 3; page++) {
          const r = await searchPage(kakao, query, {
            location: loc,
            radius: RADIUS,
            sort: kakao.maps.services.SortBy.DISTANCE,
            page,
          })
          if (r.status === kakao.maps.services.Status.ERROR) throw new Error("search")
          found.push(...r.data)
          if (r.end) break
        }
        const seen = new Set<string>()
        const list = found
          .filter((p) => keepPlace(kind, p) && !seen.has(p.id) && seen.add(p.id))
          .map((p) => ({ ...p, meters: haversine(lat, lng, Number(p.y), Number(p.x)) }))
          .sort((a, b) => a.meters - b.meters)
          .slice(0, 30)

        setPlaces(list)
        setActive(null)
        drawPins(list, null)

        // 기준 위치와 가까운 곳 몇 개가 한 화면에 들어오게
        const bounds = new kakao.maps.LatLngBounds()
        bounds.extend(loc)
        list.slice(0, 5).forEach((p) => bounds.extend(new kakao.maps.LatLng(Number(p.y), Number(p.x))))
        if (list.length) map.setBounds(bounds, 40, 40, 40, 40)
        else map.setCenter(loc)
        setStatus("done")
        if (label !== "서울시청") saveLoc(lat, lng, label === "지도 중심" || label === "내 위치" ? "지난번 위치" : label)
      } catch {
        setStatus("error")
        setError("지도를 불러오지 못했어요. 잠시 뒤 다시 시도하거나 카카오맵에서 직접 검색해 주세요.")
      }
    },
    [kind, query, drawPins]
  )

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setNotice("이 브라우저는 위치 확인을 지원하지 않아 서울시청 기준으로 보여 드려요. 동네 이름으로 검색해 보세요.")
      searchAround(SEOUL_CITY_HALL.lat, SEOUL_CITY_HALL.lng, "서울시청")
      return
    }
    setStatus("locating")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNotice("")
        searchAround(pos.coords.latitude, pos.coords.longitude, "내 위치")
      },
      () => {
        setNotice("위치 권한이 없어 서울시청 기준으로 보여 드려요. 위에서 동네·역 이름으로 검색할 수 있어요.")
        searchAround(SEOUL_CITY_HALL.lat, SEOUL_CITY_HALL.lng, "서울시청")
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    )
  }, [searchAround])

  /** 동네·역 이름 → 좌표 → 주변 검색 */
  const searchArea = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const q = area.trim()
      if (!q) return
      setStatus("searching")
      try {
        const kakao = await loadKakao()
        const r = await searchPage(kakao, q, {})
        const first = r.data[0]
        if (!first) {
          setStatus("done")
          setNotice(`"${q}" 위치를 찾지 못했어요. 역 이름이나 동 이름으로 다시 입력해 보세요.`)
          return
        }
        setNotice("")
        searchAround(Number(first.y), Number(first.x), first.place_name)
      } catch {
        setStatus("error")
        setError("지도를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.")
      }
    },
    [area, searchAround]
  )

  // 지도 준비 + 처음 검색
  useEffect(() => {
    let cancelled = false
    loadKakao()
      .then((kakao) => {
        if (cancelled || !mapEl.current) return
        const map = new kakao.maps.Map(mapEl.current, {
          center: new kakao.maps.LatLng(SEOUL_CITY_HALL.lat, SEOUL_CITY_HALL.lng),
          level: 6,
        })
        map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT)
        kakao.maps.event.addListener(map, "dragend", () => setMoved(true))
        mapRef.current = map
        const saved = readLoc()
        if (saved) searchAround(saved.lat, saved.lng, saved.label)
        else locateMe()
      })
      .catch(() => {
        if (cancelled) return
        setStatus("error")
        setError("지도를 불러오지 못했어요. 카카오맵에서 직접 검색해 주세요.")
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 세부 종류(셀프·손세차 등)를 바꾸면 같은 위치에서 다시 찾기
  const firstVariant = useRef(true)
  useEffect(() => {
    if (firstVariant.current) {
      firstVariant.current = false
      return
    }
    if (center) searchAround(center.lat, center.lng, center.label)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant])

  useEffect(() => {
    drawPins(places, active)
  }, [active, places, drawPins])

  const focus = (p: Place) => {
    setActive(p.id)
    const kakao = window.kakao
    if (kakao && mapRef.current) mapRef.current.panTo(new kakao.maps.LatLng(Number(p.y), Number(p.x)))
  }

  const researchHere = () => {
    const c = mapRef.current?.getCenter()
    if (c) searchAround(c.getLat(), c.getLng(), "지도 중심")
  }

  const busy = status === "locating" || status === "searching"
  const kakaoSearchUrl = `https://map.kakao.com/?q=${encodeURIComponent(query)}`

  return (
    <div>
      <form onSubmit={searchArea} className="flex gap-2">
        <label htmlFor="near-area" className="sr-only">
          동네 또는 역 이름
        </label>
        <input
          id="near-area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="동네·역 이름 (예: 강남역, 분당 정자동)"
          className="h-12 min-w-0 flex-1 rounded-[10px] border border-input bg-card px-3.5 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          enterKeyHint="search"
        />
        <button
          type="submit"
          className="h-12 shrink-0 rounded-[10px] bg-foreground px-4 text-[15px] font-bold text-background transition hover:brightness-125 active:translate-y-px"
        >
          검색
        </button>
        <button
          type="button"
          onClick={locateMe}
          className="h-12 shrink-0 rounded-[10px] border border-border bg-card px-3.5 text-[15px] font-semibold transition hover:border-primary/50 active:translate-y-px"
          aria-label="내 위치 기준으로 찾기"
        >
          <span aria-hidden className="mr-1">◎</span>내 위치
        </button>
      </form>

      {kind.variants && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="세차장 종류">
          {kind.variants.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVariant(v.id)}
              aria-pressed={variant === v.id}
              className={`inline-flex min-h-[36px] items-center rounded-full border px-3.5 text-[13px] font-semibold transition active:translate-y-px ${
                variant === v.id ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-primary/50"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {notice && <p className="mt-3 rounded-[10px] bg-[#FFF6ED] px-3.5 py-2.5 text-[14px] text-[#B54708]">{notice}</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="relative overflow-hidden rounded-[14px] border border-border bg-muted">
          <div ref={mapEl} className="h-[46vh] min-h-[300px] w-full lg:h-[600px]" role="application" aria-label={`${kind.label} 지도`} />
          {busy && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
              <span className="rounded-full bg-card px-3.5 py-1.5 text-[13px] font-semibold shadow">
                {status === "locating" ? "위치 확인 중…" : `${kind.label} 찾는 중…`}
              </span>
            </div>
          )}
          {moved && !busy && (
            <button
              type="button"
              onClick={researchHere}
              className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-[14px] font-bold text-background shadow-lg transition hover:brightness-125 active:translate-y-px"
            >
              이 지역에서 다시 찾기
            </button>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted p-6 text-center">
              <p className="text-[15px] font-semibold">{error}</p>
              <a href={kakaoSearchUrl} target="_blank" rel="noopener" className="text-[14px] font-semibold text-primary underline underline-offset-4">
                카카오맵에서 {kind.label} 검색
              </a>
            </div>
          )}
        </div>

        <div className="min-w-0">
          {status === "done" && (
            <p className="mb-2 text-[14px] text-muted-foreground">
              {center?.label} 기준 20km 안 <b className="text-foreground">{places.length}곳</b>
              {places.length > 0 && ", 가까운 순"}
            </p>
          )}
          {status === "done" && places.length === 0 && (
            <div className="rounded-[14px] border border-dashed border-border bg-card p-6 text-center">
              <p className="font-semibold">20km 안에 {kind.label}이(가) 없어요</p>
              <p className="mt-1 text-[14px] text-muted-foreground">다른 동네를 검색하거나 지도를 옮긴 뒤 다시 찾아보세요.</p>
            </div>
          )}
          <ol ref={listRef} className="max-h-none space-y-2 lg:max-h-[570px] lg:overflow-y-auto lg:pr-1">
            {places.map((p, i) => (
              <li key={p.id} id={`place-${p.id}`}>
                <div
                  className={`rounded-[14px] border bg-card p-3.5 transition ${
                    active === p.id ? "border-foreground shadow-[0_0_0_1px_hsl(var(--foreground))]" : "border-border"
                  }`}
                >
                  <button type="button" onClick={() => focus(p)} className="flex w-full items-start gap-3 text-left">
                    <span
                      className="num mt-0.5 flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-1.5 text-[13px] font-bold text-white"
                      style={{ background: active === p.id ? "#14213D" : kind.color }}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-bold">{p.place_name}</span>
                        <span className="num shrink-0 text-[14px] font-semibold text-primary">{distanceText(p.meters)}</span>
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{p.road_address_name || p.address_name}</span>
                    </span>
                  </button>
                  <div className="mt-2.5 flex gap-2 pl-10">
                    {p.phone && (
                      <a
                        href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}
                        className="inline-flex min-h-[36px] items-center rounded-lg border border-border px-3 text-[13px] font-semibold hover:border-primary/50"
                      >
                        전화 {p.phone}
                      </a>
                    )}
                    <a
                      href={`https://map.kakao.com/link/to/${encodeURIComponent(p.place_name)},${p.y},${p.x}`}
                      target="_blank"
                      rel="noopener"
                      onClick={() => track({ type: "outbound", target: "kakaomap", meta: { kind: kind.slug, action: "route" } })}
                      className="inline-flex min-h-[36px] items-center rounded-lg bg-foreground px-3 text-[13px] font-bold text-background hover:brightness-125"
                    >
                      길찾기
                    </a>
                    <a
                      href={p.place_url}
                      target="_blank"
                      rel="noopener"
                      onClick={() => track({ type: "outbound", target: "kakaomap", meta: { kind: kind.slug, action: "detail" } })}
                      className="inline-flex min-h-[36px] items-center rounded-lg px-2 text-[13px] font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      상세
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">위치 정보: 카카오 로컬. 지점 정보가 바뀌었을 수 있으니 방문 전 전화로 확인하세요. 위치는 저장하지 않습니다.</p>
    </div>
  )
}

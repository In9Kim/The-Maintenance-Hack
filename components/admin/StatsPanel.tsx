"use client"

import { useState, useEffect } from "react"
import { TrendingUp, ShoppingCart, Wrench, Loader2, Database, Zap } from "lucide-react"
import type { CarModel } from "@/types"

interface CarStat {
  car: CarModel
  views: number
  clicks: number
  gongimClicks: number
  total: number
}

interface CacheStatsData {
  sheetsEnabled: boolean
  hits: number
  misses: number
  totalCalls: number
  hitRate: number
  estimatedSavingsKrw: number
  costPerCallKrw: number
  cacheRowCount: number
  lastUpdated: string
}

interface Props {
  cars: CarModel[]
}

export function StatsPanel({ cars }: Props) {
  const [stats, setStats] = useState<CarStat[] | null>(null)
  const [topParts, setTopParts] = useState<{ key: string; count: number }[]>([])
  const [cacheStats, setCacheStats] = useState<CacheStatsData | null>(null)
  const [outbound, setOutbound] = useState<Record<string, number>>({})
  const [byDay, setByDay] = useState<Record<string, { events: number; outbound: number }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then((r) => r.json()),
      fetch("/api/admin/cache-stats").then((r) => r.json()),
    ])
      .then(([usageData, cacheData]) => {
        setStats(usageData.carStats ?? [])
        setTopParts(usageData.topParts ?? [])
        setOutbound(usageData.outbound ?? {})
        setByDay(usageData.byDay ?? {})
        setCacheStats(cacheData)
      })
      .catch(() => setStats([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const totalClicks = (stats ?? []).reduce((s, c) => s + c.clicks, 0)
  const maxTotal = Math.max(...(stats ?? []).map((s) => s.total), 1)

  return (
    <div className="space-y-4">
    {/* 구매·예약 사이트 이동 (1차 목표 지표) */}
    <OutboundCard outbound={outbound} byDay={byDay} />
    {/* Google Sheets 캐시 절감 통계 */}
    <CacheSavingsCard data={cacheStats} />
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* 차종별 인기도 */}
      <div className="col-span-2 rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">차종별 인기도 (조회 + 클릭 가중합산)</p>
        </div>
        {(stats ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            아직 통계 데이터가 없습니다.
            <br />
            사용자가 앱을 사용하면 자동으로 기록됩니다.
          </p>
        ) : (
          <div className="space-y-2.5">
            {(stats ?? []).slice(0, 10).map(({ car, views, clicks, gongimClicks, total }) => (
              <div key={car.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="truncate font-medium">
                    {car.brand} {car.model}{" "}
                    <span className="text-muted-foreground">{car.generation}</span>
                  </span>
                  <div className="ml-2 flex shrink-0 gap-2 text-muted-foreground">
                    <span title="조회">👁 {views}</span>
                    <span title="쿠팡 클릭">🛒 {clicks}</span>
                    <span title="공임나라 클릭">🔧 {gongimClicks}</span>
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(total / maxTotal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 오른쪽: 요약 + 부품 클릭 Top */}
      <div className="space-y-4">
        {/* 요약 카드 */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            전체 통계
          </p>
          <div className="space-y-2">
            <StatRow
              icon={<ShoppingCart className="h-3.5 w-3.5 text-primary" />}
              label="쿠팡 클릭 총합"
              value={totalClicks}
            />
            <StatRow
              icon={<Wrench className="h-3.5 w-3.5 text-emerald-400" />}
              label="공임나라 클릭"
              value={(stats ?? []).reduce((s, c) => s + c.gongimClicks, 0)}
            />
          </div>
        </div>

        {/* 부품 Top 클릭 */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            부품별 클릭 Top
          </p>
          {topParts.length === 0 ? (
            <p className="text-xs text-muted-foreground">데이터 없음</p>
          ) : (
            <div className="space-y-1.5">
              {topParts.slice(0, 6).map(({ key, count }) => {
                const [carId, partId] = key.split(":")
                const car = cars.find((c) => c.id === carId)
                const part = car?.parts.find((p) => p.id === partId)
                return (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="truncate text-muted-foreground">
                      {part?.name ?? key}
                    </span>
                    <span className="ml-2 shrink-0 tabular-nums font-medium">{count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  )
}

function CacheSavingsCard({ data }: { data: CacheStatsData | null }) {
  if (!data) return null

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Database className="h-4 w-4 text-emerald-400" />
        <p className="text-sm font-semibold">Google Sheets 캐시 절감 통계</p>
        {data.sheetsEnabled ? (
          <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
            연동됨
          </span>
        ) : (
          <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
            미연동
          </span>
        )}
      </div>

      {!data.sheetsEnabled && (
        <p className="mb-3 text-xs text-muted-foreground">
          GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY 환경변수를 설정하면
          Gemini API 캐싱이 활성화됩니다.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile
          label="캐시 히트"
          value={data.hits.toLocaleString()}
          sub="절감된 API 호출"
          highlight
        />
        <MetricTile
          label="캐시 미스"
          value={data.misses.toLocaleString()}
          sub="실제 API 호출"
        />
        <MetricTile
          label="히트율"
          value={`${data.hitRate}%`}
          sub={`전체 ${data.totalCalls}건`}
          highlight={data.hitRate >= 30}
        />
        <MetricTile
          label="예상 절감액"
          value={`₩${data.estimatedSavingsKrw.toFixed(1)}`}
          sub={`호출당 ₩${data.costPerCallKrw}`}
          highlight
        />
      </div>

      {data.sheetsEnabled && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3" />
            <span>캐시 시트 저장 항목: {data.cacheRowCount.toLocaleString()}행</span>
          </div>
          {data.lastUpdated && (
            <span>마지막 갱신: {new Date(data.lastUpdated).toLocaleString("ko-KR")}</span>
          )}
        </div>
      )}
    </div>
  )
}

function MetricTile({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string
  value: string
  sub: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-extrabold tabular-nums ${highlight ? "text-emerald-400" : "text-foreground"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="tabular-nums font-medium">{value.toLocaleString()}</span>
    </div>
  )
}

const OUTBOUND_LABELS: Record<string, string> = { coupang: "쿠팡", naver: "네이버", gongim: "공임나라", other: "기타" }

function OutboundCard({
  outbound,
  byDay,
}: {
  outbound: Record<string, number>
  byDay: Record<string, { events: number; outbound: number }>
}) {
  const total = Object.values(outbound).reduce((a, b) => a + b, 0)
  const days = Object.entries(byDay)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7)
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="mb-3 text-sm font-semibold">구매·예약 사이트 이동 (누적 {total.toLocaleString("ko-KR")}회)</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.keys(OUTBOUND_LABELS).map((k) => (
          <span key={k} className="rounded-full border border-border px-3 py-1 text-xs">
            {OUTBOUND_LABELS[k]} <b className="tabular-nums">{(outbound[k] ?? 0).toLocaleString("ko-KR")}</b>
          </span>
        ))}
      </div>
      {days.length > 0 ? (
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-medium">날짜</th>
              <th className="py-1 text-right font-medium">전체 행동</th>
              <th className="py-1 text-right font-medium">사이트 이동</th>
            </tr>
          </thead>
          <tbody>
            {days.map(([day, v]) => (
              <tr key={day} className="border-t border-border">
                <td className="py-1">{day}</td>
                <td className="py-1 text-right tabular-nums">{v.events}</td>
                <td className="py-1 text-right tabular-nums">{v.outbound}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-muted-foreground">아직 기록이 없습니다. (구글시트 연결 후 쌓이기 시작해요)</p>
      )}
    </div>
  )
}

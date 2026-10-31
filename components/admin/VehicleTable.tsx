"use client"

import { useState, useMemo } from "react"
import { CheckCircle, XCircle, Trash2, ChevronDown, ChevronUp, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CarModel } from "@/types"

interface Props {
  initialCars: CarModel[]
}

export function VehicleTable({ initialCars }: Props) {
  const [cars, setCars] = useState<CarModel[]>(initialCars)
  const [loading, setLoading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<"brand" | "parts" | "verified">("brand")

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return cars
      .filter(
        (c) =>
          !q ||
          c.brand.includes(q) ||
          c.model.includes(q) ||
          c.generation.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (sortBy === "parts") return b.parts.length - a.parts.length
        if (sortBy === "verified") return Number(b.is_verified !== false) - Number(a.is_verified !== false)
        return a.brand.localeCompare(b.brand)
      })
  }, [cars, search, sortBy])

  async function toggleVerified(car: CarModel) {
    const newVal = car.is_verified === false ? true : false
    setLoading(car.id)
    try {
      const res = await fetch(`/api/admin/vehicles/${car.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_verified: newVal }),
      })
      if (res.ok) {
        setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, is_verified: newVal } : c)))
      }
    } finally {
      setLoading(null)
    }
  }

  async function deleteCar(id: string) {
    if (!confirm("정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return
    setLoading(id)
    try {
      const res = await fetch(`/api/admin/vehicles/${id}`, { method: "DELETE" })
      if (res.ok) setCars((prev) => prev.filter((c) => c.id !== id))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      {/* 검색 + 정렬 */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm outline-none focus:border-primary"
            placeholder="브랜드, 모델 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
        >
          <option value="brand">브랜드순</option>
          <option value="parts">부품 수 ↓</option>
          <option value="verified">검증 상태</option>
        </select>
      </div>

      {/* 테이블 */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">차종</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">부품</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">상태</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((car) => {
              const isVerified = car.is_verified !== false
              const isExpanded = expanded === car.id
              const busy = loading === car.id
              return (
                <>
                  <tr key={car.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpanded(isExpanded ? null : car.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <div>
                          <p className="font-medium">
                            {car.brand} {car.model}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {car.generation} · {car.yearRange}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                      {car.parts.length}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isVerified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          <CheckCircle className="h-3 w-3" /> 검증됨
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
                          <XCircle className="h-3 w-3" /> 대기
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant={isVerified ? "outline" : "default"}
                          className="h-7 text-xs"
                          disabled={busy}
                          onClick={() => toggleVerified(car)}
                        >
                          {busy ? "..." : isVerified ? "미검증 처리" : "검증 승인"}
                        </Button>
                        <button
                          onClick={() => deleteCar(car.id)}
                          disabled={busy}
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* 부품 상세 펼치기 */}
                  {isExpanded && (
                    <tr key={`${car.id}-detail`}>
                      <td colSpan={4} className="bg-secondary/20 px-8 py-3">
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">부품 목록</p>
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                          {car.parts.map((p) => (
                            <div key={p.id} className="flex justify-between rounded border border-border/50 bg-background px-3 py-1.5 text-xs">
                              <span className="text-muted-foreground">{p.name}</span>
                              <span className="tabular-nums">
                                쿠팡 {p.coupangPrice.toLocaleString()}원
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">검색 결과가 없습니다.</div>
        )}
      </div>
      <p className="text-right text-xs text-muted-foreground">
        {filtered.length} / {cars.length} 차종
      </p>
    </div>
  )
}

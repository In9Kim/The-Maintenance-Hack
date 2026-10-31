"use client"

import { useState } from "react"
import { Loader2, AlertTriangle, GitMerge, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DuplicateGroup } from "@/types"

export function NormalizePanel() {
  const [loading, setLoading] = useState(false)
  const [merging, setMerging] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateGroup[] | null>(null)
  const [doneMsg, setDoneMsg] = useState<string | null>(null)

  async function runDetect() {
    setLoading(true)
    setDoneMsg(null)
    try {
      const res = await fetch("/api/admin/normalize")
      const data = await res.json()
      setDuplicates(data.duplicates ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function mergeDuplicates(group: DuplicateGroup, keepIdx: number) {
    const keepId = group.cars[keepIdx].id
    const removeIds = group.cars.filter((_, i) => i !== keepIdx).map((c) => c.id)
    setMerging(keepId)
    try {
      const res = await fetch("/api/admin/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepId, removeIds }),
      })
      if (res.ok) {
        setDuplicates((prev) => prev?.filter((g) => !g.cars.some((c) => c.id === keepId)) ?? [])
        setDoneMsg(`${removeIds.length}개 중복 항목이 병합 완료되었습니다.`)
      }
    } finally {
      setMerging(null)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">중복 감지 및 데이터 정제 에이전트</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            유사 명칭의 차종을 탐지하여 병합(Merge)을 제안합니다.
          </p>
        </div>
        <Button size="sm" onClick={runDetect} disabled={loading} className="gap-2 shrink-0">
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              분석 중...
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5" />
              중복 감지 실행
            </>
          )}
        </Button>
      </div>

      {doneMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
          <CheckCircle className="h-3.5 w-3.5" />
          {doneMsg}
        </div>
      )}

      {duplicates !== null && (
        <>
          {duplicates.length === 0 ? (
            <div className="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
              중복 차종이 감지되지 않았습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {duplicates.map((group, gi) => (
                <div
                  key={gi}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <p className="text-sm font-medium text-amber-400">{group.reason}</p>
                  </div>
                  <div className="space-y-2">
                    {group.cars.map((car, ci) => (
                      <div
                        key={car.id}
                        className="flex items-center justify-between rounded border border-border bg-background px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {car.brand} {car.model}{" "}
                            <span className="text-muted-foreground">{car.generation}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {car.yearRange} · {car.parts.length}개 부품 ·{" "}
                            {car.is_verified === false ? (
                              <span className="text-amber-400">미검증</span>
                            ) : (
                              <span className="text-emerald-400">검증됨</span>
                            )}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 gap-1 text-xs"
                          disabled={!!merging}
                          onClick={() => mergeDuplicates(group, ci)}
                        >
                          {merging === car.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <GitMerge className="h-3 w-3" />
                          )}
                          이걸로 유지
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

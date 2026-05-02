"use client"

import { useState } from "react"
import { Wrench, Upload } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Modal } from "@/components/ui/modal"

export function Header() {
  const [showAnalysisModal, setShowAnalysisModal] = useState(false)

  function handleGuideClick(e: React.MouseEvent) {
    e.preventDefault()
    document.getElementById("guide-section")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Wrench className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight">정비핵</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                The Maintenance Hack
              </span>
            </div>

            <nav className="flex items-center gap-1 text-sm">
              <a
                href="#"
                className="rounded-md px-3 py-1.5 text-foreground transition-colors hover:bg-accent"
              >
                계산기
              </a>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <button
                onClick={() => setShowAnalysisModal(true)}
                className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                견적서 분석
              </button>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <a
                href="#guide-section"
                onClick={handleGuideClick}
                className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                가이드
              </a>
            </nav>
          </div>
        </div>
      </header>

      <Modal
        open={showAnalysisModal}
        onClose={() => setShowAnalysisModal(false)}
        title="견적서 분석"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            정비소 견적서 사진을 업로드하면 AI가 항목을 분석하여 공임나라 + 쿠팡 조합 대비
            절감 가능 금액을 알려드립니다.
          </p>

          <label className="relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/40 transition-colors hover:border-primary/40 hover:bg-primary/5">
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">이미지를 드래그하거나 클릭해서 업로드</p>
            <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, HEIC · 최대 10MB</p>
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 cursor-pointer opacity-0"
              disabled
            />
          </label>

          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3">
            <p className="text-xs font-semibold text-amber-400">Phase 3 오픈 예정</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              AI 견적서 분석 기능은 Phase 3에서 오픈됩니다. 지금은 UI를 미리 확인할 수 있습니다.
            </p>
          </div>
        </div>
      </Modal>
    </>
  )
}

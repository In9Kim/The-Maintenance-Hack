"use client"

import { useEffect, useId, useRef, useState } from "react"

/**
 * 정보성 문구는 화면에 늘어놓지 않고 (i) 버튼을 누르면 말풍선으로.
 * 누르면 열리고, 다시 누르거나 바깥을 누르거나 스크롤하면 닫힌다 (휴대폰에서도 동작하도록 hover 대신 탭).
 * 말풍선은 화면 기준으로 놓아서 좁은 폰에서도 화면 밖으로 잘리지 않는다.
 */
const W = 280
const GAP = 16

export function InfoTip({ children, label = "설명 보기", className = "" }: { children: React.ReactNode; label?: string; align?: "left" | "right"; className?: string }) {
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!pos) return
    const close = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPos(null)
    }
    const shut = () => setPos(null)
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPos(null)
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", esc)
    window.addEventListener("scroll", shut, { passive: true })
    window.addEventListener("resize", shut)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", esc)
      window.removeEventListener("scroll", shut)
      window.removeEventListener("resize", shut)
    }
  }, [pos])

  const toggle = () => {
    if (pos) return setPos(null)
    const r = btn.current!.getBoundingClientRect()
    const vw = window.innerWidth
    const width = Math.min(W, vw - GAP * 2)
    const left = Math.min(Math.max(GAP, r.left + r.width / 2 - 24), vw - width - GAP)
    setPos({ left, top: r.bottom + 6, width })
  }

  return (
    <span ref={ref} className={`relative inline-flex align-middle ${className}`}>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={!!pos}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          toggle()
        }}
        className="-m-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
      >
        <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
          <circle cx="10" cy="10" r="8" />
          <path d="M10 9v5M10 6.2v.1" strokeLinecap="round" />
        </svg>
      </button>
      {pos && (
        <span
          id={id}
          role="tooltip"
          style={{ left: pos.left, top: pos.top, width: pos.width }}
          className="fixed z-[80] rounded-[10px] bg-[#14213D] px-3 py-2.5 text-left text-[12px] font-normal leading-relaxed text-white shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  )
}

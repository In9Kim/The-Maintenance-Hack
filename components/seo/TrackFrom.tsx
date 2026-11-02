"use client"

import { useEffect } from "react"
import { captureVisitFrom, track } from "@/lib/track"

/**
 * 블로그 등에서 ?from=꼬리표 를 달고 들어온 방문을 기록 (구글시트 events 탭, type=landing).
 * 같은 방문에서 같은 꼬리표는 한 번만 기록한다.
 */
export function TrackFrom() {
  useEffect(() => {
    const from = captureVisitFrom()
    if (from) track({ type: "landing", meta: { from } })
  }, [])
  return null
}

"use client"

import { useEffect } from "react"

/** 안드로이드 앱·홈 화면 추가용 서비스 워커 등록 (public/sw.js: 오프라인 안내만, 캐시 없음) */
export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || location.hostname === "localhost") return
    navigator.serviceWorker.register("/sw.js").catch(() => {})
  }, [])
  return null
}

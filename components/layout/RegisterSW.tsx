"use client"

import { useEffect } from "react"
import { loadGarage } from "@/lib/my-car"
import { syncPush } from "@/lib/push-client"

/** 안드로이드 앱·홈 화면 추가용 서비스 워커 등록 (public/sw.js: 오프라인 안내만, 캐시 없음) */
export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || location.hostname === "localhost") return
    navigator.serviceWorker.register("/sw.js").catch(() => {})
    // 차·교체 기록이 바뀌면(어느 화면이든 saveGarage) 알림 일정도 다시 맡김 (알림 켠 기기만)
    const onChange = () => syncPush(loadGarage())
    window.addEventListener("mh-my-car", onChange)
    return () => window.removeEventListener("mh-my-car", onChange)
  }, [])
  return null
}

"use client"
/**
 * 교체 시기 알림 (화면 쪽). 로그인한 사람만 켤 수 있다.
 * 아이폰은 Safari에서 '홈 화면에 추가'한 정비핵 앱에서만 웹 알림을 받을 수 있다 (iOS 16.4+).
 */
import { loadGarage, today, type Garage } from "@/lib/my-car"
import { pushSchedule } from "@/lib/push-schedule"
import { supabase } from "@/lib/supabase"

/** 공개 키 (비밀 키는 워커 비밀값 VAPID_PRIVATE_KEY) */
export const VAPID_PUBLIC = "BFXH3sogzustt6UlZhLu1b4yvhzkg5AEjJwJejcmLYlEiIhppRUrfasbS1MgqCxwz_iB_ErEjPOLNXGQDWOaoi0"

export type PushState = "on" | "off" | "denied" | "ios-install" | "unsupported"

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true

export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported"
  if (isIOS() && !standalone()) return "ios-install"
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported"
  if (Notification.permission === "denied") return "denied"
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === "granted" ? "on" : "off"
}

async function accessToken(): Promise<string | null> {
  const sb = await supabase()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

const key = () => {
  const b = atob(VAPID_PUBLIC.replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

async function send(sub: PushSubscription, g: Garage, hello = false): Promise<boolean> {
  const token = await accessToken()
  if (!token) return false
  const r = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ subscription: sub.toJSON(), items: pushSchedule(g, today()), hello }),
  })
  return r.ok
}

/** 알림 켜기 (버튼을 눌렀을 때만 권한을 묻는다) */
export async function enablePush(): Promise<PushState> {
  const st = await pushState()
  if (st === "ios-install" || st === "unsupported" || st === "denied") return st
  const perm = await Notification.requestPermission()
  if (perm !== "granted") return perm === "denied" ? "denied" : "off"
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"))
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key() }))
  return (await send(sub, loadGarage(), true)) ? "on" : "off"
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  const token = await accessToken()
  if (token) {
    await fetch("/api/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {})
  }
  await sub.unsubscribe()
}

let timer: ReturnType<typeof setTimeout> | undefined
/** 차·교체 기록이 바뀌면 알림 일정을 다시 맡긴다 (알림을 켠 기기만, 3초 모아서 한 번) */
export function syncPush(g: Garage) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window) || Notification.permission !== "granted") return
  clearTimeout(timer)
  timer = setTimeout(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) await send(sub, g)
    } catch {}
  }, 3000)
}

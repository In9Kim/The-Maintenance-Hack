/**
 * 견적서 분석 하루 제한 (유료 AI라 AI를 부르기 전에 센다). KV(VERIFY_LIMIT)에 날짜별로, 키는 해시로만 저장.
 *  - 로그인 안 한 사람: 기기마다 하루 GUEST번 (정비소 앞에서 바로 쓰게 로그인 없이)
 *    + 같은 IP 하루 PER_IP번 (휴대폰 통신사는 여러 사람이 IP 하나를 같이 써서 넉넉하게, 마구 부르는 것만 막음)
 *  - 로그인한 사람: 계정마다 하루 USER번
 *  - 사이트 전체: 하루 GLOBAL번 (Haiku 기준 1번 1~2원 추정이라 최악이어도 하루 수백 원)
 * 실패하면 기기·계정 횟수만 돌려준다(하루 몇 번까지). IP·전체 횟수는 돌려주지 않아 상한이 깨지지 않음.
 * KV가 없는 로컬에서는 제한 없음.
 */
import { createHash } from "crypto"
import { takeCounters, refundCounters, counterStore, type Counter, type CounterSpec } from "@/lib/verify-limit"

export const QUOTE_GUEST = 1
export const QUOTE_PER_USER = 3
export const QUOTE_PER_IP = 10
export const QUOTE_GLOBAL = 300
/** 비로그인 전체 몫 (사이트 전체 300번 중). 나머지는 로그인 사용자 몫으로 남김 */
export const QUOTE_GUEST_ALL = 200
/** 비로그인 전체를 세는 who */
export const GUEST_ALL = "guest-all"

/** 세는 대상 하나: who("u:계정" / "d:기기" / "ip:주소")와 하루 한도 */
export type QuoteCounter = Counter

export const QUOTE_SPEC: CounterSpec = {
  globalKey: (day) => `qg:${day}`,
  key: (day, who) => `qu:${day}:${createHash("sha256").update(`${day}|${who}`).digest("hex").slice(0, 20)}`,
  globalMax: QUOTE_GLOBAL,
}

/** 모두 한도 안이면 한꺼번에 1번씩 센다. 넘은 게 있으면 그 who를 돌려준다 (아무것도 세지 않음) */
export async function takeQuote(counters: QuoteCounter[]): Promise<"ok" | "global" | { over: string }> {
  return takeCounters(await counterStore(), QUOTE_SPEC, counters)
}

/** 분석이 실패했거나 사진을 못 읽었으면 기기·계정 횟수만 돌려준다. aiCalled=false면 전체 횟수도 */
export async function refundQuote(counters: QuoteCounter[], opts?: { aiCalled?: boolean }): Promise<void> {
  return refundCounters(await counterStore(), QUOTE_SPEC, counters, opts)
}

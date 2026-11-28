/**
 * 하루 횟수 세기용 Durable Object (wrangler.jsonc durable_objects LIMITS, worker.ts에서 내보냄).
 * 한 개만 쓰고(idFromName("limits")), 요청을 하나씩 처리해서 동시에 몰아 보내도 한도를 넘지 않는다.
 * 값은 {v, exp}로 저장하고, 12시간마다 알람으로 지난 값을 지운다.
 * 워커 진입점에서 불러오므로 "@/..." 경로를 쓰지 않음.
 */
import { runOp, type KV, type RefundOp, type TakeOp } from "./counter-core"

interface DOStorage {
  get<T>(key: string): Promise<T | undefined>
  put<T>(key: string, value: T): Promise<void>
  delete(key: string | string[]): Promise<boolean | number>
  list<T>(opts?: { limit?: number; start?: string }): Promise<Map<string, T>>
  getAlarm(): Promise<number | null>
  setAlarm(t: number): Promise<void>
}
interface DOState {
  storage: DOStorage
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>
}

type Entry = { v: string; exp: number }

/** 지난 값 지우는 간격. 값은 36시간 뒤 만료 → 12시간마다 지우면 늦어도 48시간 안에 사라짐 (개인정보 처리방침 '이틀 안에 지워요') */
const SWEEP_MS = 12 * 3600_000

export class LimitCounter {
  constructor(private state: DOState, _env: unknown) {}

  private store(): KV {
    const s = this.state.storage
    return {
      get: async (k) => {
        const e = await s.get<Entry>(k)
        return e && e.exp > Date.now() ? e.v : null
      },
      put: async (k, v, opts) => {
        await s.put<Entry>(k, { v, exp: Date.now() + (opts?.expirationTtl ?? 86400) * 1000 })
      },
    }
  }

  async fetch(req: Request): Promise<Response> {
    const op = (await req.json().catch(() => null)) as TakeOp | RefundOp | null
    if (!op || (op.kind !== "take" && op.kind !== "refund")) return new Response("bad", { status: 400 })
    // 한 번에 하나씩: 읽기와 쓰기 사이에 다른 요청이 끼지 않게
    const out = await this.state.blockConcurrencyWhile(() => runOp(this.store(), op))
    if ((await this.state.storage.getAlarm()) == null) await this.state.storage.setAlarm(Date.now() + SWEEP_MS)
    return Response.json({ result: out })
  }

  /** 12시간마다: 기한 지난 횟수 지우기 */
  async alarm(): Promise<void> {
    const now = Date.now()
    let start: string | undefined
    for (;;) {
      const page = await this.state.storage.list<Entry>({ limit: 500, start })
      const old = [...page.entries()].filter(([, e]) => !e || e.exp <= now).map(([k]) => k)
      for (let i = 0; i < old.length; i += 128) await this.state.storage.delete(old.slice(i, i + 128))
      if (page.size < 500) break
      start = [...page.keys()].pop() + "\0"
    }
    await this.state.storage.setAlarm(now + SWEEP_MS)
  }
}

/**
 * 하루 횟수 세기의 핵심 계산 (다른 파일을 불러오지 않음: 워커의 Durable Object와 node 테스트가 같이 씀).
 * KV는 읽고-쓰기 사이에 다른 요청이 끼어들 수 있어서(동시에 몰아 보내면 한도를 넘음),
 * 운영에서는 이 계산을 Durable Object(lib/limit-counter.ts) 안에서 한 번에 하나씩 돌린다.
 */
export interface KV {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
}

export interface TakeOp {
  kind: "take"
  /** 사이트 전체 키와 상한 */
  gk: string
  globalMax: number
  /** 개인·IP·게스트 전체 키와 한도 */
  items: { key: string; limit: number }[]
  ttl: number
}

export interface RefundOp {
  kind: "refund"
  /** 돌려줄 개인 키들 (기기·계정) */
  personal: string[]
  refundMax: number
  /** AI를 아예 안 불렀을 때만: 전체 키도 1 돌려줌 */
  globalKey?: string
  ttl: number
}

export type TakeResult = "ok" | "global" | { index: number }

/** 모두 한도 안이면 한꺼번에 1씩 센다. 넘은 게 있으면 아무것도 세지 않음 */
export async function takeKeys(store: KV, op: TakeOp): Promise<TakeResult> {
  const [g, ...vals] = await Promise.all([store.get(op.gk), ...op.items.map((i) => store.get(i.key))])
  if (Number(g ?? 0) >= op.globalMax) return "global"
  const over = op.items.findIndex((it, i) => Number(vals[i] ?? 0) >= it.limit)
  if (over >= 0) return { index: over }
  await Promise.all([
    store.put(op.gk, String(Number(g ?? 0) + 1), { expirationTtl: op.ttl }),
    ...op.items.map((it, i) => store.put(it.key, String(Number(vals[i] ?? 0) + 1), { expirationTtl: op.ttl })),
  ])
  return "ok"
}

/** 실패한 1번을 돌려준다: 개인 키만, 하루 refundMax번까지 */
export async function refundKeys(store: KV, op: RefundOp): Promise<void> {
  const minus = async (k: string) => {
    const v = Number((await store.get(k)) ?? 0)
    if (v > 0) await store.put(k, String(v - 1), { expirationTtl: op.ttl })
  }
  const jobs: Promise<void>[] = op.personal.map(async (k) => {
    const rk = `${k}:r`
    const refunded = Number((await store.get(rk)) ?? 0)
    if (refunded >= op.refundMax) return
    await Promise.all([store.put(rk, String(refunded + 1), { expirationTtl: op.ttl }), minus(k)])
  })
  if (op.globalKey) jobs.push(minus(op.globalKey))
  await Promise.all(jobs)
}

/** 한 번에 하나씩 세 주는 저장소 (운영: Durable Object). 없으면 KV로 센다 */
export interface AtomicCounter {
  /** take면 TakeResult, refund면 null */
  run(op: TakeOp | RefundOp): Promise<TakeResult | null>
}

/** Durable Object 안에서 돌릴 때 (take/refund 하나) */
export async function runOp(store: KV, op: TakeOp | RefundOp): Promise<TakeResult | null> {
  if (op.kind === "take") return takeKeys(store, op)
  await refundKeys(store, op)
  return null
}

/**
 * 견적서 분석을 받는 대로 보여 주기: AI가 JSON을 한 글자씩 써 내려가는 동안
 * "items" 배열 안의 항목 객체가 하나 완성될 때마다 꺼낸다 (문자열 안의 괄호·따옴표는 무시).
 */
export class ItemExtractor<T = unknown> {
  private text = ""
  private pos = 0 // 여기까지 읽음
  private inItems = false
  private depth = 0
  private inStr = false
  private esc = false
  private start = -1
  private done = false

  /** 새로 받은 글자를 넣고, 이번에 완성된 항목들을 돌려준다 */
  push(chunk: string): T[] {
    this.text += chunk
    const out: T[] = []
    if (this.done) return out
    if (!this.inItems) {
      const m = /"items"\s*:\s*\[/.exec(this.text)
      if (!m) return out
      this.inItems = true
      this.pos = m.index + m[0].length
    }
    for (; this.pos < this.text.length; this.pos++) {
      const c = this.text[this.pos]
      if (this.inStr) {
        if (this.esc) this.esc = false
        else if (c === "\\") this.esc = true
        else if (c === '"') this.inStr = false
        continue
      }
      if (c === '"') this.inStr = true
      else if (c === "{") {
        if (this.depth === 0) this.start = this.pos
        this.depth++
      } else if (c === "}") {
        this.depth--
        if (this.depth === 0 && this.start >= 0) {
          try {
            out.push(JSON.parse(this.text.slice(this.start, this.pos + 1)) as T)
          } catch {
            /* 형식이 깨진 항목은 건너뜀 (마지막 전체 결과로 다시 맞춤) */
          }
          this.start = -1
        }
      } else if (c === "]" && this.depth === 0) {
        this.done = true
        this.pos++
        break
      }
    }
    return out
  }

  /** 지금까지 받은 전체 글자 */
  get full() {
    return this.text
  }
}

/** Anthropic 스트리밍(SSE) 한 덩어리에서 글자만 꺼낸다. 끝(stop_reason)도 같이 */
export function parseSse(buf: string): { texts: string[]; stop?: string; rest: string } {
  const texts: string[] = []
  let stop: string | undefined
  const lines = buf.split("\n")
  const rest = lines.pop() ?? ""
  for (const line of lines) {
    if (!line.startsWith("data:")) continue
    const raw = line.slice(5).trim()
    if (!raw || raw === "[DONE]") continue
    try {
      const ev = JSON.parse(raw) as { type: string; delta?: { type?: string; text?: string; stop_reason?: string } }
      if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) texts.push(ev.delta.text)
      if (ev.type === "message_delta" && ev.delta?.stop_reason) stop = ev.delta.stop_reason
      if (ev.type === "error") stop = "error"
    } catch {
      /* 줄이 덜 왔으면 다음 덩어리에서 */
    }
  }
  return { texts, stop, rest }
}

import Link from "next/link"
import { AlertTriangle, ExternalLink } from "lucide-react"
import { OutboundLink } from "@/components/seo/OutboundLink"
import type { Recall } from "@/lib/recalls/types"
import {
  RECALL_CENTER_LIST_URL,
  RECALL_CENTER_LOOKUP_URL,
  RECALL_DATASET_URL,
  fmtDate,
  recallData,
} from "@/lib/recalls/data"

/** 모든 리콜 페이지 상단: 데이터 기준일 + 차대번호 조회 안내 */
export function RecallNotice({ carId }: { carId?: string }) {
  const { dataAsOf } = recallData()
  return (
    <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="space-y-2">
          <p className="font-semibold">실제 대상 여부는 자동차리콜센터에서 차대번호로 확인하세요.</p>
          <p className="text-muted-foreground">
            같은 차종이라도 생산 시기·사양에 따라 리콜 대상이 아닐 수 있습니다. 이 페이지는 공개 데이터를 정리한
            참고 자료입니다.
          </p>
          <p className="text-xs text-muted-foreground">
            데이터 기준일: <strong className="text-foreground">{dataAsOf ? fmtDate(dataAsOf) : "준비 중"}</strong>{" "}
            (원본은 연 1회 공개되어 최근 리콜이 아직 반영되지 않았을 수 있습니다)
          </p>
          <OutboundLink
            href={RECALL_CENTER_LOOKUP_URL}
            target="recall_center"
            carId={carId}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            자동차리콜센터에서 내 차 조회 <ExternalLink className="h-3.5 w-3.5" />
          </OutboundLink>
        </div>
      </div>
    </div>
  )
}

/** 페이지 하단 출처 */
export function RecallSource() {
  const { dataAsOf } = recallData()
  return (
    <p className="mt-10 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      출처:{" "}
      <a href={RECALL_CENTER_LIST_URL} target="_blank" rel="noopener" className="underline hover:text-foreground">
        자동차리콜센터(car.go.kr) 리콜현황
      </a>{" "}
      ·{" "}
      <a href={RECALL_DATASET_URL} target="_blank" rel="noopener" className="underline hover:text-foreground">
        공공데이터포털 한국교통안전공단_자동차결함 리콜현황
      </a>
      {dataAsOf ? ` (기준일 ${fmtDate(dataAsOf)})` : ""}. 리콜 상세 내용과 시정 방법은 자동차리콜센터 원문을
      확인하세요. 정비핵은 데이터 오류나 누락에 대해 책임지지 않습니다.
    </p>
  )
}

export function RecallEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

/** 리콜 목록 */
export function RecallList({ recalls, showMaker = true }: { recalls: Recall[]; showMaker?: boolean }) {
  return (
    <ul className="space-y-3">
      {recalls.map((r) => (
        <li key={r.id} id={r.id} className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              리콜 시작일 <strong className="text-foreground">{fmtDate(r.startDate)}</strong>
            </span>
            {showMaker && (
              <Link href={`/recalls/maker/${r.makerSlug}`} className="text-primary hover:underline">
                {r.makerName}
              </Link>
            )}
          </div>

          <div className="mb-2 text-sm font-semibold leading-snug">
            {[...new Set(r.items.map((i) => i.name))].slice(0, 6).join(", ")}
            {new Set(r.items.map((i) => i.name)).size > 6 && ` 외 ${new Set(r.items.map((i) => i.name)).size - 6}개 차명`}
          </div>

          <dl className="space-y-1.5 text-sm">
            <div>
              <dt className="inline text-muted-foreground">리콜 사유 · </dt>
              <dd className="inline leading-relaxed">{r.reason}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">시정 방법 · </dt>
              <dd className="inline">
                {r.fix ?? (
                  <>
                    <a href={RECALL_CENTER_LIST_URL} target="_blank" rel="noopener" className="text-primary hover:underline">
                      자동차리콜센터 원문
                    </a>
                    에서 확인 (공개 데이터에는 시정 방법 항목이 없습니다)
                  </>
                )}
              </dd>
            </div>
          </dl>

          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none hover:text-foreground">
              대상 생산기간 보기 ({r.items.length})
            </summary>
            <ul className="mt-2 space-y-0.5">
              {r.items.map((it, i) => (
                <li key={i}>
                  {it.name} · {fmtDate(it.from)} ~ {fmtDate(it.to)} 생산분
                </li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  )
}

/** 리콜 FAQ (화면 + JSON-LD 공용) */
export function recallFaq(carName?: string): { q: string; a: string }[] {
  const { dataAsOf } = recallData()
  const target = carName ?? "내 차"
  return [
    {
      q: `${target} 리콜 대상인지 어떻게 확인하나요?`,
      a: "자동차리콜센터(car.go.kr) 첫 화면에서 차대번호 또는 자동차 등록번호를 입력하면 리콜 대상 여부와 시정 조치 여부를 바로 확인할 수 있습니다. 같은 차종이라도 생산 시기에 따라 대상이 다릅니다.",
    },
    {
      q: "리콜 수리 비용을 내야 하나요?",
      a: "제작결함 시정(리콜)은 제작사가 비용을 부담합니다. 리콜 대상이면 제작사 서비스센터에 예약 후 무상으로 점검·수리를 받을 수 있습니다.",
    },
    {
      q: "리콜 전에 같은 문제로 내 돈을 내고 고쳤다면요?",
      a: "리콜 시작 전에 자비로 수리한 경우 제작사에 수리비 보상을 신청할 수 있습니다. 신청 기간과 필요 서류는 해당 리콜 공지와 자동차리콜센터 안내를 확인하세요.",
    },
    {
      q: "이 페이지의 리콜 정보는 언제 기준인가요?",
      a: `한국교통안전공단이 공공데이터포털에 공개한 '자동차결함 리콜현황' 자료를 정리했습니다. 데이터 기준일은 ${
        dataAsOf ? fmtDate(dataAsOf) : "준비 중"
      }이며, 원본이 연 1회 공개되어 최근 리콜은 빠져 있을 수 있습니다. 최신 정보는 자동차리콜센터에서 확인하세요.`,
    },
  ]
}

export function RecallFaq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-bold">자주 묻는 질문</h2>
      <div className="space-y-2">
        {items.map((f) => (
          <details key={f.q} className="rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer select-none text-sm font-semibold">{f.q}</summary>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }
}

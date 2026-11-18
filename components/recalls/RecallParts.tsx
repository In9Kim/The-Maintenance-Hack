import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { OutboundLink } from "@/components/seo/OutboundLink"
import type { Recall } from "@/lib/recalls/types"
import {
  RECALL_CENTER_LIST_URL,
  RECALL_CENTER_LOOKUP_URL,
  RECALL_DATASET_URL,
  dataBasisText,
  fmtDate,
  latestNewsDate,
  recallData,
} from "@/lib/recalls/data"
import type { RecallNewsItem } from "@/lib/recalls/types"
import { recallBlogPost } from "@/lib/recalls/blog"
import { partLabel, recallCars, type RecallGroup } from "@/lib/recalls/highlight"

const H2 = "text-[20px] font-bold sm:text-[24px]"
const SUMMARY = "flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-[14px] font-semibold text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden"

/** 모든 리콜 페이지 상단: 차대번호 조회 안내 + 데이터 기준일 */
export function RecallNotice({ carId }: { carId?: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-[#F9DBAF] bg-[#FFF6ED] p-4 sm:p-5">
      <p className="text-[16px] font-bold leading-snug text-[#7A2E0E]">
        내 차가 대상인지는 차대번호로 확인해야 정확해요
      </p>
      <p className="mt-1 text-[14px] leading-relaxed text-[#93370D]">
        같은 차종도 생산 시기·사양에 따라 대상이 아닐 수 있어요. 조회는 무료이고 1분이면 끝나요.
      </p>
      <OutboundLink
        href={RECALL_CENTER_LOOKUP_URL}
        target="recall_center"
        carId={carId}
        className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#B54708] text-[15px] font-bold text-white transition hover:brightness-110 active:translate-y-px sm:w-auto sm:px-6 sm:inline-flex"
      >
        자동차리콜센터에서 내 차 조회 <ExternalLink className="h-4 w-4" aria-hidden />
      </OutboundLink>
      <p className="mt-2 text-[12px] text-[#93370D]">{dataBasisText()}</p>
    </div>
  )
}

/** 페이지 하단 출처 */
export function RecallSource() {
  return (
    <p className="mt-12 border-t border-border pt-4 text-[12px] leading-relaxed text-muted-foreground">
      출처:{" "}
      <a href={RECALL_CENTER_LIST_URL} target="_blank" rel="noopener" className="underline hover:text-foreground">
        자동차리콜센터(car.go.kr) 리콜현황
      </a>
      (게시판 원문을 그대로 정리){" "}
      ·{" "}
      <a href={RECALL_DATASET_URL} target="_blank" rel="noopener" className="underline hover:text-foreground">
        공공데이터포털 한국교통안전공단_자동차결함 리콜현황
      </a>{" "}
      ·{" "}
      <a href="https://www.molit.go.kr/USR/NEWS/m_71/lst.jsp" target="_blank" rel="noopener" className="underline hover:text-foreground">
        국토교통부 리콜 보도자료
      </a>
      (표 내용은 AI로 정리 후 원문과 대조) — {dataBasisText()}. 리콜 상세 내용과 시정 방법은 자동차리콜센터 원문을 확인하세요. 정비핵은
      데이터 오류나 누락에 대해 책임지지 않습니다.
    </p>
  )
}

export function RecallEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-border bg-card p-6 text-center text-[15px] leading-relaxed text-muted-foreground">
      {children}
    </div>
  )
}

const SeriousBadge = () => (
  <span className="shrink-0 rounded-full bg-[#FEF3F2] px-2 py-0.5 text-[12px] font-semibold text-[#B42318]">중대</span>
)

function carNames(r: Recall, max = 6) {
  const names = [...new Set(r.items.map((i) => i.name))]
  return names.slice(0, max).join(", ") + (names.length > max ? ` 외 ${names.length - max}개 차명` : "")
}

/** 리콜 목록 (차종·제작사 페이지) */
export function RecallList({ recalls, showMaker = true }: { recalls: Recall[]; showMaker?: boolean }) {
  return (
    <ul className="space-y-3">
      {recalls.map((r) => {
        const post = recallBlogPost(r.id)
        return (
          <li key={r.id} id={r.id} className="scroll-mt-20 rounded-[14px] border border-border bg-card p-4 sm:p-5">
            <div className="num flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
              <span>
                <strong className="font-semibold text-foreground">{fmtDate(r.startDate)}</strong> 시작
              </span>
              {r.count ? <span>· 대상 {r.count.toLocaleString("ko-KR")}대</span> : null}
              {showMaker && (
                <>
                  <span aria-hidden>·</span>
                  <Link href={`/recalls/maker/${r.makerSlug}`} className="font-semibold text-foreground underline-offset-2 hover:underline">
                    {r.makerName}
                  </Link>
                </>
              )}
              {r.serious && <SeriousBadge />}
            </div>

            <h3 className="mt-1.5 text-[16px] font-bold leading-snug">{carNames(r)}</h3>

            <dl className="mt-2 space-y-1 text-[15px] leading-relaxed">
              {r.part && (
                <div className="flex gap-2">
                  <dt className="w-[68px] shrink-0 text-muted-foreground">결함 장치</dt>
                  <dd>{r.part}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="w-[68px] shrink-0 text-muted-foreground">리콜 사유</dt>
                <dd>{r.reason}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-[68px] shrink-0 text-muted-foreground">시정 방법</dt>
                <dd>
                  {r.fix ?? (
                    <>
                      <a href={RECALL_CENTER_LIST_URL} target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">
                        자동차리콜센터 원문
                      </a>
                      에서 확인
                    </>
                  )}
                </dd>
              </div>
            </dl>

            {post && (
              <OutboundLink
                href={post.url}
                target="blog"
                className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-border px-3 text-[13px] font-semibold hover:bg-muted"
              >
                {post.label} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </OutboundLink>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 border-t border-border pt-1">
              <details className="group min-w-0 flex-1">
                <summary className={SUMMARY}>
                  대상 생산기간 {r.items.length}건 보기
                  <span aria-hidden className="transition group-open:rotate-180">⌄</span>
                </summary>
                <ul className="num space-y-1 pb-2 text-[13px] text-muted-foreground">
                  {r.items.map((it, i) => (
                    <li key={i}>
                      {it.name} · {fmtDate(it.from)} ~ {fmtDate(it.to)} 생산분
                    </li>
                  ))}
                </ul>
              </details>
              {r.source === "molit" && r.sourceUrl ? (
                <a href={r.sourceUrl} target="_blank" rel="noopener" className="text-[12px] text-muted-foreground hover:text-foreground">
                  국토부 보도자료 ↗
                </a>
              ) : r.source === "carkr" ? (
                <a href={RECALL_CENTER_LIST_URL} target="_blank" rel="noopener" className="text-[12px] text-muted-foreground hover:text-foreground">
                  자동차리콜센터 ↗
                </a>
              ) : null}
            </div>
          </li>
        )
      })}
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
      a: `한국교통안전공단이 공공데이터포털에 공개한 '자동차결함 리콜현황'(기준일 ${
        dataAsOf ? fmtDate(dataAsOf) : "준비 중"
      }), 자동차리콜센터 리콜현황 게시판${
        latestNewsDate() ? `(${fmtDate(latestNewsDate())} 시작 리콜까지)` : ""
      }, 국토교통부 리콜 보도자료를 매일 확인해 정리합니다. 가장 정확한 최신 정보는 자동차리콜센터에서 확인하세요.`,
    },
  ]
}

export function RecallFaq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section className="mt-12">
      <h2 className={H2}>자주 묻는 질문</h2>
      <div className="mt-4 divide-y divide-border rounded-[14px] border border-border bg-card">
        {items.map((f) => (
          <details key={f.q} className="group px-4">
            <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 py-3 font-semibold [&::-webkit-details-marker]:hidden">
              <h3 className="text-[15px]">{f.q}</h3>
              <span aria-hidden className="text-muted-foreground transition group-open:rotate-180">⌄</span>
            </summary>
            <p className="pb-4 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
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

/**
 * 주요 리콜 요약 목록 (/recalls). 같은 날 같은 제작사 리콜은 한 줄로 묶고,
 * 한 줄에는 날짜·제작사·차명·결함 장치·대수만. 누르면 사유·블로그 글·자세히 보기 링크가 펼쳐진다.
 */
export function MajorRecallList({ groups }: { groups: RecallGroup[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-card">
      {groups.map((g) => {
        const top = g.recalls[0]
        const more = g.recalls.length - 1
        return (
          <li key={g.key}>
            <details className="group">
              <summary className="flex min-h-[64px] cursor-pointer list-none items-start gap-3 px-4 py-3 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                <span className="num w-11 shrink-0 pt-0.5 text-[13px] text-muted-foreground">{fmtDate(g.startDate).slice(5)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">
                      {recallCars(top).startsWith(g.makerName.split(/[·(\s]/)[0]) ? "" : `${g.makerName} `}
                      {recallCars(top)}
                    </span>
                    {g.serious && <SeriousBadge />}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                    {[partLabel(top.part), top.reason].filter(Boolean).join(" · ")}
                  </span>
                  {more > 0 && <span className="mt-0.5 block text-[13px] font-semibold text-[#B54708]">같은 날 리콜 {more}건 더</span>}
                </span>
                <span className="num shrink-0 pt-0.5 text-right text-[13px] text-muted-foreground">
                  {g.count ? `${g.count.toLocaleString("ko-KR")}대` : ""}
                  <span aria-hidden className="ml-1 inline-block transition-transform group-open:rotate-180">⌄</span>
                </span>
              </summary>

              <div className="space-y-4 border-t border-border bg-background px-4 py-4 text-[15px]">
                {g.recalls.map((r) => {
                  const post = recallBlogPost(r.id)
                  return (
                    <div key={r.id}>
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {[...new Set(r.items.map((i) => i.name))].join(", ")}
                        {r.serious && <SeriousBadge />}
                      </p>
                      <p className="num mt-0.5 text-[13px] text-muted-foreground">
                        {[partLabel(r.part), r.count ? `대상 ${r.count.toLocaleString("ko-KR")}대` : ""].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-1.5 leading-relaxed">{r.reason}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {post && (
                          <OutboundLink
                            href={post.url}
                            target="blog"
                            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 text-[13px] font-semibold hover:bg-muted"
                          >
                            {post.label} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          </OutboundLink>
                        )}
                        <Link
                          href={`/recalls/maker/${r.makerSlug}#${r.id}`}
                          className="inline-flex min-h-[40px] items-center rounded-[10px] border border-border bg-card px-3 text-[13px] font-semibold hover:bg-muted"
                        >
                          생산기간·시정 방법 보기
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </details>
          </li>
        )
      })}
    </ul>
  )
}

/** 최근 국토교통부 리콜 보도자료 목록 */
export function RecallNewsList({ items }: { items: RecallNewsItem[] }) {
  return (
    <ul className="divide-y divide-border rounded-[14px] border border-border bg-card">
      {items.map((it) => {
        const cars = [...new Set(it.groups.flatMap((g) => g.cars.map((c) => c.name)))]
        return (
          <li key={it.id} className="px-4 py-3.5">
            <p className="num text-[13px] text-muted-foreground">{fmtDate(it.date)} · 국토교통부</p>
            <a href={it.url} target="_blank" rel="noopener" className="mt-0.5 block text-[15px] font-semibold leading-snug hover:underline">
              {it.title} ↗
            </a>
            {cars.length > 0 && (
              <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">
                대상 차명: {cars.slice(0, 10).join(", ")}
                {cars.length > 10 && ` 외 ${cars.length - 10}개`}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * 교체 시기 알림 일정 만들기 (화면에서 계산해 서버에 맡김 → 서버는 날짜가 된 것만 보냄).
 * 알림 날짜 = 부품이 '곧'(주기의 80%)이 되는 날. 이미 지났으면 오늘.
 *  - 개월 주기: 마지막 교체일 + 주기 × 0.8
 *  - km 주기: 그동안 달린 속도로 그날을 추정. 속도를 알 수 없으면 한 달 1,000km로 가정 (평균값 아님, 보수적 가정)
 * key에 마지막 교체일을 넣어서, 새로 갈았다고 기록하면 다음 주기에 다시 알린다.
 */
import type { ChangeRecord, Garage, MyCar } from "./my-car"

/** km:0은 예전 기록의 '모름' 값 (lib/my-car.ts hasKm과 같은 기준. 테스트가 확장자 없이 불러오지 못해 따로 둠) */
const hasKm = (r: ChangeRecord) => typeof r.km === "number" && r.km > 0

export interface PushItem {
  key: string
  /** 부품 이름 */
  name: string
  /** 차 이름 */
  car: string
  /** 알릴 날 YYYY-MM-DD (한국 시간) */
  date: string
}

const DAY = 86_400_000
const SOON = 0.8
const DEFAULT_KM_PER_DAY = 1000 / 30.44

const addDays = (d: string, n: number) => new Date(Date.parse(d) + Math.round(n) * DAY).toISOString().slice(0, 10)

function itemsFor(my: MyCar, today: string): PushItem[] {
  const out: PushItem[] = []
  for (const part of my.car.parts) {
    const r = my.records?.[part.slug]
    if (!r) continue
    const dates: string[] = []
    if (part.intervalMonths) dates.push(addDays(r.date, part.intervalMonths * 30.44 * SOON))
    if (part.intervalKm && hasKm(r) && my.km > 0) {
      const days = (Date.parse(my.kmDate) - Date.parse(r.date)) / DAY
      const driven = my.km - (r.km as number)
      const perDay = days >= 14 && driven > 0 ? driven / days : DEFAULT_KM_PER_DAY
      const left = part.intervalKm * SOON - Math.max(0, driven)
      dates.push(addDays(my.kmDate, left / perDay))
    }
    if (!dates.length) continue
    const date = dates.sort()[0] < today ? today : dates.sort()[0]
    out.push({ key: `${my.id}:${part.slug}:${r.date}`.slice(0, 120), name: part.name.slice(0, 40), car: my.car.name.slice(0, 40), date })
  }
  return out
}

export function pushSchedule(g: Garage, today: string): PushItem[] {
  return g.cars.flatMap((c) => itemsFor(c, today)).slice(0, 200)
}

/** 오늘 보낼 알림 한 통 (여러 개면 하나로 묶음). 보낼 게 없으면 null */
export function pushMessage(items: PushItem[], sent: Record<string, string>, today: string): { title: string; body: string; keys: string[] } | null {
  const due = items.filter((i) => i.date <= today && !sent[i.key])
  if (!due.length) return null
  const first = due[0]
  const title = due.length > 1 ? `${first.name} 외 ${due.length - 1}개, 교체할 때가 다가와요` : `${first.name}, 교체할 때가 다가와요`
  const cars = Array.from(new Set(due.map((d) => d.car)))
  return { title, body: `${cars.join(", ")} · 눌러서 부품값 보기`, keys: due.map((d) => d.key) }
}

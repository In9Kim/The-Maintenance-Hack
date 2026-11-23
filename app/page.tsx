import Link from "next/link";
import { CompatibilityChecker } from "@/components/CompatibilityChecker";
import { CarPicker, type PickerCar } from "@/components/home/CarPicker";
import { ReceiptCard } from "@/components/home/ReceiptCard";
import {
  carShortName,
  pageMetadata,
  partCost,
  priceBasis,
  seoCars,
  carTotals,
} from "@/lib/seo";
import { majorRecalls, fmtDate } from "@/lib/recalls/data";
import { recallCars, splitCritical } from "@/lib/recalls/highlight";
import type { CarModel } from "@/types";
import { NEAR_KINDS } from "@/lib/near";
import { CarThumb, PhotoCredits } from "@/components/cars/CarPhoto";
import { carPhoto } from "@/lib/car-photos";

export const metadata = pageMetadata({
  title: "엔진오일 교환비용·공임나라 공임비 계산, 차종별 소모품 가격 | 정비핵",
  description:
    "차종을 고르면 엔진오일·와이퍼·배터리·에어컨필터·브레이크패드 규격과 교환 주기, 공식센터 가격과 부품 직접 구매+공임나라 공임 가격을 나란히 보여 줍니다. 근처 공임나라·블루핸즈·오토큐·세차장 지도도 함께.",
  path: "/",
});

/** 많이 타는 차 먼저 (홈 차종 바로가기 순서) */
const POPULAR = [
  "kia-sorento-mq4",
  "hyundai-grandeur-gn7",
  "kia-carnival-ka4",
  "hyundai-avante-cn7",
  "kia-sportage-nq5",
  "hyundai-santafe-mx5",
  "hyundai-tucson-nx4",
  "kia-k5-dl3",
];

const NEAR_SUB: Record<string, string> = {
  gongim: "부품 들고 가서 교체",
  carcenter: "동네 정비소·타이어",
  bluehands: "현대·제네시스 공식",
  autoq: "기아 공식",
  carwash: "셀프·손세차·노터치",
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export default function Home() {
  const cars = seoCars();
  const pickerCars: PickerCar[] = cars.map((c) => ({
    id: c.id,
    brand: c.brand,
    label: `${c.model} ${c.generation.replace(/\s*\(.*?\)\s*/g, "")} · ${c.yearRange}`,
  }));
  const popular = POPULAR.map((id) => cars.find((c) => c.id === id)).filter(
    (c): c is CarModel => !!c,
  );

  // 첫 화면 예시 영수증: 실제 데이터 (쏘렌토 MQ4 엔진오일)
  const sorento = cars.find((c) => c.id === "kia-sorento-mq4");
  const oil = sorento?.parts.find((p) => p.category === "oil");
  const oilCost = oil ? partCost(oil) : null;

  const groups = splitCritical(majorRecalls(30).groups).critical.slice(0, 3);

  return (
    <div>
      {/* ── 첫 화면: 내 차 선택 ───────────────────────────────── */}
      <section className="mx-auto grid max-w-5xl gap-8 px-5 pb-12 pt-8 sm:pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14">
        <div>
          <h1 className="text-[28px] font-extrabold leading-[1.3] sm:text-[40px] sm:leading-[1.25]">
            정비소 견적, 부품값과 공임으로 나눠 보세요
          </h1>
          <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
            차종을 고르면 소모품 규격과 공식센터·셀프 정비 비용을 한 장에 정리해
            드려요. 부품은 직접 사고 교체만 맡기면 얼마가 남는지 바로 보입니다.
          </p>
          <div className="mt-6 max-w-xl">
            <CarPicker cars={pickerCars} />
          </div>
          <p className="mt-3 text-[13px] text-muted-foreground">
            국산·수입 {cars.length}개 차종 · 규격은 제조사 취급설명서 기준
          </p>
        </div>
        {sorento && oil && oilCost && (
          <div className="mx-auto w-full max-w-sm lg:mx-0 lg:justify-self-end">
            <ReceiptCard
              title={`${carShortName(sorento)} · 엔진오일 교체 예시`}
              dealer={oilCost.dealer}
              self={oilCost.self}
              basis={priceBasis(sorento)}
            />
            <Link
              href={`/cars/${sorento.id}`}
              className="mt-5 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
            >
              쏘렌토 소모품 전체 비용 보기
            </Link>
          </div>
        )}
      </section>

      {/* ── 많이 찾는 차종 ─────────────────────────────────────── */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-[20px] font-bold sm:text-[24px]">
              많이 찾는 차종
            </h2>
            <Link
              href="/cars"
              className="min-h-[44px] content-center text-[14px] font-semibold text-muted-foreground hover:text-foreground"
            >
              전체 {cars.length}개 차종
            </Link>
          </div>
          <p className="mt-1 text-[14px] text-muted-foreground">
            소모품을 한 번씩 모두 교체할 때, 대표 엔진 기준
          </p>
          <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            {popular.map((car) => {
              const t = carTotals(car);
              const photo = carPhoto(car.id);
              return (
                <li key={car.id}>
                  <Link
                    href={`/cars/${car.id}`}
                    className="group block h-full overflow-hidden rounded-[14px] border border-border bg-background transition hover:-translate-y-0.5 hover:border-primary/40"
                  >
                    {photo && (
                      <CarThumb
                        photo={photo}
                        alt={`${car.model} ${car.generation}`}
                      />
                    )}
                    <div className="p-3.5 sm:p-4">
                      <p className="text-[13px] text-muted-foreground">
                        {car.brand}
                      </p>
                      <p className="mt-0.5 font-bold">
                        {car.model}{" "}
                        <span className="font-semibold text-muted-foreground">
                          {car.generation.replace(/\s*\(.*?\)\s*/g, "")}
                        </span>
                      </p>
                      <dl className="mt-3 space-y-0.5 text-[13px] sm:text-[14px]">
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="text-[12px] text-muted-foreground">
                            공식센터
                          </dt>
                          <dd className="num price-was">{won(t.dealer)}</dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="text-[12px] text-muted-foreground">
                            직접 구매
                          </dt>
                          <dd className="num font-bold text-primary">
                            {won(t.self)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <PhotoCredits
            items={popular.flatMap((c) => {
              const photo = carPhoto(c.id);
              return photo ? [{ name: c.model, photo }] : [];
            })}
          />
        </div>
      </section>

      {/* ── 근처 정비소·세차장 ─────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 pt-12">
        <h2 className="text-[20px] font-bold sm:text-[24px]">
          부품 샀으면, 근처 어디서 바꾸지?
        </h2>
        <p className="mt-1 text-[14px] text-muted-foreground">
          지금 위치에서 가까운 순으로 지도에 띄워 드려요. 전화·길찾기까지 한
          번에.
        </p>
        <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
          {NEAR_KINDS.map((k) => (
            <li key={k.slug}>
              <Link
                href={k.slug === "gongim" ? "/near" : `/near/${k.slug}`}
                className="group flex h-full items-center gap-3 rounded-[14px] border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40"
              >
                <span
                  aria-hidden
                  className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `${k.color}1A` }}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill={k.color}>
                    <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
                  </svg>
                </span>
                <span>
                  <span className="block font-bold">근처 {k.label}</span>
                  <span className="block text-[12px] text-muted-foreground">
                    {NEAR_SUB[k.slug]}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 계산 방법 (실제 순서) ─────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 py-12">
        <h2 className="text-[20px] font-bold sm:text-[24px]">
          정비핵이 비용을 나누는 방법
        </h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            [
              "차종과 엔진 고르기",
              "같은 차라도 엔진마다 오일 규격과 용량이 달라서, 엔진별로 따로 계산해요.",
            ],
            [
              "규격 확인하기",
              "오일 등급·용량, 교체 주기는 제조사 취급설명서에 나온 값만 씁니다.",
            ],
            [
              "부품은 직접, 교체는 공임나라",
              "부품을 온라인으로 사고 공임나라 표준 공임으로 맡긴 금액을 공식센터와 비교해요.",
            ],
          ].map(([t, d], i) => (
            <li
              key={t}
              className="rounded-[14px] border border-border bg-card p-5"
            >
              <span className="num flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-[13px] font-bold text-background">
                {i + 1}
              </span>
              <p className="mt-3 font-bold">{t}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                {d}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 최근 주요 리콜 ─────────────────────────────────────── */}
      {groups.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 pb-12">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-[20px] font-bold sm:text-[24px]">
              꼭 확인할 최근 리콜
            </h2>
            <Link
              href="/recalls"
              className="min-h-[44px] content-center text-[14px] font-semibold text-muted-foreground hover:text-foreground"
            >
              리콜 전체 보기
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border rounded-[14px] border border-border bg-card">
            {groups.map((g) => {
              const r = g.recalls[0];
              return (
                <li key={g.key}>
                  <Link
                    href={`/recalls/maker/${g.makerSlug}#${r.id}`}
                    className="flex items-start gap-3 p-4 hover:bg-muted/60"
                  >
                    <span className="num mt-0.5 shrink-0 text-[13px] text-muted-foreground">
                      {fmtDate(g.startDate).slice(5)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {g.makerName} · {recallCars(r)}
                      </span>
                      <span className="mt-0.5 block truncate text-[14px] text-muted-foreground">
                        {r.reason}
                      </span>
                    </span>
                    {g.count != null && (
                      <span className="num shrink-0 rounded-full bg-[#FFF6ED] px-2.5 py-1 text-[12px] font-semibold text-[#B54708]">
                        {g.count.toLocaleString("ko-KR")}대
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── 부품 호환성 확인 (기존 기능) ───────────────────────── */}
      <section id="compat" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-2xl px-5 py-12">
          <h2 className="text-[20px] font-bold sm:text-[24px]">
            사려는 부품이 내 차에 맞는지 확인
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
            차대번호와 상품 링크를 넣으면 AI가 규격을 대조해 맞을 가능성을 알려
            드려요. 차대번호는 저장하지 않습니다.
          </p>
          <div className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <CompatibilityChecker heroMode />
          </div>
        </div>
      </section>
    </div>
  );
}

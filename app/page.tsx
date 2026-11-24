import Link from "next/link";
import { MyCarCard } from "@/components/home/MyCarCard";
import { RecentList } from "@/components/recent/Recent";
import { CarPicker, type PickerCar } from "@/components/home/CarPicker";
import { ReceiptCard } from "@/components/home/ReceiptCard";
import {
  carShortName,
  pageMetadata,
  partCost,
  priceBasis,
  seoCars,
} from "@/lib/seo";
import { majorRecalls, fmtDate } from "@/lib/recalls/data";
import { recallCars, splitCritical } from "@/lib/recalls/highlight";
import { SalesRanking } from "@/components/home/SalesRanking"
import { monthText, salesRanking } from "@/lib/sales-ranking";

export const metadata = pageMetadata({
  title: "엔진오일 교환비용·공임나라 공임비 계산, 차종별 소모품 가격 | 정비핵",
  description:
    "차종을 고르면 엔진오일·와이퍼·배터리·에어컨필터·브레이크패드 규격과 교환 주기, 공식센터 가격과 부품 직접 구매+공임나라 공임 가격을 나란히 보여 줍니다. 근처 공임나라·블루핸즈·오토큐·세차장 지도도 함께.",
  path: "/",
});




export default function Home() {
  const cars = seoCars();
  const pickerCars: PickerCar[] = cars.map((c) => ({
    id: c.id,
    brand: c.brand,
    label: `${c.model} ${c.generation.replace(/\s*\(.*?\)\s*/g, "")} · ${c.yearRange}`,
  }));

  // 첫 화면 예시 영수증: 실제 데이터 (쏘렌토 MQ4 엔진오일)
  const sorento = cars.find((c) => c.id === "kia-sorento-mq4");
  const oil = sorento?.parts.find((p) => p.category === "oil");
  const oilCost = oil ? partCost(oil) : null;

  const criticalGroups = splitCritical(majorRecalls(30).groups).critical;
  const top = criticalGroups[0];
  const critical = Math.min(criticalGroups.length, 5);

  return (
    <div>
      {/* ── 첫 화면: 내 차 선택 ───────────────────────────────── */}
      <section className="mx-auto grid max-w-5xl gap-8 px-5 pb-12 pt-8 sm:pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14">
        <div className="min-w-0">
          <div className="mb-6 max-w-xl">
            <MyCarCard />
            <RecentList className="mt-4" />
          </div>
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
          <Link
            href="/check"
            className="mt-5 flex max-w-xl items-center justify-between gap-3 rounded-[14px] border border-primary/30 bg-[#ECFDF3] px-4 py-3 transition hover:border-primary"
          >
            <span>
              <b className="block text-[15px]">사려는 부품이 이미 있나요?</b>
              <span className="text-[13px] text-muted-foreground">차대번호로 내 차에 맞는지 30초 만에 확인</span>
            </span>
            <span aria-hidden className="shrink-0 text-[14px] font-bold text-primary">확인하기</span>
          </Link>
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

      {/* ── 이번 달 많이 팔린 차 (판매 순위) ─────────────────────── */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-[20px] font-bold sm:text-[24px]">{monthText(salesRanking().month)} 많이 팔린 차</h2>
            <Link href="/cars" className="min-h-[44px] content-center text-[14px] font-semibold text-muted-foreground hover:text-foreground">
              전체 {cars.length}개 차종
            </Link>
          </div>
          <p className="mt-1 text-[14px] text-muted-foreground">국산차 판매 순위예요. 누르면 그 차의 소모품 규격과 정비 비용을 볼 수 있어요.</p>
          <div className="mt-5">
            <SalesRanking />
          </div>
        </div>
      </section>

      {/* ── 꼭 확인할 리콜: 한 줄 ─────────────────────────────── */}
      {top && (
        <section className="mx-auto max-w-5xl px-5 pt-8">
          <Link
            href="/recalls"
            className="flex items-center gap-3 rounded-[14px] border border-[#FEDF89] bg-[#FFFAEB] px-4 py-3 transition hover:border-[#F79009]"
          >
            <span aria-hidden className="shrink-0 rounded-full bg-[#B54708] px-2 py-0.5 text-[12px] font-bold text-white">리콜</span>
            <span className="min-w-0 flex-1 truncate text-[14px]">
              <b>{top.makerName} {recallCars(top.recalls[0])}</b>
              <span className="text-muted-foreground"> · {fmtDate(top.startDate).slice(5)} 시작</span>
            </span>
            <span className="shrink-0 text-[13px] font-semibold text-[#B54708]">꼭 확인할 리콜 {critical}건</span>
          </Link>
        </section>
      )}
    </div>
  );
}

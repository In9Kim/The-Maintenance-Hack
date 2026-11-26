import Link from "next/link";
import { MyCarCard } from "@/components/home/MyCarCard";
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
      {/* ── 첫 화면: 차종 찾기 ───────────────────────────────── */}
      <section className="mx-auto grid max-w-5xl gap-8 px-5 pb-12 pt-8 sm:pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14">
        <div className="min-w-0">
          <div className="mb-6 max-w-xl">
            <MyCarCard />
          </div>
          <h1 className="text-[28px] font-extrabold leading-[1.3] sm:text-[40px] sm:leading-[1.25]">
            정비소 견적, 부품값과 공임으로 나눠 보세요
          </h1>
          <div className="mt-6 max-w-xl">
            <CarPicker cars={pickerCars} />
          </div>
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

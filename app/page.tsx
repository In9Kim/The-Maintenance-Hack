import Link from "next/link";
import { HomeMyCar } from "@/components/home/HomeMyCar";
import { QuoteEntry } from "@/components/home/QuoteEntry";
import { CarPicker, type PickerCar } from "@/components/home/CarPicker";
import { carShortName, pageMetadata, partSlug, seoCars } from "@/lib/seo";
import { coupangPickFor } from "@/lib/coupang-links";
import { carPhoto } from "@/lib/car-photos";
import { majorRecalls, fmtDate } from "@/lib/recalls/data";
import { recallCars, splitCritical } from "@/lib/recalls/highlight";

export const metadata = pageMetadata({
  title: "엔진오일 교환비용·공임나라 공임비 계산, 차종별 소모품 가격 | 정비핵",
  description:
    "차종을 고르면 엔진오일·와이퍼·배터리·에어컨필터·브레이크패드 규격과 교환 주기, 공식센터 가격과 부품 직접 구매+공임나라 공임 가격을 나란히 보여 줍니다. 근처 공임나라·블루핸즈·오토큐·세차장 지도도 함께.",
  path: "/",
});

/** 등록 안 한 사람에게 보여 줄 예시 차 (실제 데이터) */
const EXAMPLE_CAR = "kia-sorento-mq4";

export default function Home() {
  const cars = seoCars();
  const pickerCars: PickerCar[] = cars.map((c) => ({
    id: c.id,
    brand: c.brand,
    label: `${c.model} ${c.generation.replace(/\s*\(.*?\)\s*/g, "")} · ${c.yearRange}`,
  }));

  const ex = cars.find((c) => c.id === EXAMPLE_CAR);
  const exEngine = ex?.engineTypes[0];
  const exParts = (ex?.parts ?? [])
    .filter((p) => !p.engine || p.engine === exEngine)
    .map((p) => ({ part: p, pick: coupangPickFor(p) }))
    .sort((a, b) => Number(!!b.pick) - Number(!!a.pick))
    .slice(0, 4);
  const exPhoto = ex ? carPhoto(ex.id) : undefined;

  const criticalGroups = splitCritical(majorRecalls(30).groups).critical;
  const top = criticalGroups[0];
  const critical = Math.min(criticalGroups.length, 5);

  return (
    <div>
      {/* ── 등록한 사람: 내 차만 ── */}
      <section className="home-mine mx-auto max-w-xl px-5 pb-6 pt-6 sm:pt-10">
        <HomeMyCar />
        <div className="mt-5"><QuoteEntry compact /></div>
      </section>

      {/* ── 등록 안 한 사람(검색엔진 포함): 예시 차 + 등록 유도 ── */}
      <section className="home-guest mx-auto max-w-xl px-5 pb-6 pt-8 sm:pt-12">
        <h1 className="text-[28px] font-extrabold leading-[1.3] sm:text-[36px]">정비소 견적, 부품값과 공임으로 나눠 보세요</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">공식센터 견적에서 부품을 사 가면 싸지는 항목을 찾아 드려요</p>
        <div className="mt-6"><QuoteEntry /></div>

        <p className="mt-10 text-[16px] font-bold">견적서가 없다면, 내 차 정비비부터 보세요</p>

        {ex && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-3 bg-[#14213D] p-4 text-white">
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] text-white/60">예시</span>
                <span className="block text-[18px] font-extrabold">{carShortName(ex)}</span>
                <span className="block text-[12px] text-white/70">{exEngine}</span>
              </span>
              {exPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={exPhoto.localSmall} alt="" width={160} height={100} className="h-[60px] w-[96px] shrink-0 rounded-md object-cover" />
              )}
            </div>
            <ul className="divide-y divide-border">
              {exParts.map(({ part, pick }) => (
                <li key={part.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <Link href={`/cars/${ex.id}/${partSlug(ex, part)}`} className="min-w-0 truncate text-[15px] font-semibold">
                    {part.name}
                  </Link>
                  <span className="num shrink-0 text-[14px] font-bold text-primary">
                    {pick ? `쿠팡 ${pick.price.toLocaleString("ko-KR")}원` : `예상 ${part.coupangPrice.toLocaleString("ko-KR")}원`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          href="/my"
          className="mt-4 flex h-12 w-full items-center justify-center rounded-[10px] border border-primary bg-card text-[16px] font-bold text-primary transition hover:bg-primary/5 active:translate-y-px"
        >
          내 차 등록하기
        </Link>

        <div className="mt-10">
          <CarPicker cars={pickerCars} label="등록 없이 차종만 둘러보기" />
        </div>
      </section>

      {/* ── 꼭 확인할 리콜: 한 줄 (등록한 사람은 위 빨간 띠로 내 차 리콜만) ── */}
      {top && (
        <section className="home-guest mx-auto max-w-xl px-5 pb-8 pt-4">
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

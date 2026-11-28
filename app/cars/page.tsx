import type { Metadata } from "next";
import Link from "next/link";
import { CarThumb, PhotoCredits } from "@/components/cars/CarPhoto";
import { carPhoto } from "@/lib/car-photos";
import { seoCars, carTotals, pageMetadata } from "@/lib/seo";
import { formatPrice } from "@/lib/utils";
import { Breadcrumbs } from "@/components/seo/Shared";
import { MyCarShortcut } from "@/components/cars/MyCarShortcut";

export const metadata: Metadata = pageMetadata({
  title: "차종별 소모품 교체 비용 · 규격 총정리 | 정비핵",
  description:
    "현대·기아·테슬라 인기 차종의 엔진오일, 필터, 브레이크 패드, 배터리 교체 비용과 규격을 차종별로 정리했습니다. 공식센터 견적과 쿠팡 부품 + 공임나라 비용을 비교해 보세요.",
  path: "/cars",
});

export default function CarsIndexPage() {
  const cars = seoCars();
  const brands = Array.from(new Set(cars.map((c) => c.brand)));

  return (
    <div className="mx-auto max-w-5xl px-5 pb-6 pt-6 sm:pt-10">
      <Breadcrumbs
        items={[{ href: "/", label: "정비핵" }, { label: "차종별 정비 비용" }]}
      />
      <h1 className="text-[28px] font-extrabold leading-[1.3] sm:text-[36px]">
        차종별 소모품 교체 비용
      </h1>
      <p className="mt-2 max-w-2xl text-[16px] leading-relaxed text-muted-foreground">
        내 차를 고르면 소모품 규격과 공식센터 대비 아끼는 돈을 볼 수 있어요.
        금액은 소모품을 한 번씩 모두 교체할 때, 대표 엔진 기준이에요.
      </p>

      {/* 등록한 내 차가 있으면 목록을 뒤지지 않게 맨 위에 바로가기 */}
      <MyCarShortcut ids={cars.map((c) => c.id)} />

      {/* 브랜드 바로가기: 휴대폰에서 긴 목록을 건너뛰기 위해 */}
      <nav aria-label="브랜드 바로가기" className="mt-5 flex flex-wrap gap-2">
        {brands.map((brand) => (
          <a
            key={brand}
            href={`#brand-${brand}`}
            className="inline-flex min-h-[40px] items-center rounded-full border border-border bg-card px-3.5 text-[14px] hover:bg-muted"
          >
            {brand}
          </a>
        ))}
      </nav>

      {brands.map((brand) => (
        <section
          key={brand}
          id={`brand-${brand}`}
          className="mt-10 scroll-mt-20"
        >
          <h2 className="text-[20px] font-bold sm:text-[24px]">{brand}</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            {cars
              .filter((c) => c.brand === brand)
              .map((car) => {
                const t = carTotals(car);
                const photo = carPhoto(car.id);
                return (
                  <li key={car.id}>
                    <Link
                      href={`/cars/${car.id}`}
                      className="group block h-full overflow-hidden rounded-[14px] border border-border bg-card transition hover:-translate-y-0.5 hover:border-primary/40"
                    >
                      {photo && (
                        <CarThumb
                          photo={photo}
                          alt={`${car.model} ${car.generation}`}
                        />
                      )}
                      <div className="p-3.5 sm:p-4">
                        <p className="font-bold leading-snug">
                          {car.model}{" "}
                          <span className="font-semibold text-muted-foreground">
                            {car.generation.replace(/\s*\(.*?\)\s*/g, "")}
                          </span>
                        </p>
                        <p className="num mt-0.5 text-[13px] text-muted-foreground">
                          {car.yearRange}
                        </p>
                        {t.save > 0 && (
                          <p className="num mt-3 text-[13px]">
                            <span className="block text-muted-foreground">
                              아끼는 돈
                            </span>
                            <span className="text-[16px] font-bold text-primary">
                              {formatPrice(t.save)}
                            </span>
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      <PhotoCredits
        items={cars.flatMap((c) => {
          const photo = carPhoto(c.id);
          return photo
            ? [
                {
                  name: `${c.model} ${c.generation.replace(/\s*\(.*?\)\s*/g, "")}`,
                  photo,
                },
              ]
            : [];
        })}
      />
    </div>
  );
}

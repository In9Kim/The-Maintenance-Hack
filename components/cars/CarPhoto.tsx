import type { CarPhoto as Photo } from "@/lib/car-photos"

/** 차종 대표 사진 + 저작자 표기 (CC 라이선스 조건) */
export function CarPhoto({ photo, alt, priority = false, className = "" }: { photo: Photo; alt: string; priority?: boolean; className?: string }) {
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-[18px] border border-border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.local}
          srcSet={`${photo.localSmall} 480w, ${photo.local} 1024w`}
          sizes="(min-width: 1024px) 560px, 100vw"
          width={photo.width}
          height={photo.height}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          className="aspect-[16/9] h-auto w-full object-cover"
        />
      </div>
      <figcaption className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        사진:{" "}
        <a href={photo.page} target="_blank" rel="noopener nofollow" className="underline underline-offset-2 hover:text-foreground">
          {photo.author}
        </a>
        ,{" "}
        {photo.licenseUrl ? (
          <a href={photo.licenseUrl} target="_blank" rel="noopener nofollow license" className="underline underline-offset-2 hover:text-foreground">
            {photo.license}
          </a>
        ) : (
          photo.license
        )}
        , Wikimedia Commons{photo.edited ? ` (정비핵이 ${photo.edited})` : ""}
      </figcaption>
    </figure>
  )
}

/** 목록 카드 위 작은 사진 (저작자 표기는 페이지 아래 PhotoCredits로 모아서) */
export function CarThumb({ photo, alt }: { photo: Photo; alt: string }) {
  return (
    <div className="overflow-hidden bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.localSmall}
        width={480}
        height={Math.round((photo.height * 480) / photo.width)}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="aspect-[16/10] h-auto w-full object-cover transition duration-300 group-hover:scale-[1.03]"
      />
    </div>
  )
}

/** 목록 페이지의 사진 저작자 모음 (CC BY / BY-SA 표기) */
export function PhotoCredits({ items }: { items: { name: string; photo: Photo }[] }) {
  if (!items.length) return null
  return (
    <details className="mt-10 text-[12px] text-muted-foreground">
      <summary className="min-h-[44px] cursor-pointer content-center font-semibold">차량 사진 출처 (Wikimedia Commons, 정비핵이 배경 제거·크기 통일)</summary>
      <ul className="space-y-1 leading-snug">
        {items.map(({ name, photo }) => (
          <li key={photo.page}>
            {name}:{" "}
            <a href={photo.page} target="_blank" rel="noopener nofollow" className="underline underline-offset-2">
              {photo.author}
            </a>
            ,{" "}
            {photo.licenseUrl ? (
              <a href={photo.licenseUrl} target="_blank" rel="noopener nofollow license" className="underline underline-offset-2">
                {photo.license}
              </a>
            ) : (
              photo.license
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}

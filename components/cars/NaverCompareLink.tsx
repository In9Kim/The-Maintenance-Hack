import { OutboundLink } from "@/components/seo/OutboundLink"

/** "네이버쇼핑에서도 보기" — 같은 검색어로 네이버쇼핑을 열어 가격을 직접 비교하게 한다 (수수료 없는 일반 링크) */
export function NaverCompareLink({ url, carId, partId, className = "" }: { url: string; carId: string; partId: string; className?: string }) {
  return (
    <OutboundLink
      href={url}
      target="naver"
      carId={carId}
      partId={partId}
      className={`inline-flex min-h-[36px] items-center gap-1.5 text-[13px] font-semibold text-[#03A94D] underline decoration-[#03A94D]/30 underline-offset-2 hover:decoration-[#03A94D] ${className}`}
    >
      <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#03C75A] text-[10px] font-black text-white">
        N
      </span>
      네이버쇼핑 가격도 보기
    </OutboundLink>
  )
}

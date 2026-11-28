"use client"

/**
 * 부품 사진 <img> + 못 불러왔을 때 대신 보여 줄 것(fallback).
 * 깨진 그림 표시·대체 글이 보이지 않게, 실패하면 fallback(초록 아이콘 또는 아무것도 없음)으로 바꾼다.
 * 서버에서 그린 img가 하이드레이션 전에 이미 실패했을 수도 있어서, 붙은 뒤에 한 번 더 확인한다.
 */
import { useEffect, useRef, useState } from "react"

export function PartPhotoImg({
  src,
  size,
  alt = "",
  className = "",
  fallback = null,
  wrap,
  children,
}: {
  src: string
  size: number
  alt?: string
  /** 사진을 감싸는 상자 class (크기 고정 정사각형) */
  className?: string
  /** 사진을 못 불러왔을 때 대신 그릴 것 */
  fallback?: React.ReactNode
  /** 있으면 사진 상자와 children을 이 class의 div로 감쌈 (실패하면 통째로 숨김) */
  wrap?: string
  /** 사진 상자 아래(또는 위에 겹쳐) 함께 그릴 것. 실패하면 같이 숨김 */
  children?: React.ReactNode
}) {
  const [failed, setFailed] = useState(false)
  const img = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const el = img.current
    if (el && el.complete && el.naturalWidth === 0) setFailed(true)
  }, [src])

  if (failed) return <>{fallback}</>
  const body = (
    <>
      <span className={className} style={{ width: size, height: size }}>
        {/* Cloudflare라 next/image 최적화를 쓰지 않음 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={img}
          src={src}
          width={size}
          height={size}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </span>
      {children}
    </>
  )
  return wrap ? <div className={wrap}>{body}</div> : body
}

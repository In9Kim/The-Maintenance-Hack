import { NextResponse } from "next/server"
import { getSeoCar, seoCars } from "@/lib/seo"
import { diagramFor } from "@/lib/diagram-data"

/** 첫 화면 '내 차' 도면용 데이터. 배포 때 차종마다 미리 만들어 둠 (방문자 요청마다 계산하지 않음) */
export const dynamic = "force-static"
export const dynamicParams = false

export function generateStaticParams() {
  return seoCars().map((c) => ({ carId: c.id }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ carId: string }> }) {
  const car = getSeoCar((await params).carId)
  if (!car) return NextResponse.json({ error: "없는 차종" }, { status: 404 })
  return NextResponse.json(diagramFor(car))
}

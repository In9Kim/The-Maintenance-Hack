import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth"
import type { CarModel } from "@/types"
import fs from "fs"
import path from "path"
import { VehicleTable } from "@/components/admin/VehicleTable"
import { NormalizePanel } from "@/components/admin/NormalizePanel"
import { StatsPanel } from "@/components/admin/StatsPanel"

function readAllVehicles(): CarModel[] {
  const raw = fs.readFileSync(path.join(process.cwd(), "data", "vehicles.json"), "utf-8")
  return (JSON.parse(raw) as { cars: CarModel[] }).cars
}

export default async function AdminDashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  if (!(await verifyAdminToken(token ?? ""))) redirect("/admin/login")

  const cars = readAllVehicles()
  const verified = cars.filter((c) => c.is_verified !== false).length
  const unverified = cars.length - verified

  return (
    <div className="space-y-8">
      {/* 요약 카드 */}
      <div>
        <h1 className="mb-4 text-2xl font-bold">대시보드</h1>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="전체 차종" value={cars.length} color="text-foreground" />
          <SummaryCard label="검증 완료" value={verified} color="text-emerald-400" />
          <SummaryCard label="검증 대기" value={unverified} color="text-amber-400" />
          <SummaryCard
            label="전체 부품 항목"
            value={cars.reduce((s, c) => s + c.parts.length, 0)}
            color="text-primary"
          />
        </div>
      </div>

      {/* 탭 콘텐츠 - 클라이언트 탭 대신 3섹션 수직 배치 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">차량 데이터 관리</h2>
        <VehicleTable initialCars={cars} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">데이터 정제 에이전트</h2>
        <NormalizePanel />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">수익 최적화 통계</h2>
        <StatsPanel cars={cars} />
      </section>

      {/* 로그아웃 */}
      <LogoutButton />
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function LogoutButton() {
  return (
    <div className="flex justify-end border-t border-border pt-4">
      <form
        action={async () => {
          "use server"
          const { cookies: getCookies } = await import("next/headers")
          const { ADMIN_COOKIE: COOKIE } = await import("@/lib/admin-auth")
          const cookieStore = await getCookies()
          cookieStore.delete(COOKIE)
          redirect("/admin/login")
        }}
      >
        <button
          type="submit"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          로그아웃
        </button>
      </form>
    </div>
  )
}

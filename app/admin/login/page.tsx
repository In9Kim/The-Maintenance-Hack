"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Lock } from "lucide-react"

export default function AdminLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const configError = searchParams.get("error") === "config"

  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    configError ? "서버에 ADMIN_PASSWORD가 설정되지 않았습니다. .env.local을 확인하세요." : null
  )

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "로그인에 실패했습니다.")
        return
      }
      router.push("/admin/dashboard")
      router.refresh()
    } catch {
      setError("서버 연결에 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">관리자 로그인</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            .env.local의 ADMIN_PASSWORD를 입력하세요
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
            autoFocus
          />

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading || !password}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "로그인"}
          </Button>
        </form>
      </div>
    </div>
  )
}

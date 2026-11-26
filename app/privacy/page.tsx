import Link from "next/link"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "개인정보 처리방침 | 정비핵",
  description: "정비핵이 로그인 때 받는 정보와 저장하는 차 정보, 보관 기간, 탈퇴 방법을 안내합니다.",
  path: "/privacy",
})

/** 개인정보 보호책임자 연락처 (공개용 이메일). 비어 있으면 '마이 > 회원 탈퇴' 안내만 */
const CONTACT = ""

const ROWS = [
  { k: "받는 정보", v: "카카오·구글 로그인 때: 계정 식별값, 닉네임(이름), 이메일(제공에 동의한 경우)" },
  { k: "저장하는 정보", v: "직접 입력한 차종·연식·엔진·주행거리·소모품 교체 기록. 번호판·차대번호는 저장하지 않아요" },
  { k: "쓰는 곳", v: "로그인 유지, 내 차 목록과 교체 시기를 여러 기기에서 보여 주기" },
  { k: "보관 기간", v: "회원 탈퇴 때 바로 삭제. 로그인하지 않으면 정보는 이 휴대폰(브라우저)에만 있고 서버로 보내지 않아요" },
  { k: "맡기는 곳", v: "Supabase Inc. (계정·데이터 저장, 서버 위치: 서울), Cloudflare Inc. (사이트 운영)" },
  { k: "제3자 제공", v: "하지 않아요" },
]

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 pb-12 pt-6 sm:pt-10">
      <h1 className="text-[24px] font-extrabold">개인정보 처리방침</h1>
      <p className="mt-2 text-[13px] text-muted-foreground">시행일 2026년 11월 26일</p>

      <dl className="mt-6 divide-y divide-border rounded-[14px] border border-border bg-card">
        {ROWS.map((r) => (
          <div key={r.k} className="grid gap-1 px-4 py-3 sm:grid-cols-[8rem_1fr]">
            <dt className="text-[14px] font-semibold">{r.k}</dt>
            <dd className="text-[14px] text-muted-foreground">{r.v}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8 space-y-2 text-[14px] leading-relaxed text-muted-foreground">
        <h2 className="text-[17px] font-bold text-foreground">탈퇴와 삭제</h2>
        <p>
          <Link href="/my" className="font-semibold text-foreground underline underline-offset-2">마이</Link>
          {" > 회원 탈퇴"}를 누르면 계정과 저장한 차·교체 기록이 바로 지워져요. 로그인 없이 쓴 정보는 브라우저 데이터를 지우면 사라져요.
        </p>
        <p>카카오·구글 쪽 연결 해제는 각 서비스의 계정 설정에서 할 수 있어요.</p>
        {CONTACT && <p>문의: {CONTACT}</p>}
      </section>
    </div>
  )
}

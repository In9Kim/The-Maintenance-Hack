import Link from "next/link"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "개인정보 처리방침 | 정비핵",
  description: "정비핵이 로그인 때 받는 정보와 저장하는 차 정보, 보관 기간, 탈퇴 방법을 안내합니다.",
  path: "/privacy",
})

/** 개인정보 보호책임자 연락처 (공개용 이메일). 비어 있으면 '마이 > 회원 탈퇴' 안내만 */
const CONTACT = "wwe9459@naver.com"

const ROWS = [
  { k: "받는 정보", v: "카카오·구글 로그인 때: 계정 식별값, 닉네임(이름), 이메일(제공에 동의한 경우)" },
  { k: "저장하는 정보", v: "로그인한 경우: 직접 입력한 차종·연식·엔진·주행거리·소모품 교체 기록. 번호판·차대번호는 저장하지 않아요" },
  { k: "로그인 안 하면", v: "차·교체 기록은 이 휴대폰(브라우저)에만 있어요. 다만 아래 '이용 통계'와, 직접 누른 기능(견적서 분석·부품 확인·정비소 찾기)에 필요한 내용은 로그인과 상관없이 보내요" },
  { k: "이용 통계", v: "모든 방문자: 본 화면 주소, 들어온 사이트 이름, 고른 차종(직접 적은 차 이름 포함), 누른 링크 종류(쿠팡·공임나라 등). 이름·연락처·IP 주소는 넣지 않고 Google 스프레드시트에 저장해요" },
  { k: "견적서 분석", v: "올린 견적서 사진과 고른 차종을 AI(Anthropic)로 보내 항목을 읽어요. 정비핵은 사진을 저장하지 않아요" },
  { k: "부품 확인", v: "적은 상품 이름이나 링크와 고른 차종을 AI(Anthropic, 안 되면 Google Gemini)로 보내 맞는지 봐요. 링크를 적으면 정비핵 서버가 그 페이지에서 상품명을 읽어요" },
  { k: "규격 만들기", v: "계산기 'AI로 규격 만들기'(로그인한 경우에만): 적은 브랜드·모델·엔진 또는 차대번호를 AI(Anthropic, 안 되면 Google Gemini)로 보내 해석해요. 차대번호는 저장하지 않고, 만든 차종 규격(차종 정보만)은 Google 스프레드시트에 저장해요" },
  { k: "위치 정보", v: "정비소 찾기에서 '내 위치'를 누른 경우에만 휴대폰 위치(좌표)를, 동네 이름으로 찾으면 적은 이름을 카카오 지도 검색으로 보내요. 정비핵 서버로는 보내지 않아요. 다음에 바로 보이도록 마지막 위치(대략 좌표·동네 이름)는 이 폰에만 저장해요" },
  { k: "하루 이용 횟수", v: "견적서 분석·부품 확인 횟수를 계정, 또는 로그인 안 했으면 이 브라우저의 무작위 값과 IP 주소를 알아볼 수 없게 바꿔서 세고 이틀 안에 지워요" },
  { k: "교체 시기 알림", v: "알림을 켠 경우에만: 이 휴대폰의 알림 주소와 알릴 부품 이름·차 이름·날짜를 저장해요. 알림을 끄거나 로그아웃하면 이 휴대폰의 알림 정보를, 탈퇴하면 이 계정의 알림 정보를 모두 지우고, 안 쓰면 1년 뒤 저절로 지워요. 알림은 휴대폰 회사의 알림 서버(구글·애플 등)를 거쳐 가요" },
  { k: "보관 기간", v: "계정·차·교체 기록은 회원 탈퇴 때 바로 삭제. 이용 통계는 개인을 알아볼 수 없는 기록이라 서비스 개선에 쓰는 동안 보관해요" },
  { k: "맡기는 곳", v: "Supabase Inc. (계정·차 정보 저장, 서버 위치: 서울), Cloudflare Inc. (사이트 운영, 이용 횟수·알림 정보 저장), Anthropic PBC (견적서·부품 확인·규격 만들기 AI), Google LLC (위 AI의 대체 Gemini, 이용 통계·차종 규격 저장 Google 스프레드시트), Kakao Corp. (카카오 로그인, 지도·정비소 검색)" },
  { k: "제3자 제공", v: "하지 않아요" },
]

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 pb-12 pt-6 sm:pt-10">
      <h1 className="text-[24px] font-extrabold">개인정보 처리방침</h1>
      <p className="mt-2 text-[13px] text-muted-foreground">시행일 2026년 11월 28일</p>

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

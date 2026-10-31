# 배포 (Cloudflare Workers, 무료 플랜)

## 처음 한 번
1. Cloudflare 가입 → Workers & Pages → Create → **Import a repository** → `The-Maintenance-Hack`
2. 빌드 설정
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx opennextjs-cloudflare deploy`
3. 변수 (Settings → Variables and Secrets)
   - **런타임 (Secret)**: `GEMINI_API_KEY`, `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET`, `ADMIN_PASSWORD`, `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`
   - **빌드 변수 (Build → Variables)**: `NEXT_PUBLIC_SITE_URL`, `GOOGLE_SITE_VERIFICATION`, `NAVER_SITE_VERIFICATION`
     (정적 페이지에 빌드 때 박히는 값이라 바꾸면 다시 배포해야 반영됨)

## 구글시트 (Apps Script)
`gas/Code.gs` 를 Apps Script에 붙여넣고 SHEET_ID / SECRET 입력 → 웹 앱으로 배포.
탭(verify_cache, events, generated_cars)은 자동 생성됨.

## 로컬
- `npm run dev` : 일반 개발 서버
- `npm run preview` : Cloudflare 런타임으로 미리보기 (`.dev.vars.example` 참고)

## 주의
- Cloudflare에서는 파일 쓰기가 안 됨 → 모든 저장은 구글시트로.
- 기본 차종은 `data/vehicles.json` (읽기 전용). 관리자 화면에서 검증한 AI 생성 차종을 기본 차종으로 올리려면 이 파일에 옮겨 담아 배포.
- 무료 플랜 워커 크기 한도 3 MiB(gzip). 현재 약 1.1 MiB.

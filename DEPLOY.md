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

## 리콜 정보 (/recalls)
- 원본: 공공데이터포털 [한국교통안전공단_자동차결함 리콜현황](https://www.data.go.kr/data/3048950/fileData.do) (오픈API 자동변환, 연 1회 갱신)
- `.github/workflows/recalls.yml` 이 매일 06:17(한국시간) `scripts/fetch-recalls.mjs` 실행 → `data/recalls.json`, `data/recalls_new.json` 이 바뀌었을 때만 main에 커밋 → Cloudflare가 자동 재배포
- 필요한 시크릿: GitHub 저장소 **Settings → Secrets and variables → Actions** 에 `RECALL_API_KEY` (공공데이터포털 일반 인증키)
  - 사이트는 빌드된 JSON만 읽으므로 Cloudflare 변수에는 넣지 않아도 됨
  - 로컬에서 돌려보려면 `.env.local` 에 `RECALL_API_KEY=...` 넣고 `npm run recalls:fetch` (`.env*` 는 git에 안 올라감)
- 처음 한 번은 Actions 탭 → **Update recalls → Run workflow** 로 수동 실행
- 차종 매칭 규칙: `lib/recalls/match.ts` (테스트 `npm test`). 새 차종을 `data/vehicles.json` 에 추가하면 여기에도 규칙을 추가해야 리콜이 붙음
- 실시간 API(국토교통부_자동차 리콜정보, 시정 방법·상세 URL 포함)는 자동차리콜센터와 사전 협의 후 사용 가능 → 승인되면 `scripts/fetch-recalls.mjs` 의 데이터 가져오는 부분만 교체
- **최신 리콜(자동차리콜센터 게시판, 주 출처)**: `scripts/fetch-recall-center.mjs` 가 car.go.kr 리콜현황 게시판 목록을 넘기며 새 리콜 ID를 찾고, 상세 표(제작사·차명·생산기간·시정 시작일·대수·결함·시정방법)를 AI 없이 그대로 읽어 `data/recall_center.json` 에 저장. 리콜이 시작되면 바로 올라오는 곳이라 언론의 "국토교통부 자동차리콜센터에 따르면…" 기사와 같은 출처. 같은 제작사·같은 시작일 리콜이 보도자료에도 있으면 사이트에는 리콜센터 쪽만 표시
- **최신 리콜(국토부 보도자료)**: 같은 워크플로가 `scripts/fetch-recall-news.mjs` 로 국토교통부 리콜 보도자료를 확인 → 첨부 PDF의 표를 Gemini로 정리하고 원문과 숫자·날짜를 대조 → `data/recall_news.json`
  - 필요한 시크릿: `GEMINI_API_KEY` (무료 등급 키로 충분). 없으면 제목·링크만 저장하고 키가 생긴 뒤 다시 시도
  - 새 리콜은 `data/recalls_new.json` 에도 들어감 (블로그 리콜 글 파이프라인 입력)

## 블로그 글별 유입 확인
- 블로그 글의 정비핵 링크 끝에 `?from=꼬리표` 를 붙이기 (영문·숫자·-·_ , 60자 이내). 예: `https://.../cars/hyundai-tucson-nx4/recalls?from=recall-tucson-2611`
- 구글시트 `events` 탭: `type=landing` 행 = 그 꼬리표로 들어온 방문, 같은 방문의 쿠팡·공임나라 클릭(`type=outbound`)은 `meta` 열에 `"from":"꼬리표"` 가 함께 남음

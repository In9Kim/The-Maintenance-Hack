The Maintenance Hack: Project Specification
1. Project Overview
Name: The Maintenance Hack (가칭: 정비핵)

Goal: 자동차 정비소의 '정보 비대칭' 문제를 해결하고, 사용자에게 최적의 부품 구매 및 공임 조합을 제안하여 정비 비용을 혁신적으로 절감함.

Target: 공식 서비스 센터(예: 기아오토큐)의 높은 견적에 당황한 차주, 공임나라 이용을 희망하지만 부품 구매가 어려운 초보 정비족.

2. Core Value Proposition
Quotation Decoder (견적서 해독기): 오프라인 견적서 항목을 분석하여 과잉 정비 여부를 판단하고, 부품/공임 분리 시 절감액 산출.

Parts Matchmaker: 차종별 순정 부품 번호를 기반으로 쿠팡(Coupang) 최저가 링크를 실시간 매칭.

Total Cost Calculator: [선택한 부품 값 (쿠팡)] + [표준 공임 (공임나라 기준)] = 최종 예상 비용 도출.

3. Technology Stack & Strategy (Vibe Coding Friendly)
Frontend: Next.js (App Router), Tailwind CSS, Shadcn/UI.

Backend/Data:

Parts Data: LLM(Gemini/GPT)을 통해 사전 구축된 차종별 소모품 규격 DB (JSON 기반).

Price Data: Coupang Partners API 연동 (실시간 최저가 및 링크).

OCR: Tesseract.js 또는 Cloud Vision API를 사용하여 견적서 이미지에서 텍스트 추출.

SEO Strategy: 차종별 /[brand]/[model]/maintenance 구조의 동적 라우팅을 통해 롱테일 키워드 유입 극대화.

4. Key Workflows
A. Maintenance Calculator Flow
사용자가 차종 선택 (예: 기아 쏘렌토 MQ4)

교체할 소모품 항목 체크 (엔진오일, 브레이크 패드 등)

시스템이 해당 차종의 순정/호환 부품 규격 로드

쿠팡 실시간 최저가 합산 + 공임나라 표준 공임 합산

"오늘 구매 시 총 정비비 00만원" 결과 화면 및 구매 링크 제공

B. Quote Analysis Flow (OCR)
사용자가 정비소 견적서 사진 업로드

AI가 항목명과 가격 추출

시스템 DB 내의 부품/공임 데이터와 비교 분석

"이 항목은 셀프 구매 시 00원 절약 가능합니다" 리포트 생성

5. Roadmap (MVP)
Phase 1: 현대/기아차 주요 인기 차종 소모품 규격 DB 구축 및 기본 계산기 웹 구현.

Phase 2: 쿠팡 파트너스 API 연동 및 자동 링크 생성 로직 최적화.

Phase 3: 견적서 업로드 및 AI 분석 기능(OCR) 추가.

Phase 4: 사용자 정비 이력 저장 및 교체 주기 알림 서비스 확장.

6. Prompting Guide for Vibe Coding
"나는 기아차 소유자이자 백엔드 개발자야. 위 명세서를 바탕으로 사용자가 차종을 선택하고 소모품을 체크하면 공임나라 공임과 쿠팡 부품값을 합쳐주는 Next.js 기반 웹사이트의 첫 화면 코드를 짜줘. UI는 Shadcn/UI를 사용해서 깔끔하게 만들어줘."
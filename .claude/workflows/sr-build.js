export const meta = {
  name: 'sr-build',
  description: '승인된 SR 문서를 받아 개발 → QA·사용성 검토·동료검토 → 수정 → 최종 확인까지 (배포는 메인 세션)',
  whenToUse: '사장님이 승인한 docs/sr/SR-xxx.md 를 구현할 때. args: { sr: "docs/sr/SR-001.md", scratch: "<스크래치 폴더 절대경로>" }',
  phases: [
    { title: 'Plan', detail: 'SR을 파일이 겹치지 않는 개발팀으로 나눔' },
    { title: 'Dev', detail: '팀별 동시 개발' },
    { title: 'QA', detail: '기능 QA · 390px 사용성 검토 · 코드 동료검토' },
    { title: 'Fix', detail: '확인된 문제 수정 후 재확인' },
    { title: 'Close', detail: 'tsc·테스트·빌드, SR 문서에 결과 기록' },
  ],
}

const SR = args.sr
const SHOT = `${args.scratch}\\sr`
const ROOT = 'C:\\workSpace\\The Maintenance Hack'
const COMMON = `
프로젝트: 정비핵 ${ROOT} (Next.js App Router, Cloudflare Workers/OpenNext, Supabase 로그인). SR 문서: ${ROOT}\\${SR} (먼저 Read).
규칙: git commit/push/stash/checkout 금지(배포는 메인 세션). .env.local 값 출력 금지. 줄바꿈 CRLF 유지(Edit 도구). 화면 문구는 한국어·짧게·전문용어 없이·390px에서 단어 중간 줄바꿈 없게, 빈 항목 숨김, 등록한 차 다시 고르게 하지 않기. 쿠팡 링크 근처 파트너스 고지 유지. 다른 앱 디자인 복제 금지. 일부러 엉뚱한 입력에 대한 방어는 만들지 않음(보안·비용 한도는 예외). 보고는 한국어.`
const BROWSER = (s) => `
브라우저: agent-browser CLI. 먼저 \`agent-browser skills get core\`. 모든 명령에 \`--session ${s}\`, 시작 시 \`agent-browser --session ${s} viewport 390 844\`. 끝나면 \`agent-browser --session ${s} close\`(--all 금지). 스크린샷은 ${SHOT}\\${s}\\ 에 저장하고 Read로 직접 볼 것. 서버: http://localhost:3456 (이미 떠 있음, 끄거나 재시작하지 말 것).
로그인은 못 하므로 로그인 필요 항목은 blocked. 차 등록 상태가 필요하면 localStorage mh_garage 를 직접 넣거나 /my 에서 '로그인 없이 이 폰에만 저장'으로 등록(예: 기아 K3 BD).`

phase('Plan')
const PLAN = { type: 'object', properties: { teams: { type: 'array', items: { type: 'object', properties: {
  key: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, items: { type: 'string' }, notes: { type: 'string' } },
  required: ['key', 'files', 'items', 'notes'] } }, screens: { type: 'array', items: { type: 'string' }, description: 'QA가 볼 화면 URL 경로와 필요한 상태' } },
  required: ['teams', 'screens'] }
const plan = await agent(`${COMMON}
너는 개발 리드다. SR의 각 항목을 실제 코드에서 찾아(어느 파일·컴포넌트인지) 개발팀으로 나눠라. 팀은 1~4개, 팀끼리 담당 파일이 절대 겹치면 안 된다(겹치면 한 팀으로 합칠 것). 각 팀 notes에 원인과 구현 방향을 구체적으로(파일:줄). screens에는 QA가 확인할 화면 경로와 필요한 상태(차 등록 여부 등).`, { label: 'plan', schema: PLAN })
log(`개발팀 ${plan.teams.length}개: ${plan.teams.map(t => t.key).join(', ')}`)

phase('Dev')
const DEVOUT = { type: 'object', properties: { done: { type: 'string' }, open: { type: 'string', description: '못 한 것·확인 필요' }, tsc: { type: 'string' } }, required: ['done', 'open', 'tsc'] }
const dev = await parallel(plan.teams.map(t => () => agent(`${COMMON}
너는 개발팀 '${t.key}'. 담당 파일만 고칠 것(다른 팀이 동시에 다른 파일을 고침): ${t.files.join(', ')}
맡은 SR 항목: ${t.items}
리드 메모: ${t.notes}
next build·next dev·next start 금지(충돌). 확인은 \`npx tsc --noEmit -p .\` 와 관련 node 테스트만. 새 로직엔 가능하면 lib/*.test.ts 테스트 추가.`, { label: `dev-${t.key}`, phase: 'Dev', schema: DEVOUT })))

phase('QA')
const prep = await agent(`${COMMON}
QA 준비: 포트 3456에 떠 있는 서버가 있으면 PowerShell로 그 프로세스만 종료(Get-NetTCPConnection -LocalPort 3456 -State Listen → Stop-Process). 그다음 \`npx next build\` (실패하면 원인을 그대로 보고하고 멈춤), 성공하면 bash로 \`(npx next start -p 3456 > "${args.scratch}\\next.log" 2>&1 &)\` 로 띄우고 curl로 / 가 200인지 확인. 결과를 한 줄로.`, { label: 'qa-prep', phase: 'QA' })

const ISSUES = { type: 'object', properties: { issues: { type: 'array', items: { type: 'object', properties: {
  severity: { type: 'string', enum: ['P0', 'P1', 'P2'] }, title: { type: 'string' }, where: { type: 'string' }, detail: { type: 'string' }, screenshot: { type: 'string' } },
  required: ['severity', 'title', 'where', 'detail'] } }, passed: { type: 'string', description: 'SR 완료 기준별 통과 여부 요약' } }, required: ['issues', 'passed'] }

const [qa, ux, peer] = await parallel([
  () => agent(`${COMMON}${BROWSER('srqa')}
서버 준비 결과: ${prep}
너는 기능 QA다. SR 문서의 '완료 기준'을 하나씩 실제 화면에서 확인하고, 바뀐 기능 주변(같은 화면의 다른 버튼·링크)이 망가지지 않았는지도 본다. 확인 화면: ${JSON.stringify(plan.screens)}
실제로 본 것만 이슈로(재현 단계·스크린샷 경로).`, { label: 'qa-functional', phase: 'QA', schema: ISSUES }),
  () => agent(`${COMMON}${BROWSER('srux')}
서버 준비 결과: ${prep}
너는 사용성 검토자다. 사장님은 직장인·육아 중이라 폰으로 잠깐씩 보고, 글이 많거나 줄이 꺾이거나 빈 공간·쓸데없는 상자·모순된 문구를 싫어한다. 이번 SR로 바뀐 화면과 그 화면에서 이어지는 화면을 390x844로 위에서 아래까지 스크롤하며 스크린샷을 찍고 직접 봐라: ${JSON.stringify(plan.screens)}
찾을 것: 단어 중간 줄바꿈, 넘치거나 잘린 글자, 큰 빈 공간, 읽히지 않는 긴 문단, 화면 문구끼리 모순, 눌러야 할지 모르는 요소, 아무도 안 볼 것 같은 요소. 취향이 아니라 근거(스크린샷 위치)로.`, { label: 'qa-ux', phase: 'QA', schema: ISSUES }),
  () => agent(`${COMMON}
너는 동료검토자(코드 리뷰)다. \`git diff\` 와 새 파일(git status)을 전부 읽고, SR 요구와 맞는지, 버그·회귀(다른 화면에서 같은 컴포넌트를 쓰는데 깨지는 곳), 접근성(버튼 이름), SEO 내용 삭제 여부, 파트너스 고지 누락을 찾아라. 기본 태도는 의심. 실제 줄 근거로만.`, { label: 'peer-review', phase: 'QA', schema: ISSUES }),
])

const all = [qa, ux, peer].filter(Boolean).flatMap((r, i) => r.issues.map(x => ({ ...x, from: ['기능QA', '사용성', '동료검토'][i] })))
log(`QA 이슈 ${all.length}건`)

phase('Fix')
let fix = null
let recheck = null
if (all.length) {
  fix = await agent(`${COMMON}
너는 수정 담당이다. 아래 QA·사용성·동료검토 이슈를 하나씩 코드에서 확인하고, 진짜 문제면 고쳐라(파일 제한 없음, 다른 사람이 고친 걸 되돌리지 말 것). 취향 차이·근거 약한 건 고치지 말고 이유를 적어라. next build 금지(서버가 떠 있음). tsc와 관련 테스트로 확인.
이슈: ${JSON.stringify(all)}`, { label: 'fix', phase: 'Fix', schema: { type: 'object', properties: { fixed: { type: 'array', items: { type: 'string' } }, rejected: { type: 'array', items: { type: 'string' } } }, required: ['fixed', 'rejected'] } })
  recheck = await agent(`${COMMON}${BROWSER('srre')}
재확인 담당. 먼저 포트 3456 서버 프로세스를 종료하고 \`npx next build\` 후 \`(npx next start -p 3456 > "${args.scratch}\\next.log" 2>&1 &)\` 로 다시 띄워라. 그다음 고쳤다는 이슈를 실제 화면에서 다시 확인하고, SR 완료 기준 전체를 한 번 더 빠르게 확인해라.
고쳤다는 것: ${JSON.stringify(fix?.fixed ?? [])}
원래 이슈: ${JSON.stringify(all)}`, { label: 'recheck', phase: 'Fix', schema: ISSUES })
}

phase('Close')
const close = await agent(`${COMMON}
마무리 담당. 1) 포트 3456 서버 프로세스 종료. 2) \`npx tsc --noEmit -p .\`, \`npm test\`(ℹ tests/pass/fail 줄), \`npx next build\` 실행. 실패하면 고치고 다시. 3) SR 문서 맨 아래에 '## 결과' 절을 추가: 항목별 처리 내용 한 줄씩, 남은 문제·확인 필요, 테스트 수치. 4) 결과를 요약해서 반환.
재확인 결과: ${JSON.stringify(recheck ?? { note: 'QA 이슈 없음' })}
수정 거절 목록: ${JSON.stringify(fix?.rejected ?? [])}`, { label: 'close', phase: 'Close', schema: { type: 'object', properties: { tsc: { type: 'string' }, tests: { type: 'string' }, build: { type: 'string' }, summary: { type: 'string' }, remaining: { type: 'string' } }, required: ['tsc', 'tests', 'build', 'summary', 'remaining'] } })

return { plan, dev, issues: all, fix, recheck, close, shots: SHOT }

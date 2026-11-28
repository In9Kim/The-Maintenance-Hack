/**
 * 알림 구독 저장 전 검사 (보안·비용 한도). 다른 파일을 불러오지 않아 node 테스트로 바로 확인.
 *  - 구독 주소는 브라우저 푸시 서비스만 (아무 주소나 받으면 워커가 남이 고른 주소로 POST를 보내게 됨)
 *  - 계정당 구독 기기 수, 하루 저장 횟수, 확인 알림(hello) 횟수 상한
 */

/** 크롬·삼성·엣지(FCM), 파이어폭스, 윈도, 사파리(애플) 푸시 서버 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/, /^([a-z0-9-]+\.)*notify\.windows\.com$/, /^web\.push\.apple\.com$/, /^([a-z0-9-]+\.)*push\.apple\.com$/]

export function isPushEndpoint(endpoint: string): boolean {
  let u: URL
  try {
    u = new URL(endpoint)
  } catch {
    return false
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return false
  return PUSH_HOSTS.some((re) => re.test(u.hostname.toLowerCase()))
}

/** 한 계정에 알림을 켤 수 있는 기기 수 */
export const MAX_SUBS_PER_USER = 5
/** 한 계정이 하루에 일정을 저장하는 횟수 (차·기록을 바꿀 때마다 3초 모아 한 번) */
export const MAX_SAVES_PER_DAY = 60
/** 한 계정이 하루에 받는 '알림이 켜졌어요' 확인 알림 수 */
export const MAX_HELLO_PER_DAY = 3

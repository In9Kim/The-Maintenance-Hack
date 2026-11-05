/**
 * 리콜 → 블로그 글 연결 (9군의 기록장)
 *
 * 리콜 목록에서 이 리콜 항목 아래에 "조회·무상 수리 예약 방법 정리 → 블로그 글" 링크를 붙인다.
 * 새 글을 쓰면 여기에 한 줄 추가: 리콜 ID(리콜 페이지 주소 #뒤 값) → 글 주소
 */
export const RECALL_BLOG_POSTS: Record<string, { url: string; label?: string }> = {
  // 쏘렌토 MQ4 저압연료라인 어셈블리 리콜 (2026-10-30, 102,755대)
  "2026-10-30-carkr-6423": { url: "https://blog.naver.com/wwe9459/224465554364" },
}

export function recallBlogPost(recallId: string) {
  const post = RECALL_BLOG_POSTS[recallId]
  return post ? { url: post.url, label: post.label ?? "조회·무상 수리 예약 방법 정리 → 블로그 글" } : null
}

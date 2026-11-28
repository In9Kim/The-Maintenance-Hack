/** 로그인 안 한 사람의 하루 무료 횟수를 기기별로 세기 위한 무작위 값 (개인정보 아님, 이 브라우저에만) */
export function deviceId(): string {
  try {
    let v = localStorage.getItem("mh_device")
    if (!v) {
      v = crypto.randomUUID()
      localStorage.setItem("mh_device", v)
    }
    return v
  } catch {
    return ""
  }
}

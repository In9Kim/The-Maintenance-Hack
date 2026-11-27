import { permanentRedirect } from "next/navigation"

/** 정비소 리스트는 없앴음 (2026-11-27). 예전 주소로 오면 마이로 */
export default function Page() {
  permanentRedirect("/my")
}

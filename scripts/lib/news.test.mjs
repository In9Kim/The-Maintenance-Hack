// 실행: npm test
// 원문은 국토교통부 보도자료 「현대·기아 등 자발적 시정조치(리콜)」(2026-08-06) PDF에서 뽑은 텍스트
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  dateInText,
  findPdfUrl,
  isRecallTitle,
  monthDayInText,
  numberInText,
  parseListHtml,
  pressYear,
  validateExtraction,
} from "./news.mjs"

const TEXT = readFileSync(new URL("../fixtures/molit-20260806.txt", import.meta.url), "utf8")

test("목록 HTML에서 보도자료를 뽑고 리콜 글만 고른다", () => {
  const html = `<table><tbody>
    <tr><td>8</td><td class="bd_title"><a href="dtl.jsp?lcmspage=1&amp;id=95092288">현대·기아 등 자발적 시정조치(리콜)</a></td><td>모빌리티자동차</td><td>2026-08-06</td><td>6977</td></tr>
    <tr><td>7</td><td><a href="dtl.jsp?lcmspage=1&id=95092546">「2026 해외건설 플랜트의 날」 기념식</a></td><td>건설</td><td>2026-11-02</td><td>486</td></tr>
  </tbody></table>`
  const rows = parseListHtml(html)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    id: "95092288",
    title: "현대·기아 등 자발적 시정조치(리콜)",
    date: "2026-08-06",
    url: "https://www.molit.go.kr/USR/NEWS/m_71/dtl.jsp?id=95092288",
  })
  assert.deepEqual(rows.filter((r) => isRecallTitle(r.title)).map((r) => r.id), ["95092288"])
})

test("상세 HTML에서 hwpx가 아닌 PDF 첨부를 찾는다", () => {
  const html = `<a href="/portal/common/download/DownloadMltm2.jsp?FilePath=/upload/a.hwpx&FileName=x.hwpx">hwpx</a>
    <a href="/LCMS/DWN.jsp?fold=koreaNews/mobile/file&amp;fileName=260806%28%EC%84%9D%EA%B0%84%29.pdf">pdf</a>`
  assert.equal(
    findPdfUrl(html),
    "https://www.molit.go.kr/LCMS/DWN.jsp?fold=koreaNews/mobile/file&fileName=260806%28%EC%84%9D%EA%B0%84%29.pdf"
  )
  assert.equal(findPdfUrl("<a href='/x.hwpx'>x</a>"), null)
})

test("원문 대조: 날짜·대수·시정 시작일", () => {
  assert.equal(pressYear(TEXT), 2026)
  assert.equal(dateInText("2023-07-24", TEXT), true) // `23.07.24.
  assert.equal(dateInText("2017-06-19", TEXT), true) // 물결 ～ 표기
  assert.equal(dateInText("2023-07-25", TEXT), false)
  assert.equal(numberInText(51016, TEXT), true)
  assert.equal(numberInText(711, TEXT), true)
  assert.equal(numberInText(419, TEXT), false) // 2,419의 일부는 인정하지 않음
  assert.equal(monthDayInText("2026-07-30", TEXT), true) // "7월 30일부터"
  assert.equal(monthDayInText("2026-07-31", TEXT), false)
})

test("AI가 틀린 값은 원문 대조로 걸러낸다", () => {
  const ai = {
    summary: "총 4개사 13개 차종 512,393대 자발적 시정조치",
    groups: [
      {
        maker: "현대자동차㈜",
        part: "전방충돌방지 보조시스템",
        defect: "전방충돌방지 보조시스템의 소프트웨어 설계 미흡에 따른 오작동으로 사고 발생 가능성",
        startDate: "2026-07-30",
        total: 104781,
        cars: [
          { name: "투싼", from: "2023-07-24", to: "2026-03-16", count: 51016 },
          // 대수를 미판매까지 더해 잘못 뽑음 → 대수만 비움
          { name: "투싼 하이브리드", from: "2023-11-17", to: "2026-03-16", count: 53764 },
        ],
      },
      {
        maker: "기아㈜",
        part: "크로스오버파이프 너트",
        defect: "너트 체결 불량으로 연료 누유, 화재 가능성",
        startDate: "2026-08-15", // 원문에 없는 날짜 → null
        total: 109237,
        cars: [
          { name: "K8", from: "2021-03-08", to: "2025-04-28", count: 9348 },
          { name: "가짜차", from: "2021-01-01", to: "2025-01-01", count: 1 }, // 생산기간이 원문에 없음 → 제외
        ],
      },
      // 차가 하나도 확인되지 않는 묶음은 통째로 제외
      { maker: "가짜㈜", defect: "x", startDate: null, total: null, cars: [{ name: "X", from: "2020-01-01", to: "2020-02-01", count: 3 }] },
    ],
  }
  const out = validateExtraction(ai, TEXT)
  assert.equal(out.groups.length, 2)

  const [hyundai, kia] = out.groups
  assert.equal(hyundai.startDate, "2026-07-30")
  assert.equal(hyundai.total, 104781)
  assert.deepEqual(hyundai.cars.map((c) => [c.name, c.count]), [["투싼", 51016], ["투싼 하이브리드", null]])
  assert.equal(hyundai.verified, false)

  assert.equal(kia.startDate, null)
  assert.deepEqual(kia.cars.map((c) => c.name), ["K8"])
  assert.equal(kia.verified, false)
})

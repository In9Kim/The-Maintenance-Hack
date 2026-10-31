/**
 * 정비핵 — Google Apps Script 캐시 서버 (URLSearchParams / form-encoded 방식)
 *
 * 배포 방법:
 *   1. script.google.com → 새 프로젝트 → 이 코드 붙여넣기
 *   2. SHEET_ID에 스프레드시트 ID 입력 (URL의 /d/{ID}/edit 부분)
 *   3. 배포 → 새 배포 → 웹 앱
 *      - 다음 사용자로 실행: 나(Me)
 *      - 액세스 권한: 모든 사용자(Anyone)
 *   4. 배포 URL → .env.local의 APPS_SCRIPT_URL에 입력
 *
 * 수신 방식: Content-Type: application/x-www-form-urlencoded
 *   → JSON.parse(e.postData.contents) 대신 e.parameter 사용
 *   → GAS가 URL 디코딩을 자동 처리
 *
 * 시트 컬럼 (A~E):
 *   A: vinMasked  B: inputPart  C: specs  D: resultJson  E: created_at
 *
 * 프로토콜 (form 파라미터):
 *   action=save   + vinMasked + inputPart + specs + resultJson → { success:true }
 *   action=lookup + vinMasked + inputPart                     → { found, data? }
 *   action=count                                              → { count }
 */

var SHEET_ID   = "여기에_스프레드시트_ID_입력"; // ← 필수 변경
var SHEET_NAME = "verify_cache";

// ─────────────────────────────────────────────────────────────────────────────

function doPost(e) {
  Logger.log("=== doPost 시작 ===");

  // ── e.parameter로 form-encoded 데이터 수신 ──────────────────────
  var data = e.parameter;

  Logger.log("수신 파라미터 action: " + (data ? data.action : "없음"));
  Logger.log("postData.type: "       + (e.postData ? e.postData.type : "없음"));

  if (!data || !data.action) {
    Logger.log("action 파라미터 없음");
    return json({ error: "action 파라미터가 없습니다." });
  }

  // ── action 라우팅 ─────────────────────────────────────────────────
  try {
    switch (data.action) {
      case "save":   return json(handleSave(data));
      case "lookup": return json(handleLookup(data));
      case "count":  return json(handleCount());
      default:
        Logger.log("알 수 없는 action: " + data.action);
        return json({ error: "unknown action: " + data.action });
    }
  } catch (err) {
    Logger.log("처리 오류: " + String(err));
    return json({ error: String(err) });
  }
}

// GET — 배포 URL 동작 확인용
function doGet() {
  Logger.log("doGet 호출됨");
  return json({ status: "ok", service: "maintenance-hack-cache" });
}

// ─────────────────────────────────────────────────────────────────────────────

function getSheet() {
  if (!SHEET_ID || SHEET_ID === "여기에_스프레드시트_ID_입력") {
    throw new Error("SHEET_ID가 설정되지 않았습니다. Code.gs의 SHEET_ID 변수를 수정하세요.");
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  if (!ss) throw new Error("스프레드시트를 열 수 없습니다: " + SHEET_ID);

  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log("시트 없음 → 신규 생성: " + SHEET_NAME);
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["vinMasked", "inputPart", "specs", "resultJson", "created_at"]);
  }
  return sheet;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * 저장: e.parameter 값을 그대로 A~E열에 기록
 * resultJson은 Next.js에서 JSON.stringify() 후 URL 인코딩되어 도착
 * → GAS e.parameter가 자동 디코딩 → 원본 JSON 문자열로 복원됨
 */
function handleSave(data) {
  Logger.log("handleSave | vinMasked: "  + (data.vinMasked  || "없음"));
  Logger.log("handleSave | inputPart: "  + (data.inputPart  || "없음"));
  Logger.log("handleSave | specs: "      + (data.specs       || "없음"));
  Logger.log("handleSave | resultJson 길이: " + ((data.resultJson || "").length));

  var sheet = getSheet();
  sheet.appendRow([
    (data.vinMasked  || "").toUpperCase().trim(),   // A
    (data.inputPart  || "").toLowerCase().trim(),   // B
    (data.specs      || ""),                        // C
    (data.resultJson || ""),                        // D — URL 디코딩된 JSON 문자열
    new Date().toISOString()                        // E
  ]);

  Logger.log("handleSave 완료 | 총 행 수: " + sheet.getLastRow());
  return { success: true };
}

/**
 * 조회: vinMasked + inputPart 키로 D열(resultJson)을 찾아 파싱 반환
 */
function handleLookup(data) {
  var vinMasked = (data.vinMasked || "").toUpperCase().trim();
  var inputPart = (data.inputPart || "").toLowerCase().trim();
  Logger.log("handleLookup | 검색 키: " + vinMasked + " / " + inputPart);

  if (!vinMasked || !inputPart) return { found: false };

  var sheet  = getSheet();
  var rows   = sheet.getDataRange().getValues();
  Logger.log("handleLookup | 전체 행 수 (헤더 포함): " + rows.length);

  for (var i = 1; i < rows.length; i++) {
    var row     = rows[i];
    var rowVin  = (row[0] || "").toString().toUpperCase().trim();
    var rowPart = (row[1] || "").toString().toLowerCase().trim();
    if (rowVin === vinMasked && rowPart === inputPart) {
      Logger.log("캐시 히트! row: " + i);
      try {
        var parsed = typeof row[3] === "string" ? JSON.parse(row[3]) : row[3];
        return { found: true, data: parsed };
      } catch (parseErr) {
        Logger.log("resultJson 파싱 실패 → miss: " + String(parseErr));
        return { found: false };
      }
    }
  }

  Logger.log("캐시 미스");
  return { found: false };
}

function handleCount() {
  var sheet = getSheet();
  var count = Math.max(0, sheet.getLastRow() - 1);
  Logger.log("handleCount | 캐시 행 수: " + count);
  return { count: count };
}

// ─────────────────────────────────────────────────────────────────────────────

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

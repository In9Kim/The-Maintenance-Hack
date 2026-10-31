/**
 * 정비핵 — Google Apps Script 데이터 서버
 *
 * 하나의 스프레드시트에 탭 3개를 자동으로 만들어 씁니다.
 *   verify_cache   : 호환성 검증 결과 캐시 (Gemini 호출 절약)
 *   events         : 방문자 행동 기록 (쿠팡·공임나라 이동 클릭, 검증 사용 등)
 *   generated_cars : 사용자가 요청해 AI가 생성한 차종 (관리자 검증 전)
 *
 * 배포 방법:
 *   1. script.google.com → 프로젝트 열기(또는 새 프로젝트) → 이 코드 전체 붙여넣기
 *   2. 아래 SHEET_ID, SECRET 입력
 *      - SHEET_ID: 스프레드시트 URL의 /d/{ID}/edit 부분
 *      - SECRET : 아무 긴 문자열. 같은 값을 Cloudflare 환경변수 APPS_SCRIPT_SECRET 에도 넣음
 *   3. 배포 → 배포 관리 → (기존 배포) 연필 아이콘 → 버전: "새 버전" → 배포
 *      처음이면: 배포 → 새 배포 → 웹 앱 / 실행: 나 / 액세스: 모든 사용자
 *   4. 웹 앱 URL → Cloudflare 환경변수 APPS_SCRIPT_URL
 *
 * 수신 방식: application/x-www-form-urlencoded (e.parameter)
 */

var SHEET_ID = "여기에_스프레드시트_ID_입력"; // ← 필수 변경
var SECRET   = "";                           // ← 권장: 긴 임의 문자열 (비워두면 검사 안 함)

var TABS = {
  cache:  { name: "verify_cache",   header: ["vinMasked", "inputPart", "specs", "resultJson", "created_at"] },
  events: { name: "events",         header: ["timestamp", "type", "target", "carId", "partId", "path", "referrer", "meta"] },
  cars:   { name: "generated_cars", header: ["id", "brand", "model", "generation", "status", "carJson", "created_at", "updated_at"] }
};

// ─────────────────────────────────────────────────────────────────────────────

function doPost(e) {
  var data = e && e.parameter;
  if (!data || !data.action) return json({ error: "action 파라미터가 없습니다." });
  if (SECRET && data.secret !== SECRET) return json({ error: "unauthorized" });

  try {
    switch (data.action) {
      case "save":        return json(handleSave(data));
      case "lookup":      return json(handleLookup(data));
      case "count":       return json(handleCount());
      case "event":       return json(handleEvent(data));
      case "stats":       return json(handleStats(data));
      case "car_list":    return json(handleCarList());
      case "car_save":    return json(handleCarSave(data));
      case "car_update":  return json(handleCarUpdate(data));
      case "car_delete":  return json(handleCarDelete(data));
      default:            return json({ error: "unknown action: " + data.action });
    }
  } catch (err) {
    Logger.log("처리 오류: " + String(err));
    return json({ error: String(err) });
  }
}

// GET — 배포 URL 동작 확인용
function doGet() {
  return json({ status: "ok", service: "maintenance-hack-data" });
}

// ─────────────────────────────────────────────────────────────────────────────

function getTab(key) {
  if (!SHEET_ID || SHEET_ID === "여기에_스프레드시트_ID_입력") {
    throw new Error("SHEET_ID가 설정되지 않았습니다. Code.gs의 SHEET_ID 변수를 수정하세요.");
  }
  var def = TABS[key];
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(def.name);
  if (!sheet) {
    sheet = ss.insertSheet(def.name);
    sheet.appendRow(def.header);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function rowsOf(key) {
  var sheet = getTab(key);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, TABS[key].header.length).getValues();
}

function str(v, max) {
  return String(v == null ? "" : v).slice(0, max || 500);
}

// ── 검증 캐시 ────────────────────────────────────────────────────────────────

function handleSave(data) {
  getTab("cache").appendRow([
    str(data.vinMasked).toUpperCase().trim(),
    str(data.inputPart).toLowerCase().trim(),
    str(data.specs),
    str(data.resultJson, 45000),
    new Date().toISOString()
  ]);
  return { success: true };
}

function handleLookup(data) {
  var vinMasked = str(data.vinMasked).toUpperCase().trim();
  var inputPart = str(data.inputPart).toLowerCase().trim();
  if (!vinMasked || !inputPart) return { found: false };

  var rows = rowsOf("cache");
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0]).toUpperCase().trim() === vinMasked &&
        String(rows[i][1]).toLowerCase().trim() === inputPart) {
      try {
        var parsed = typeof rows[i][3] === "string" ? JSON.parse(rows[i][3]) : rows[i][3];
        return { found: true, data: parsed };
      } catch (parseErr) {
        return { found: false };
      }
    }
  }
  return { found: false };
}

function handleCount() {
  return { count: Math.max(0, getTab("cache").getLastRow() - 1) };
}

// ── 행동 기록 ────────────────────────────────────────────────────────────────

function handleEvent(data) {
  getTab("events").appendRow([
    new Date().toISOString(),
    str(data.type, 40),
    str(data.target, 40),
    str(data.carId, 100),
    str(data.partId, 150),
    str(data.path, 300),
    str(data.referrer, 200),
    str(data.meta, 1000)
  ]);
  return { success: true };
}

/**
 * 행동 기록 집계 (관리자 화면용)
 * days 파라미터가 있으면 최근 N일만 집계
 */
function handleStats(data) {
  var days = parseInt(data.days, 10);
  var since = days > 0 ? Date.now() - days * 86400000 : 0;

  var res = {
    total: 0,
    byType: {},
    outbound: {},          // { coupang: n, naver: n, gongim: n }
    carViews: {},
    partClicks: {},        // { "carId:partId": n }  (쿠팡 이동)
    gongimClicks: {},      // { carId: n }
    verify: { hits: 0, misses: 0 },
    byDay: {},             // { "2026-11-01": { events: n, outbound: n } }
    topPaths: {}
  };

  var rows = rowsOf("events");
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var ts = r[0] instanceof Date ? r[0].getTime() : Date.parse(r[0]);
    if (since && ts < since) continue;

    var type = String(r[1]), target = String(r[2]), carId = String(r[3]), partId = String(r[4]), path = String(r[5]);
    var day = new Date(ts).toISOString().slice(0, 10);

    res.total++;
    res.byType[type] = (res.byType[type] || 0) + 1;
    res.byDay[day] = res.byDay[day] || { events: 0, outbound: 0 };
    res.byDay[day].events++;

    if (type === "outbound") {
      res.outbound[target] = (res.outbound[target] || 0) + 1;
      res.byDay[day].outbound++;
      if (target === "coupang" && carId) {
        var key = carId + ":" + partId;
        res.partClicks[key] = (res.partClicks[key] || 0) + 1;
      }
      if (target === "gongim" && carId) res.gongimClicks[carId] = (res.gongimClicks[carId] || 0) + 1;
      if (path) res.topPaths[path] = (res.topPaths[path] || 0) + 1;
    } else if (type === "car_view" && carId) {
      res.carViews[carId] = (res.carViews[carId] || 0) + 1;
    } else if (type === "verify") {
      var meta = {};
      try { meta = JSON.parse(r[7] || "{}"); } catch (err) {}
      if (meta.cacheHit) res.verify.hits++; else res.verify.misses++;
    }
  }
  return res;
}

// ── AI 생성 차종 ─────────────────────────────────────────────────────────────

function handleCarList() {
  var rows = rowsOf("cars");
  var cars = [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][4]) === "deleted") continue;
    try {
      var car = JSON.parse(rows[i][5]);
      car.is_verified = String(rows[i][4]) === "verified";
      cars.push(car);
    } catch (err) {}
  }
  return { cars: cars };
}

function findCarRow(id) {
  var rows = rowsOf("cars");
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === id && String(rows[i][4]) !== "deleted") return i + 2; // 시트 행 번호
  }
  return -1;
}

function handleCarSave(data) {
  var car = JSON.parse(data.carJson);
  if (!car || !car.id) throw new Error("carJson에 id가 없습니다.");
  if (findCarRow(car.id) > 0) return { success: true, duplicate: true };
  var now = new Date().toISOString();
  getTab("cars").appendRow([car.id, car.brand, car.model, car.generation, "pending", JSON.stringify(car), now, now]);
  return { success: true };
}

function handleCarUpdate(data) {
  var row = findCarRow(str(data.id, 100));
  if (row < 0) return { error: "not_found" };
  var sheet = getTab("cars");
  var car = JSON.parse(sheet.getRange(row, 6).getValue());
  var patch = JSON.parse(data.patchJson || "{}");
  for (var k in patch) car[k] = patch[k];
  var status = car.is_verified ? "verified" : "pending";
  delete car.is_verified;
  sheet.getRange(row, 5, 1, 4).setValues([[status, JSON.stringify(car), sheet.getRange(row, 7).getValue(), new Date().toISOString()]]);
  car.is_verified = status === "verified";
  return { car: car };
}

function handleCarDelete(data) {
  var ids = JSON.parse(data.idsJson || "[]");
  var sheet = getTab("cars");
  var removed = 0;
  for (var i = 0; i < ids.length; i++) {
    var row = findCarRow(String(ids[i]));
    if (row > 0) {
      sheet.getRange(row, 5).setValue("deleted");
      sheet.getRange(row, 8).setValue(new Date().toISOString());
      removed++;
    }
  }
  return { removed: removed };
}

// ─────────────────────────────────────────────────────────────────────────────

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

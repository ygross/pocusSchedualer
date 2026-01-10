// adminUpdateDeleteActivities.js
// ADMIN ONLY: update activity + instances, and HARD DELETE activity from DB (including instances)
//
// Assumptions (based on your DB/DTO):
// - Search expects nameContains (not name).  :contentReference[oaicite:2]{index=2}
// - Hard delete should be separated from soft delete, e.g. DELETE /api/admin/activities/{id}

const baseDir = "/simcenter/PocusSchedualer";
const API_BASE = `${window.location.origin}${baseDir}/api/api`;
const ADMIN_API_BASE = `${window.location.origin}${baseDir}/api/api/admin`;

const $ = (id) => document.getElementById(id);

function setMsg(elId, text, kind = "") {
  const el = $(elId);
  if (!el) return;
  el.className = "msg" + (kind ? ` ${kind}` : "");
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
}

function setDot(id, ok) {
  const el = $(id);
  if (!el) return;
  el.classList.remove("ok", "err");
  el.classList.add(ok ? "ok" : "err");
}

function pad2(n) { return String(n).padStart(2, "0"); }

function esc(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function toInputLocal(utcIso) {
  if (!utcIso) return "";
  const d = new Date(utcIso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fromInputLocal(val) {
  if (!val) return null;
  const d = new Date(val); // local
  return d.toISOString();  // utc
}

function fmtNice(utcIso) {
  if (!utcIso) return "-";
  const d = new Date(utcIso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

async function fetchTry(url, opts = {}) {
  const headers = {
    "Accept": "application/json",
    ...(opts.headers || {})
  };

  return await fetch(url, {
    credentials: "include",
    ...opts,
    headers
  });
}

async function httpJson(url, opts = {}) {
  const res = await fetchTry(url, opts);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${res.status} ${t}`.trim());
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  return null;
}

function EP() {
  return {
    me: `${API_BASE}/me`,
    types: `${API_BASE}/activity-types`,
    courses: `${API_BASE}/courses`,
    coursesByType: (typeId) => `${API_BASE}/courses/by-type/${encodeURIComponent(typeId)}`,
    instructors: `${API_BASE}/instructors`,

    search: `${API_BASE}/activities/search`,
    editGet: (id) => `${API_BASE}/activities/edit/${encodeURIComponent(id)}`,
    editPut: (id) => `${API_BASE}/activities/edit/${encodeURIComponent(id)}`,

    // ✅ Hard Delete endpoint (Admin)
    // You should implement this on server: DELETE /api/admin/activities/{id}
    deleteActivityHard: (id) => `${ADMIN_API_BASE}/activities/${encodeURIComponent(id)}`
  };
}

let TYPES = [];
let COURSES = [];
let INSTRUCTORS = [];

let selectedActivityId = null;
let loadedActivityDto = null;

function fillSelect(sel, items, getVal, getText, placeholder = "בחר…") {
  if (!sel) return;
  sel.innerHTML =
    `<option value="">${esc(placeholder)}</option>` +
    items.map(x => `<option value="${esc(getVal(x))}">${esc(getText(x))}</option>`).join("");
}

function showAdminGate(show) {
  const gate = $("adminGate");
  if (!gate) return;
  gate.style.display = show ? "flex" : "none";
}

async function loadMeAndGate() {
  try {
    const me = await httpJson(EP().me);
    $("meLine").textContent = "משתמש: " + (me.fullName || me.email || "לא ידוע");
    $("roleLine").textContent = "תפקיד: " + (me.roleName || "-");

    const isAdmin = String(me.roleName || "").toLowerCase() === "admin";
    setDot("sessionDot", true);
    setDot("adminDot", isAdmin);
    $("adminLabel").textContent = isAdmin ? "Admin" : "Not Admin";
    showAdminGate(!isAdmin);
    return isAdmin;
  } catch {
    $("meLine").textContent = "משתמש: לא מחובר";
    $("roleLine").textContent = "תפקיד: -";
    setDot("sessionDot", false);
    setDot("adminDot", false);
    $("adminLabel").textContent = "לא מחובר";
    showAdminGate(true);
    return false;
  }
}

async function loadLookups() {
  [TYPES, COURSES, INSTRUCTORS] = await Promise.all([
    httpJson(EP().types).catch(() => []),
    httpJson(EP().courses).catch(() => []),
    httpJson(EP().instructors).catch(() => [])
  ]);

  fillSelect($("sType"), TYPES, x => x.activityTypeId, x => x.typeName, "הכל");
  fillSelect($("eType"), TYPES, x => x.activityTypeId, x => x.typeName, "בחר סוג…");
  fillSelect($("eCourse"), COURSES, x => x.courseId, x => x.courseName, "בחר קורס…");
  fillSelect(
    $("eLead"),
    INSTRUCTORS,
    x => x.instructorId,
    x => `${x.fullName}${x.email ? ` (${x.email})` : ""}`,
    "בחר מדריך…"
  );

  $("eType").addEventListener("change", async () => {
    const typeId = Number($("eType").value || 0);
    if (!typeId) {
      fillSelect($("eCourse"), COURSES, x => x.courseId, x => x.courseName, "בחר קורס…");
      return;
    }
    const byType = await httpJson(EP().coursesByType(typeId)).catch(() => []);
    fillSelect($("eCourse"), byType, x => x.courseId, x => x.courseName, "בחר קורס…");
  });
}

function clearEdit() {
  selectedActivityId = null;
  loadedActivityDto = null;
  $("editCard").style.display = "none";
  $("selectedPill").textContent = "-";
  $("eName").value = "";
  $("eType").value = "";
  $("eCourse").value = "";
  $("eLead").value = "";
  $("eDeadline").value = "";
  $("instBody").innerHTML = "";
  $("deleteConfirm").value = "";
  $("deleteAck").checked = false;
  setMsg("editMsg", "", "");
}

function renderSearch(rows) {
  const body = $("resultsBody");
  if (!Array.isArray(rows) || rows.length === 0) {
    body.innerHTML = `<tr><td colspan="7" class="tiny">אין תוצאות</td></tr>`;
    return;
  }

  body.innerHTML = rows.map(r => `
    <tr>
      <td><b>${r.activityId}</b></td>
      <td>${esc(r.activityName)}</td>
      <td>${esc(r.typeName)}</td>
      <td>${esc(r.courseName || "-")}</td>
      <td>${esc(r.leadInstructorName || "-")}</td>
      <td>${r.nextStartUtc ? esc(fmtNice(r.nextStartUtc)) : "-"}</td>
      <td><button class="secondary" type="button" data-pick="${r.activityId}">טען</button></td>
    </tr>
  `).join("");

  body.querySelectorAll("button[data-pick]").forEach(btn => {
    btn.addEventListener("click", () => loadForEdit(Number(btn.getAttribute("data-pick"))));
  });
}

async function doSearch() {
  setMsg("searchMsg", "טוען…", "warn");
  $("resultsBody").innerHTML = `<tr><td colspan="7" class="tiny">טוען…</td></tr>`;
  clearEdit();

  const activityId = $("sActivityId").value ? Number($("sActivityId").value) : null;
  const nameContains = $("sName").value.trim() || null;
  const activityTypeId = $("sType").value ? Number($("sType").value) : null;

  const qs = new URLSearchParams();
  if (activityId) qs.set("activityId", String(activityId));
  if (nameContains) qs.set("nameContains", nameContains); // ✅ correct param
  if (activityTypeId) qs.set("activityTypeId", String(activityTypeId));
  qs.set("take", "400");

  try {
    const rows = await httpJson(`${EP().search}?${qs.toString()}`);
    renderSearch(rows);
    setMsg("searchMsg", `נמצאו ${rows?.length || 0} תוצאות.`, "ok");
  } catch (e) {
    setMsg("searchMsg", "שגיאה בחיפוש: " + (e.message || e), "err");
  }
}

// ----- Instances table -----
function instanceRowHtml(inst, idx) {
  const instanceId = inst.instanceId ?? null;
  const start = toInputLocal(inst.startUtc);
  const end = toInputLocal(inst.endUtc);
  const rooms = inst.roomsCount ?? 0;
  const req = inst.requiredInstructors ?? 0;

  return `
    <tr data-idx="${idx}" data-instanceid="${instanceId ? String(instanceId) : ""}">
      <td>${idx + 1}</td>
      <td><input class="iStart" type="datetime-local" value="${esc(start)}" /></td>
      <td><input class="iEnd" type="datetime-local" value="${esc(end)}" /></td>
      <td><input class="iRooms" type="number" min="0" value="${esc(rooms)}" style="width:110px" /></td>
      <td><input class="iReq" type="number" min="0" value="${esc(req)}" style="width:140px" /></td>
      <td>${instanceId ? `<span class="pill2 mono">${instanceId}</span>` : `<span class="tiny">NEW</span>`}</td>
      <td>
        <button class="danger" type="button" data-delrow="1" title="מסיר מהטבלה. המחיקה בשרת תתבצע בשמירה">מחק</button>
      </td>
    </tr>
  `;
}

function renderInstances(instances) {
  const body = $("instBody");
  if (!Array.isArray(instances) || instances.length === 0) {
    body.innerHTML = `<tr><td colspan="7" class="tiny">אין מופעים. אפשר להוסיף.</td></tr>`;
    return;
  }

  body.innerHTML = instances.map((inst, idx) => instanceRowHtml(inst, idx)).join("");

  body.querySelectorAll("button[data-delrow='1']").forEach(btn => {
    btn.addEventListener("click", () => {
      const tr = btn.closest("tr");
      tr.remove();
      renumberInstanceRows();
      setMsg("editMsg", "המופע הוסר מהרשימה. כדי לעדכן בשרת – לחץ 'שמור שינויים'.", "warn");
    });
  });
}

function renumberInstanceRows() {
  const body = $("instBody");
  const rows = Array.from(body.querySelectorAll("tr"));
  if (rows.length === 0) {
    body.innerHTML = `<tr><td colspan="7" class="tiny">אין מופעים. אפשר להוסיף.</td></tr>`;
    return;
  }
  rows.forEach((tr, idx) => {
    const td = tr.querySelector("td");
    if (td) td.textContent = String(idx + 1);
    tr.setAttribute("data-idx", String(idx));
  });
}

function addInstanceRow() {
  const body = $("instBody");
  if (body.querySelector("td[colspan]")) body.innerHTML = "";

  const now = new Date();
  const end = new Date(now.getTime() + 60 * 60 * 1000);

  const inst = {
    instanceId: null,
    startUtc: now.toISOString(),
    endUtc: end.toISOString(),
    roomsCount: 1,
    requiredInstructors: 1
  };

  const idx = body.querySelectorAll("tr").length;
  body.insertAdjacentHTML("beforeend", instanceRowHtml(inst, idx));

  const tr = body.querySelector("tr:last-child");
  tr.querySelector("button[data-delrow='1']").addEventListener("click", () => {
    tr.remove();
    renumberInstanceRows();
    setMsg("editMsg", "המופע הוסר מהרשימה. כדי לעדכן בשרת – לחץ 'שמור שינויים'.", "warn");
  });

  renumberInstanceRows();
  setMsg("editMsg", "נוסף מופע חדש. אל תשכח לשמור.", "ok");
}

function collectInstancesFromTable() {
  const rows = Array.from($("instBody").querySelectorAll("tr"));
  const list = [];

  for (const tr of rows) {
    const startVal = tr.querySelector(".iStart")?.value || "";
    const endVal = tr.querySelector(".iEnd")?.value || "";
    const roomsVal = tr.querySelector(".iRooms")?.value || "0";
    const reqVal = tr.querySelector(".iReq")?.value || "0";
    const instanceIdAttr = tr.getAttribute("data-instanceid") || "";

    const startUtc = fromInputLocal(startVal);
    const endUtc = fromInputLocal(endVal);

    if (!startUtc || !endUtc) continue;

    list.push({
      instanceId: instanceIdAttr ? Number(instanceIdAttr) : 0,
      startUtc,
      endUtc,
      roomsCount: Number(roomsVal) || 0,
      requiredInstructors: Number(reqVal) || 0
    });
  }

  return list;
}

function validateInstances(instances) {
  if (!instances || instances.length === 0) return "חובה לפחות מופע אחד.";
  for (const inst of instances) {
    if (!inst.startUtc || !inst.endUtc) return "לכל מופע חייבים Start/End.";
    const s = new Date(inst.startUtc);
    const e = new Date(inst.endUtc);
    if (isNaN(s)) return "Start לא תקין.";
    if (isNaN(e)) return "End לא תקין.";
    if (e <= s) return "End חייב להיות אחרי Start.";
  }
  return null;
}

async function loadForEdit(activityId) {
  clearEdit();
  selectedActivityId = activityId;

  $("editCard").style.display = "block";
  $("selectedPill").textContent = `#${activityId}`;
  setMsg("editMsg", "טוען פעילות…", "warn");

  try {
    const dto = await httpJson(EP().editGet(activityId));
    loadedActivityDto = dto;

    $("eName").value = dto.activityName || "";
    $("eType").value = String(dto.activityTypeId || "");

    try {
      const byType = await httpJson(EP().coursesByType(Number(dto.activityTypeId || 0)));
      fillSelect($("eCourse"), byType, x => x.courseId, x => x.courseName, "בחר קורס…");
    } catch {
      fillSelect($("eCourse"), COURSES, x => x.courseId, x => x.courseName, "בחר קורס…");
    }

    $("eCourse").value = String(dto.courseId || "");
    $("eLead").value = String(dto.leadInstructorId || "");
    $("eDeadline").value = dto.applicationDeadlineUtc ? toInputLocal(dto.applicationDeadlineUtc) : "";

    renderInstances(dto.instances || []);
    setMsg("editMsg", "נטען. אפשר לערוך ולשמור.", "ok");
  } catch (e) {
    setMsg("editMsg", "שגיאה בטעינה: " + (e.message || e), "err");
  }
}

async function saveActivity() {
  if (!selectedActivityId) return;

  const instances = collectInstancesFromTable();
  const errInst = validateInstances(instances);
  if (errInst) return setMsg("editMsg", errInst, "err");

  const payload = {
    activityName: $("eName").value.trim(),
    activityTypeId: Number($("eType").value || 0),
    courseId: Number($("eCourse").value || 0),
    leadInstructorId: Number($("eLead").value || 0),
    applicationDeadlineUtc: $("eDeadline").value ? fromInputLocal($("eDeadline").value) : null,
    instances: instances.map(x => ({
      instanceId: x.instanceId,
      startUtc: x.startUtc,
      endUtc: x.endUtc,
      roomsCount: x.roomsCount,
      requiredInstructors: x.requiredInstructors
    }))
  };

  if (!payload.activityName) return setMsg("editMsg", "שם פעילות חובה.", "err");
  if (!payload.activityTypeId) return setMsg("editMsg", "סוג פעילות חובה.", "err");
  if (!payload.courseId) return setMsg("editMsg", "קורס חובה.", "err");
  if (!payload.leadInstructorId) return setMsg("editMsg", "מדריך מרכז חובה.", "err");

  $("btnSave").disabled = true;
  setMsg("editMsg", "שומר…", "warn");

  try {
    await httpJson(EP().editPut(selectedActivityId), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setMsg("editMsg", `✅ נשמר בהצלחה (Activity ${selectedActivityId}).`, "ok");
    await doSearch();
    await loadForEdit(selectedActivityId);
  } catch (e) {
    setMsg("editMsg", "שגיאה בשמירה: " + (e.message || e), "err");
  } finally {
    $("btnSave").disabled = false;
  }
}

async function deleteActivityHard() {
  if (!selectedActivityId) return;

  const must = `DELETE ${selectedActivityId}`;
  const typed = ($("deleteConfirm").value || "").trim();
  const ack = $("deleteAck").checked === true;

  if (!ack) return setMsg("editMsg", "סמן/י את תיבת ההבנה למחיקה לצמיתות.", "err");
  if (typed !== must) return setMsg("editMsg", `כדי למחוק – הקלד בדיוק: ${must}`, "err");
  if (!confirm(`מחיקה מלאה מה־DB: למחוק פעילות ${selectedActivityId} כולל כל המופעים?`)) return;

  $("btnDeleteActivity").disabled = true;
  setMsg("editMsg", "מוחק מה־DB…", "warn");

  try {
    const res = await fetchTry(EP().deleteActivityHard(selectedActivityId), { method: "DELETE" });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`${res.status} ${t}`.trim());
    }

    const deletedId = selectedActivityId;
    setMsg("editMsg", `✅ נמחק מה־DB (Activity ${deletedId}).`, "ok");

    clearEdit();
    await doSearch();

    // verify quickly by searching by ID
    const qs = new URLSearchParams({ activityId: String(deletedId), take: "5" });
    const check = await httpJson(`${EP().search}?${qs.toString()}`).catch(() => []);
    if (Array.isArray(check) && check.length > 0) {
      setMsg("searchMsg", `⚠️ עדיין נמצאה פעילות ${deletedId} בחיפוש. אם השרת מחק באמת, אז החיפוש לא מסנן Cancelled/או יש cache.`, "err");
    } else {
      setMsg("searchMsg", `✅ אימות: פעילות ${deletedId} לא נמצאת יותר בחיפוש.`, "ok");
    }
  } catch (e) {
    setMsg("editMsg", "שגיאה במחיקה: " + (e.message || e), "err");
  } finally {
    $("btnDeleteActivity").disabled = false;
  }
}

function wireUi() {
  $("btnSearch").addEventListener("click", () => doSearch());
  $("btnClearSearch").addEventListener("click", () => {
    $("sActivityId").value = "";
    $("sName").value = "";
    $("sType").value = "";
    setMsg("searchMsg", "", "");
    $("resultsBody").innerHTML = `<tr><td colspan="7" class="tiny">בצע חיפוש…</td></tr>`;
    clearEdit();
  });

  $("btnAddInst").addEventListener("click", addInstanceRow);
  $("btnSave").addEventListener("click", saveActivity);
  $("btnReload").addEventListener("click", () => selectedActivityId && loadForEdit(selectedActivityId));
  $("btnDeleteActivity").addEventListener("click", deleteActivityHard);

  $("btnLogoutHint").addEventListener("click", () => {
    setMsg("searchMsg", "אם אתה רואה 'לא מחובר' – פתח/י את מסך ההתחברות (OTP) ואז רענן/י את הדף.", "warn");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

(async function init() {
  $("apiBaseLabel").textContent = API_BASE;

  setDot("sessionDot", true);

  const isAdmin = await loadMeAndGate();
  if (!isAdmin) return;

  try {
    await loadLookups();
    wireUi();
    setMsg("searchMsg", "מוכן. בצע חיפוש כדי להתחיל.", "ok");
  } catch (e) {
    setMsg("searchMsg", "שגיאת אתחול: " + (e.message || e), "err");
  }
})();
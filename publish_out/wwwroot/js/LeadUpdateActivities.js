// LeadUpdateActivities.js
// ✅ Always show only activities the logged-in user LEADS (even if Admin)
// ✅ Admin can change LeadInstructorId; CourseManager/Lead cannot
// ✅ Does NOT override app CSS/theme

const $ = (id) => document.getElementById(id);

let API_BASE = ""; // auto detect
let MY_ID = null;
let ROLE = "";
let IS_ADMIN = false;
let IS_COURSE_MANAGER = false;
let allMyCourses = [];
let coursesByType = {};

function setMsg(id, text, kind = "") {
  const el = $(id);
  el.className = "msg" + (kind ? " " + kind : "");
  el.textContent = text || "";
}

function pad2(n){ return String(n).padStart(2,"0"); }
function fmtLocalInput(dt){
  if(!dt) return "";
  const d = new Date(dt);
  return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate()) + "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}
function fmtNice(dt){
  if(!dt) return "-";
  const d = new Date(dt);
  return pad2(d.getDate()) + "/" + pad2(d.getMonth()+1) + "/" + d.getFullYear() + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}
function toUtcIsoFromLocalInput(v){ return new Date(v).toISOString(); }
function esc(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Accept":"application/json", ...(opts.headers || {}) },
    ...opts
  });

  if (!res.ok) {
    const t = await res.text().catch(()=> "");
    throw new Error(`${res.status} ${t}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  return null;
}

function endpoints(){
  return {
    me: `${API_BASE}/me`,
    activityTypes: `${API_BASE}/activity-types`,
    coursesByType: (typeId) => `${API_BASE}/courses/by-type/${encodeURIComponent(typeId)}`,
    instructorsByCourse: (courseId) => `${API_BASE}/instructors/by-course/${encodeURIComponent(courseId)}`,

    search: (qs) => `${API_BASE}/lead/activities?${qs}`,
    getEdit: (id) => `${API_BASE}/lead/activities/${encodeURIComponent(id)}`,
    putEdit: (id) => `${API_BASE}/activities/edit/${encodeURIComponent(id)}`
  };
}

async function detectApiBase(){
  // תואם למבנה שלך (יש מקומות שזה /api ויש /api/api)
  const basePath = new URL(".", window.location.href).pathname;
  const candidates = [
    `${window.location.origin}${basePath}api`,
    `${window.location.origin}${basePath}api/api`
  ];

  for (const cand of candidates) {
    try {
      const res = await fetch(cand + "/me", { credentials: "include" });
      if (res.ok) { API_BASE = cand; return; }
    } catch {}
  }
  API_BASE = candidates[0];
}

function applyThemeFromStorage(){
  // לא מתערבים ב-CSS שלך — רק אם יש אצלך data-theme/localStorage
  const saved = localStorage.getItem("theme") || localStorage.getItem("appTheme");
  if (!saved) return;

  // שני סגנונות נפוצים:
  document.documentElement.setAttribute("data-theme", saved);
  document.body.setAttribute("data-theme", saved);
}

function toggleTheme(){
  const cur =
    document.documentElement.getAttribute("data-theme") ||
    document.body.getAttribute("data-theme") ||
    localStorage.getItem("theme") ||
    "dark";

  const next = (cur === "dark") ? "light" : "dark";

  document.documentElement.setAttribute("data-theme", next);
  document.body.setAttribute("data-theme", next);

  localStorage.setItem("theme", next);
  localStorage.setItem("appTheme", next);

  // אם ה-APP שלך מאזין לאירוע:
  window.dispatchEvent(new CustomEvent("themeChanged", { detail: { theme: next } }));
}

async function loadMe(){
  const me = await fetchJson(endpoints().me);

  MY_ID = me.instructorId ?? null;
  ROLE = (me.roleName || "").toString();

  const r = ROLE.toLowerCase();
  IS_ADMIN = r.includes("admin");
  IS_COURSE_MANAGER = r.includes("coursemanager") || r.includes("course_manager") || r.includes("lead");

  $("meLabel").textContent = me.fullName || me.email || "לא ידוע";

  // Hint ליד מדריך מוביל
  const hint = $("leadHint");
  if (!IS_ADMIN && IS_COURSE_MANAGER) {
    hint.textContent = "לרכז קורס השדה נעול למשתמש המחובר (וגם השרת כופה זאת).";
  } else if (IS_ADMIN) {
    hint.textContent = "Admin יכול לשנות מדריך מוביל.";
  } else {
    hint.textContent = "";
  }
}

async function fillSelect(el, items, valueKey, textKey, selectedValue, addAll=false) {
  el.innerHTML = "";
  if(addAll){
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "הכל";
    el.appendChild(o);
  }
  for(const it of items){
    const opt = document.createElement("option");
    opt.value = it[valueKey];
    opt.textContent = it[textKey];
    if(selectedValue != null && String(opt.value) === String(selectedValue)) opt.selected = true;
    el.appendChild(opt);
  }
}

async function loadTypes(){
  const types = await fetchJson(endpoints().activityTypes);
  await fillSelect($("eType"), types, "activityTypeId", "typeName", null, false);
  return types;
}

function populateSearchTypes(allTypes) {
  const relevant = allTypes.filter(t => coursesByType[t.activityTypeId]?.length > 0);
  const sel = $("sType");
  sel.innerHTML = '<option value="">כל הסוגים</option>' +
    relevant.map(t => `<option value="${t.activityTypeId}">${esc(t.typeName)}</option>`).join('');
}

function populateSearchCourses(typeId) {
  const list = typeId ? (coursesByType[typeId] || []) : allMyCourses;
  const sel = $("sCourse");
  sel.innerHTML = '<option value="">הכל</option>' +
    list.map(c => `<option value="${c.courseId}">${esc(c.courseName)}</option>`).join('');
}

async function loadMyCourses(allTypes) {
  allMyCourses = await fetchJson(`${API_BASE}/lead/my-courses`) || [];
  coursesByType = {};
  for (const c of allMyCourses) {
    const tid = c.activityTypeId;
    if (tid) {
      if (!coursesByType[tid]) coursesByType[tid] = [];
      coursesByType[tid].push(c);
    }
  }
  populateSearchTypes(allTypes);
  populateSearchCourses(null);
}

function buildScopedSearchParams() {
  const qs = new URLSearchParams();
  if (MY_ID) qs.set("leadInstructorId", String(MY_ID));
  qs.set("take", "200");
  return qs;
}

function renderResults(rows){
  const tb = $("resultsBody");
  tb.innerHTML = rows.map(r => `
    <tr>
      <td>${r.activityId}</td>
      <td>${esc(r.activityName)}</td>
      <td>${esc(r.typeName)}</td>
      <td>${esc(r.courseName || "-")}</td>
      <td>${r.nextStartUtc ? esc(fmtNice(r.nextStartUtc)) : "-"}</td>
      <td><button class="btn btn-secondary pick" data-id="${r.activityId}" type="button">בחר</button></td>
    </tr>
  `).join("");

  tb.querySelectorAll(".pick").forEach(btn => {
    btn.addEventListener("click", () => pickActivity(Number(btn.dataset.id)));
  });
}

async function doSearch(){
  setMsg("searchMsg", "מחפש…");
  $("resultsBody").innerHTML = "";

  const activityId = Number($("sActivityId").value || "0") || null;
  const name = ($("sName").value || "").trim();
  const typeId = $("sType").value ? Number($("sType").value) : null;
  const courseId = $("sCourse").value ? Number($("sCourse").value) : null;

  const qs = buildScopedSearchParams();

  if(activityId) qs.set("activityId", String(activityId));
  if(name) qs.set("name", name);
  if(typeId) qs.set("activityTypeId", String(typeId));
  if(courseId) qs.set("courseId", String(courseId));

  const rows = await fetchJson(endpoints().search(qs.toString()));
  renderResults(Array.isArray(rows) ? rows : []);
  setMsg("searchMsg", `מוצגות ${rows.length} פעילויות שאני מרכז`, "ok");
}

async function showMine(){
  $("sActivityId").value = "";
  $("sName").value = "";
  $("sType").value = "";
  populateSearchCourses(null);

  setMsg("searchMsg", "טוען את הפעילויות שלי…");
  $("resultsBody").innerHTML = "";

  const qs = buildScopedSearchParams();
  const rows = await fetchJson(endpoints().search(qs.toString()));
  renderResults(Array.isArray(rows) ? rows : []);
  setMsg("searchMsg", `מוצגות ${rows.length} פעילויות שאני מרכז`, "ok");
}

// ========= Edit =========
let selectedActivityId = null;

function instRow(inst){
  const startVal = inst?.startUtc ? fmtLocalInput(inst.startUtc) : "";
  const endVal   = inst?.endUtc ? fmtLocalInput(inst.endUtc) : "";
  const roomsVal = inst?.roomsCount ?? 0;
  const reqVal   = inst?.requiredInstructors ?? 0;

  return `
    <div class="instCard">
      <div class="instGrid">
        <div class="form-group">
          <label>התחלה</label>
          <input class="input inst-start" type="datetime-local" value="${startVal}">
        </div>
        <div class="form-group">
          <label>סיום</label>
          <input class="input inst-end" type="datetime-local" value="${endVal}">
        </div>
        <div class="form-group">
          <label>כמות חדרים</label>
          <input class="input inst-rooms" type="number" min="0" value="${roomsVal}">
        </div>
        <div class="form-group">
          <label>נדרשים מדריכים</label>
          <input class="input inst-req" type="number" min="0" value="${reqVal}">
        </div>
        <div class="form-group">
          <label>&nbsp;</label>
          <button class="btn btn-danger inst-del" type="button">מחק</button>
        </div>
      </div>
    </div>
  `;
}

function readInstances(){
  const cards = Array.from($("instWrap").querySelectorAll(".instCard"));
  const out = [];
  for(const c of cards){
    const s = c.querySelector(".inst-start").value;
    const e = c.querySelector(".inst-end").value;
    const rooms = Number(c.querySelector(".inst-rooms").value || "0");
    const req = Number(c.querySelector(".inst-req").value || "0");
    if(!s || !e) continue;
    out.push({
      startUtc: toUtcIsoFromLocalInput(s),
      endUtc: toUtcIsoFromLocalInput(e),
      roomsCount: rooms,
      requiredInstructors: req
    });
  }
  return out;
}

function applyLeadFieldPolicy(){
  const el = $("eLead");
  if (!el) return;

  // ✅ Admin יכול לשנות
  if (IS_ADMIN) {
    el.disabled = false;
    return;
  }

  // ✅ CourseManager/Lead נעול לעצמו
  if (IS_COURSE_MANAGER && MY_ID) {
    el.value = String(MY_ID);
    el.disabled = true;
    return;
  }

  el.disabled = false;
}

async function pickActivity(id){
  selectedActivityId = id;
  $("selectedPill").textContent = `נבחרה פעילות #${id}`;
  setMsg("editMsg", "טוען פעילות…");

  // השרת גם כופה הרשאות, אבל פה נוח
  const a = await fetchJson(endpoints().getEdit(id));

  $("eName").value = a.activityName || "";
  $("eDeadline").value = a.applicationDeadlineUtc ? fmtLocalInput(a.applicationDeadlineUtc) : "";
  $("eType").value = String(a.activityTypeId);

  const courses = await fetchJson(endpoints().coursesByType(a.activityTypeId));
  await fillSelect($("eCourse"), courses, "courseId", "courseName", a.courseId);

  const inst = await fetchJson(endpoints().instructorsByCourse(a.courseId));
  await fillSelect($("eLead"), inst, "instructorId", "fullName", a.leadInstructorId);

  $("instWrap").innerHTML = (a.instances || []).map(x => instRow(x)).join("");

  applyLeadFieldPolicy();
  setMsg("editMsg", "", "ok");
}

async function onEditTypeChange(){
  const typeId = Number($("eType").value || "0");
  if(!typeId) return;

  const courses = await fetchJson(endpoints().coursesByType(typeId));
  await fillSelect($("eCourse"), courses, "courseId", "courseName", courses[0]?.courseId ?? null);
  await onEditCourseChange();
}

async function onEditCourseChange(){
  const courseId = Number($("eCourse").value || "0");
  if(!courseId) return;

  const inst = await fetchJson(endpoints().instructorsByCourse(courseId));
  await fillSelect($("eLead"), inst, "instructorId", "fullName", inst[0]?.instructorId ?? null);

  applyLeadFieldPolicy();
}

async function saveUpdate(){
  if(!selectedActivityId){
    setMsg("editMsg", "בחר פעילות מהרשימה לפני שמירה.", "err");
    return;
  }

  const payload = {
    activityName: ($("eName").value || "").trim(),
    activityTypeId: Number($("eType").value || "0"),
    courseId: Number($("eCourse").value || "0"),
    leadInstructorId: Number($("eLead").value || "0"),
    applicationDeadlineUtc: $("eDeadline").value ? toUtcIsoFromLocalInput($("eDeadline").value) : null,
    instances: readInstances()
  };

  // ✅ אם אני CourseManager/Lead – כפה את עצמי (כמו השרת)
  if (!IS_ADMIN && IS_COURSE_MANAGER && MY_ID) {
    payload.leadInstructorId = Number(MY_ID);
  }

  setMsg("editMsg", "שומר…");
  await fetchJson(endpoints().putEdit(selectedActivityId), {
    method: "PUT",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });

  setMsg("editMsg", "נשמר ✅", "ok");
  await doSearch();
}

// ========= init =========
(function init(){
  // theme
  applyThemeFromStorage();
  $("themeToggle")?.addEventListener("click", toggleTheme);

  $("btnSearch").addEventListener("click", () => doSearch().catch(e => setMsg("searchMsg", e.message, "err")));
  $("btnShowMine").addEventListener("click", () => showMine().catch(e => setMsg("searchMsg", e.message, "err")));
  $("btnClearSearch").addEventListener("click", () => {
    $("sActivityId").value = "";
    $("sName").value = "";
    $("sType").value = "";
    populateSearchCourses(null);
    $("resultsBody").innerHTML = "";
    setMsg("searchMsg", "");
  });
  $("sType").addEventListener("change", () => {
    const typeId = $("sType").value ? Number($("sType").value) : null;
    populateSearchCourses(typeId);
  });

  $("eType").addEventListener("change", () => onEditTypeChange().catch(e => setMsg("editMsg", e.message, "err")));
  $("eCourse").addEventListener("change", () => onEditCourseChange().catch(e => setMsg("editMsg", e.message, "err")));

  $("btnAddInst").addEventListener("click", () => {
    $("instWrap").insertAdjacentHTML("beforeend", instRow(null));
  });

  $("btnSave").addEventListener("click", () => saveUpdate().catch(e => setMsg("editMsg", e.message, "err")));

  $("instWrap").addEventListener("click", (ev) => {
    const del = ev.target.closest(".inst-del");
    if(del) del.closest(".instCard").remove();
  });

  (async ()=>{
    await detectApiBase();
    await loadMe();
    const allTypes = await loadTypes();
    await loadMyCourses(allTypes);
    await showMine();
  })().catch(e => setMsg("searchMsg", e.message, "err"));
})();

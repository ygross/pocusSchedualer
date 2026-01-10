// UpdateActivities.js (fix: auto-detect api vs api/api)

const APP_PATH = new URL(".", window.location.href).pathname; // ends with '/'

// שני מועמדים: אצלך לעיתים עובד רק api/api
const API_CANDIDATES = [
  `${window.location.origin}${APP_PATH}api`,
  `${window.location.origin}${APP_PATH}api/api`
];

let API_BASE = API_CANDIDATES[0];

const $ = (id) => document.getElementById(id);

function setMsg(elId, text, kind = "") {
  const el = $(elId);
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

async function fetchTryJson(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Accept":"application/json", ...(opts.headers || {}) },
    ...opts
  });
  return res;
}

async function httpJson(url, opts = {}) {
  const res = await fetchTryJson(url, opts);
  if (!res.ok) {
    const t = await res.text().catch(()=> "");
    throw new Error(String(res.status) + " " + t);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  return null;
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

function EP() {
  return {
    me: `${API_BASE}/me`,
    activityTypes: `${API_BASE}/activity-types`,
    coursesByType: (typeId) => `${API_BASE}/courses/by-type/${encodeURIComponent(typeId)}`,
    instructorsByCourse: (courseId) => `${API_BASE}/instructors/by-course/${encodeURIComponent(courseId)}`,

    search: (qs) => `${API_BASE}/activities/search?${qs}`,
    getEdit: (id) => `${API_BASE}/activities/edit/${encodeURIComponent(id)}`,
    putEdit: (id) => `${API_BASE}/activities/edit/${encodeURIComponent(id)}`
  };
}

// ---------- Instances UI ----------
function instRow(inst){
  const startVal = inst?.startUtc ? fmtLocalInput(inst.startUtc) : "";
  const endVal   = inst?.endUtc ? fmtLocalInput(inst.endUtc) : "";
  const roomsVal = inst?.roomsCount ?? 0;
  const reqVal   = inst?.requiredInstructors ?? 0;

  return `
    <div class="instCard">
      <div class="instGrid">
        <div>
          <label>התחלה</label>
          <input class="input inst-start" type="datetime-local" value="${startVal}">
        </div>
        <div>
          <label>סיום</label>
          <input class="input inst-end" type="datetime-local" value="${endVal}">
        </div>
        <div>
          <label>כמות חדרים</label>
          <input class="input inst-rooms" type="number" min="0" value="${roomsVal}">
        </div>
        <div>
          <label>נדרשים מדריכים</label>
          <input class="input inst-req" type="number" min="0" value="${reqVal}">
        </div>
        <div>
          <button class="btn danger inst-del" type="button">מחק</button>
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

// ---------- Render results ----------
function renderResults(rows){
  const tb = $("resultsBody");
  tb.innerHTML = rows.map(r => `
    <tr>
      <td>${r.activityId}</td>
      <td>${esc(r.activityName)}</td>
      <td>${esc(r.typeName)}</td>
      <td>${esc(r.courseName || "-")}</td>
      <td>${r.nextStartUtc ? esc(fmtNice(r.nextStartUtc)) : "-"}</td>
      <td><button class="btn light pick" data-id="${r.activityId}" type="button">בחר</button></td>
    </tr>
  `).join("");

  tb.querySelectorAll(".pick").forEach(btn => {
    btn.addEventListener("click", () => pickActivity(Number(btn.dataset.id)));
  });
}

// ---------- Auto-detect API base ----------
async function detectApiBase(){
  // ננסה לקרוא activity-types מכל מועמד. הראשון שעונה 200 הוא ה־API_BASE
  for(const cand of API_CANDIDATES){
    const testUrl = `${cand}/activity-types`;
    const res = await fetchTryJson(testUrl);
    if(res.ok){
      API_BASE = cand;
      $("apiBaseLabel").textContent = API_BASE;
      return;
    }
  }
  // אם אף אחד לא עובד, נציג הודעה עם שני הניסיונות
  $("apiBaseLabel").textContent = API_BASE;
  setMsg("searchMsg", `לא נמצא API תקין. ניסיתי: ${API_CANDIDATES.join(" , ")}`, "err");
}

// ---------- Load header + types ----------
async function loadHeader(){
  $("apiBaseLabel").textContent = API_BASE;
  try{
    const me = await httpJson(EP().me);
    $("meLine").textContent = "משתמש: " + (me.fullName || me.email || "לא ידוע");
    $("roleLine").textContent = "תפקיד: " + (me.roleName || "-");
  }catch{
    $("meLine").textContent = "משתמש: לא מחובר";
    $("roleLine").textContent = "תפקיד: -";
  }
}

async function loadTypes(){
  const types = await httpJson(EP().activityTypes);
  await fillSelect($("sType"), types, "activityTypeId", "typeName", null, true);
  await fillSelect($("eType"), types, "activityTypeId", "typeName", null, false);
}

// ---------- Search / show all ----------
async function doSearch(){
  setMsg("searchMsg", "מחפש…");
  $("resultsBody").innerHTML = "";

  const activityId = Number($("sActivityId").value || "0") || null;
  const name = ($("sName").value || "").trim();
  const typeId = $("sType").value ? Number($("sType").value) : null;

  const qs = new URLSearchParams();
  if(activityId) qs.set("activityId", String(activityId));
  if(name) qs.set("name", name);
  if(typeId) qs.set("activityTypeId", String(typeId));
  qs.set("take", "200");

  const rows = await httpJson(EP().search(qs.toString()));
  renderResults(Array.isArray(rows) ? rows : []);
  setMsg("searchMsg", "נמצאו " + rows.length + " תוצאות", "ok");
}

async function showAll(){
  $("sActivityId").value = "";
  $("sName").value = "";
  $("sType").value = "";

  setMsg("searchMsg", "טוען את כל הפעילויות…");
  $("resultsBody").innerHTML = "";

  const qs = new URLSearchParams();
  qs.set("take", "200");

  const rows = await httpJson(EP().search(qs.toString()));
  renderResults(Array.isArray(rows) ? rows : []);
  setMsg("searchMsg", "מוצגות " + rows.length + " פעילויות", "ok");
}

// ---------- Pick + edit ----------
let selectedActivityId = null;

async function pickActivity(id){
  selectedActivityId = id;
  $("selectedPill").textContent = "נבחרה פעילות #" + id;
  setMsg("editMsg", "טוען פעילות…");

  const a = await httpJson(EP().getEdit(id));

  $("eName").value = a.activityName || "";
  $("eDeadline").value = a.applicationDeadlineUtc ? fmtLocalInput(a.applicationDeadlineUtc) : "";
  $("eType").value = String(a.activityTypeId);

  const courses = await httpJson(EP().coursesByType(a.activityTypeId));
  await fillSelect($("eCourse"), courses, "courseId", "courseName", a.courseId);

  const inst = await httpJson(EP().instructorsByCourse(a.courseId));
  await fillSelect($("eLead"), inst, "instructorId", "fullName", a.leadInstructorId);

  $("instWrap").innerHTML = (a.instances || []).map(x => instRow(x)).join("");
  setMsg("editMsg", "", "ok");
}

async function onEditTypeChange(){
  const typeId = Number($("eType").value || "0");
  if(!typeId) return;

  const courses = await httpJson(EP().coursesByType(typeId));
  await fillSelect($("eCourse"), courses, "courseId", "courseName", courses[0]?.courseId ?? null);
  await onEditCourseChange();
}

async function onEditCourseChange(){
  const courseId = Number($("eCourse").value || "0");
  if(!courseId) return;

  const inst = await httpJson(EP().instructorsByCourse(courseId));
  await fillSelect($("eLead"), inst, "instructorId", "fullName", inst[0]?.instructorId ?? null);
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

  setMsg("editMsg", "שומר עדכון…");

  await httpJson(EP().putEdit(selectedActivityId), {
    method: "PUT",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });

  setMsg("editMsg", "נשמר בהצלחה ✅", "ok");
  await doSearch();
}

// ---------- Init ----------
(function init(){
  $("btnSearch").addEventListener("click", () => doSearch().catch(e => setMsg("searchMsg", e.message, "err")));
  $("btnShowAll").addEventListener("click", () => showAll().catch(e => setMsg("searchMsg", e.message, "err")));
  $("btnClearSearch").addEventListener("click", () => {
    $("sActivityId").value = "";
    $("sName").value = "";
    $("sType").value = "";
    $("resultsBody").innerHTML = "";
    setMsg("searchMsg", "");
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
    await detectApiBase();     // ✅ פה התיקון העיקרי
    await loadHeader();
    await loadTypes();         // ✅ עכשיו הפילטר יתמלא
    await showAll();           // ✅ עכשיו תראה רשימה
  })().catch(e => setMsg("searchMsg", e.message, "err"));
})();

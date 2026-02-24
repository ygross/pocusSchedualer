// =====================================================
// adminAddActivities.js (v3) - FULL WORKING
// - Preview builds occurrences and renders to table
// - Clear occurrences
// - Save activity + instances
// - Theme toggle (light/dark) saved in localStorage
// =====================================================

const _APP_PATH2 = new URL(".", window.location.href).pathname;
const API_BASE = `${window.location.origin}${_APP_PATH2}api`;
let occurrences = [];

document.addEventListener("DOMContentLoaded", initPage);

async function initPage() {
  // Header
  const apiEl = document.getElementById("apiBase");
  if (apiEl) apiEl.textContent = API_BASE;

  initThemeToggle();

  // Load real user from session
  try {
    const meRes = await fetch(`${API_BASE}/me`, { credentials: "include" });
    if (meRes.ok) {
      const me = await meRes.json();
      setText("meName", me.fullName || me.email || "");
      setText("meRole", me.roleName || me.role || "");
      setText("otpRoleInline", me.roleName || me.role || "");
      setDot("dotSession", "ok");
    } else {
      setDot("dotSession", "bad");
    }
  } catch {
    setDot("dotSession", "bad");
  }

  // Wire events
  const selType   = document.getElementById("activityType");
  const selCourse = document.getElementById("course");

  byId("btnPreview")?.addEventListener("click", buildOccurrences);
  byId("btnClearInstances")?.addEventListener("click", clearOccurrences);
  byId("btnSave")?.addEventListener("click", saveActivityAndInstances);

  selType?.addEventListener("change", loadCourses);
  selCourse?.addEventListener("change", loadInstructors);

  const chkMulti = byId("multiPerWeek");
  const startDateInput = byId("startDate");

  chkMulti?.addEventListener("change", () => {
    const panel = byId("multiDaysPanel");
    if (panel) panel.style.display = chkMulti.checked ? "block" : "none";
    if (chkMulti.checked) syncStartDateToMultiDays();
  });

  startDateInput?.addEventListener("change", () => {
    if (chkMulti?.checked) syncStartDateToMultiDays();
  });

  await loadActivityTypes();
  renderOccurrences(); // init table empty
}

/* ------------------ helpers ------------------ */
function byId(id){ return document.getElementById(id); }
function setText(id, txt){ const el = byId(id); if (el) el.textContent = txt; }

function showMsg(text, isError) {
  const ok  = byId("msgOk");
  const err = byId("msgErr");
  if (ok) { ok.style.display = "none"; ok.textContent = ""; }
  if (err){ err.style.display = "none"; err.textContent = ""; }

  if (!text) return;
  if (isError) {
    if (err) { err.textContent = text; err.style.display = "block"; }
  } else {
    if (ok)  { ok.textContent  = text; ok.style.display  = "block"; }
  }
}

function setDot(id, state) {
  const el = byId(id);
  if (!el) return;
  el.classList.remove("is-ok", "is-warn", "is-bad");
  if (state === "ok") el.classList.add("is-ok");
  else if (state === "bad") el.classList.add("is-bad");
  else el.classList.add("is-warn");
}

function parseTimeHHMM(s){
  const parts = String(s||"").split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  if (isNaN(h) || isNaN(m)) return null;
  return {h, m};
}

function isoDate(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const dd= String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}

function dayNameHe(jsDay){
  return ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"][jsDay] ?? "";
}

/* ------------------ THEME ------------------ */
function initThemeToggle() {
  const btn = byId("themeToggle");
  const root = document.documentElement;

  function apply(mode) {
    root.setAttribute("data-theme", mode);
    localStorage.setItem("theme", mode);
    if (btn) btn.textContent = (mode === "light") ? "🌞" : "🌙";
  }

  const saved = localStorage.getItem("theme") || "dark";
  apply(saved);

  if (btn) {
    btn.addEventListener("click", () => {
      const cur = root.getAttribute("data-theme") || "dark";
      apply(cur === "dark" ? "light" : "dark");
    });
  }
}

/* ========== auto check weekday for multi-days ========== */
function syncStartDateToMultiDays() {
  const startDateStr = byId("startDate")?.value;
  if (!startDateStr) return;

  const d = new Date(startDateStr + "T00:00:00");
  if (isNaN(d.getTime())) return;

  const jsDay = d.getDay(); // 0..6
  if (jsDay < 0 || jsDay > 4) return; // only Sun-Thu

  const cb = document.querySelector(`input[name='weekDaysMulti'][value='${jsDay}']`);
  if (cb) cb.checked = true;
}

/* ========== 1) Activity types ========== */
async function loadActivityTypes() {
  const selType   = byId("activityType");
  const selCourse = byId("course");
  const selInstr  = byId("instructor");

  if (!selType) return;

  selType.innerHTML   = "<option value=''>טוען סוגי פעילות…</option>";
  if (selCourse) { selCourse.innerHTML = "<option value=''>בחר רמה קודם…</option>"; selCourse.disabled = true; }
  if (selInstr)  { selInstr.innerHTML  = "<option value=''>בחר קורס קודם…</option>"; selInstr.disabled  = true; }

  try {
    const resp = await fetch(`${API_BASE}/activity-types`, { cache: "no-cache", credentials: "include" });
    if (!resp.ok) {
      setDot("dotApi", "bad");
      selType.innerHTML = "<option value=''>שגיאה בטעינת סוגי פעילות</option>";
      return;
    }
    setDot("dotApi", "ok");

    const list = await resp.json();
    if (!Array.isArray(list) || list.length === 0) {
      selType.innerHTML = "<option value=''>אין סוגי פעילות</option>";
      return;
    }

    selType.innerHTML = "<option value=''>בחר רמה…</option>";
    for (const t of list) {
      const id   = t.ActivityTypeId ?? t.activityTypeId;
      const name = t.TypeName       ?? t.typeName;
      if (id == null || !name) continue;
      const opt = document.createElement("option");
      opt.value = String(id);
      opt.textContent = name;
      selType.appendChild(opt);
    }
  } catch (e) {
    console.error(e);
    setDot("dotApi", "bad");
    selType.innerHTML = "<option value=''>שגיאה בטעינת סוגי פעילות</option>";
  }
}

/* ========== 2) Courses ========== */
async function loadCourses() {
  const typeId    = byId("activityType")?.value;
  const selCourse = byId("course");
  const selInstr  = byId("instructor");

  if (selInstr) { selInstr.innerHTML = "<option value=''>בחר קורס קודם…</option>"; selInstr.disabled = true; }

  if (!selCourse) return;

  if (!typeId) {
    selCourse.innerHTML = "<option value=''>בחר רמה קודם…</option>";
    selCourse.disabled = true;
    return;
  }

  selCourse.disabled = true;
  selCourse.innerHTML = "<option value=''>טוען קורסים…</option>";

  try {
    const resp = await fetch(`${API_BASE}/courses/by-type/${encodeURIComponent(typeId)}`, { cache: "no-cache", credentials: "include" });
    if (!resp.ok) {
      selCourse.innerHTML = "<option value=''>שגיאה בטעינת קורסים</option>";
      return;
    }

    const list = await resp.json();
    if (!Array.isArray(list) || list.length === 0) {
      selCourse.innerHTML = "<option value=''>אין קורסים לרמה זו</option>";
      return;
    }

    selCourse.innerHTML = "<option value=''>בחר קורס…</option>";
    for (const c of list) {
      const id   = c.CourseId   ?? c.courseId;
      const name = c.CourseName ?? c.courseName;
      if (id == null || !name) continue;
      const opt = document.createElement("option");
      opt.value = String(id);
      opt.textContent = name;
      selCourse.appendChild(opt);
    }
    selCourse.disabled = false;
  } catch (e) {
    console.error(e);
    selCourse.innerHTML = "<option value=''>שגיאה בטעינת קורסים</option>";
  }
}

/* ========== 3) Instructors ========== */
async function loadInstructors() {
  const courseId = byId("course")?.value;
  const selInstr = byId("instructor");
  if (!selInstr) return;

  if (!courseId) {
    selInstr.innerHTML = "<option value=''>בחר קורס קודם…</option>";
    selInstr.disabled = true;
    return;
  }

  selInstr.disabled = true;
  selInstr.innerHTML = "<option value=''>טוען מדריכים…</option>";

  try {
    const resp = await fetch(`${API_BASE}/instructors/by-course/${encodeURIComponent(courseId)}`, { cache: "no-cache", credentials: "include" });
    if (!resp.ok) {
      selInstr.innerHTML = "<option value=''>שגיאה בטעינת מדריכים</option>";
      return;
    }

    const list = await resp.json();
    if (!Array.isArray(list) || list.length === 0) {
      selInstr.innerHTML = "<option value=''>אין מדריכים לקורס זה</option>";
      return;
    }

    selInstr.innerHTML = "<option value=''>בחר מדריך…</option>";
    for (const i of list) {
      const id    = i.InstructorId ?? i.instructorId;
      const name  = i.FullName     ?? i.fullName;
      const email = i.Email        ?? i.email;
      if (id == null || !name) continue;
      const opt = document.createElement("option");
      opt.value = String(id);
      opt.textContent = email ? `${name} (${email})` : name;
      selInstr.appendChild(opt);
    }
    selInstr.disabled = false;
  } catch (e) {
    console.error(e);
    selInstr.innerHTML = "<option value=''>שגיאה בטעינת מדריכים</option>";
  }
}

/* =====================================================
   PREVIEW (זה מה שהיה חסר)
   ===================================================== */
function buildOccurrences() {
  showMsg("", false);

  const startDateStr = byId("startDate")?.value;
  const startHourStr = byId("startHour")?.value;
  const endHourStr   = byId("endHour")?.value;
  const repeatMode   = byId("repeatMode")?.value || "none";
  const repeatCount  = parseInt(byId("repeatCount")?.value || "1", 10);
  const roomsCount   = parseInt(byId("roomsCount")?.value || "1", 10);
  const reqInstr     = parseInt(byId("reqInstructors")?.value || "1", 10);

  const multi = !!byId("multiPerWeek")?.checked;
  const selectedDays = Array.from(document.querySelectorAll("input[name='weekDaysMulti']:checked"))
    .map(cb => parseInt(cb.value, 10))
    .filter(n => !isNaN(n))
    .sort((a,b)=>a-b);

  if (!startDateStr) return showMsg("יש לבחור תאריך התחלה", true);
  const baseDate = new Date(startDateStr + "T00:00:00");
  if (isNaN(baseDate.getTime())) return showMsg("תאריך התחלה לא תקין", true);

  const st = parseTimeHHMM(startHourStr);
  const en = parseTimeHHMM(endHourStr);
  if (!st || !en) return showMsg("שעות לא תקינות", true);

  if (repeatCount < 1) return showMsg("מספר חזרות חייב להיות לפחות 1", true);

  if (multi) {
    if (repeatMode !== "weekly") return showMsg("מופעים מרובים באותו שבוע אפשריים רק בחזרתיות שבועית", true);
    if (!selectedDays.length) return showMsg("בחר לפחות יום אחד (א׳–ה׳)", true);
  }

  // reset
  occurrences = [];

  function pushOcc(dateObj){
    const start = new Date(dateObj);
    start.setHours(st.h, st.m, 0, 0);

    const end = new Date(dateObj);
    end.setHours(en.h, en.m, 0, 0);

    // sanity: end must be after start (same day)
    if (end <= start) {
      // allow crossing midnight? לא כרגע
      return;
    }

    occurrences.push({
      startUtc: start,
      endUtc: end,
      roomsCount,
      requiredInstructors: reqInstr
    });
  }

  if (multi) {
    // week start (Sunday) of base date
    const weekStart = new Date(baseDate);
    const jsDow = weekStart.getDay(); // 0=Sun
    weekStart.setDate(weekStart.getDate() - jsDow);

    for (let w=0; w<repeatCount; w++){
      for (const dayOfWeek of selectedDays){
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + w*7 + dayOfWeek);
        pushOcc(d);
      }
    }
  } else {
    for (let i=0; i<repeatCount; i++){
      const d = new Date(baseDate);
      if (repeatMode === "weekly") d.setDate(d.getDate() + i*7);
      else if (repeatMode === "monthly") d.setMonth(d.getMonth() + i);
      // none => same date
      pushOcc(d);
    }
  }

  // sort by start
  occurrences.sort((a,b)=>a.startUtc - b.startUtc);

  renderOccurrences();
  showMsg("Preview נוצר בהצלחה", false);
}

/* ===== render table ===== */
function renderOccurrences(){
  const tbody = byId("instancesBody");
  const counter = byId("instancesCounter");
  if (!tbody) return;

  tbody.innerHTML = "";

  occurrences.forEach((occ, idx) => {
    const start = occ.startUtc;
    const end   = occ.endUtc;

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${isoDate(start)}</td>
      <td>${dayNameHe(start.getDay())}</td>
      <td>${start.toTimeString().slice(0,5)} - ${end.toTimeString().slice(0,5)}</td>
      <td>${occ.roomsCount}</td>
      <td>${occ.requiredInstructors}</td>
      <td><button type="button" class="btn-x" data-idx="${idx}">X</button></td>
    `;
    tbody.appendChild(tr);
  });

  if (counter) counter.textContent = `${occurrences.length} מופעים`;

  tbody.querySelectorAll("button.btn-x").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.getAttribute("data-idx"), 10);
      if (!isNaN(i)) {
        occurrences.splice(i, 1);
        renderOccurrences();
      }
    });
  });
}

/* ===== clear ===== */
function clearOccurrences(){
  occurrences = [];
  renderOccurrences();
  showMsg("כל המופעים נוקו", false);
}

/* =====================================================
   SAVE
   ===================================================== */
async function saveActivityAndInstances() {
  showMsg("", false);

  const activityTypeId = byId("activityType")?.value;
  const courseId = byId("course")?.value;
  const leadInstructorId = byId("instructor")?.value;
  const activityName = (byId("activityName")?.value || "").trim();
  const deadlineVal = byId("deadline")?.value || "";

  if (!activityTypeId || !courseId || !leadInstructorId || !activityName) {
    return showMsg("חובה לבחור רמה, קורס, מדריך ולהזין שם פעילות", true);
  }
  if (!occurrences.length) {
    return showMsg("אין מופעים לשמירה. לחץ Preview קודם.", true);
  }

  const payload = {
    activityName,
    activityTypeId: Number(activityTypeId),
    courseId: Number(courseId),
    leadInstructorId: Number(leadInstructorId),
    applicationDeadlineUtc: deadlineVal ? new Date(deadlineVal).toISOString() : null,
    instances: occurrences.map(o => ({
      startUtc: o.startUtc.toISOString(),
      endUtc: o.endUtc.toISOString(),
      roomsCount: o.roomsCount,
      requiredInstructors: o.requiredInstructors
    }))
  };

  try {
    const resp = await fetch(`${API_BASE}/activities`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      credentials: "include",
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(()=> "");
      console.error("SAVE ERROR:", resp.status, txt);
      setDot("dotDb", "bad");
      return showMsg("שגיאה בשמירה ל-API", true);
    }

    setDot("dotDb", "ok");
    showMsg("הפעילות והמופעים נשמרו בהצלחה", false);

    occurrences = [];
    renderOccurrences();

  } catch (e) {
    console.error(e);
    setDot("dotDb", "bad");
    showMsg("שגיאה בשמירה ל-API", true);
  }
}

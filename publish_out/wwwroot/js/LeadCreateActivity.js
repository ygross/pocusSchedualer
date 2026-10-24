const _dir    = window.location.pathname.replace(/\/[^\/]*$/, "");
const API_BASE = `${window.location.origin}${_dir}/api/api`;

const $ = id => document.getElementById(id);

// ── helpers ────────────────────────────────────────────────
async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Accept": "application/json", ...(opts.headers || {}) },
    ...opts
  });
  if (res.status === 401) { window.top.location.href = `${_dir}/login-otp.html`; return null; }
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`${res.status} ${t}`.trim()); }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : null;
}

function setMsg(id, text, kind) {
  const el = $(id);
  if (!el) return;
  el.className = "msg" + (kind ? " " + kind : "");
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
}

function localDtToUtcIso(val) {
  if (!val) return null;
  return new Date(val).toISOString();
}

function utcToLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── instances table ────────────────────────────────────────
let instSeq = 0;

function addInstanceRow(data = {}) {
  const id = ++instSeq;
  const tbody = $("instancesBody");
  const existingRows = tbody.querySelectorAll("tr").length;
  const tr = document.createElement("tr");
  tr.dataset.iid = id;
  tr.innerHTML = `
    <td>${existingRows + 1}</td>
    <td><input type="datetime-local" class="inst-start" value="${data.start || ""}" /></td>
    <td><input type="datetime-local" class="inst-end"   value="${data.end || ""}" /></td>
    <td><input type="number" class="inst-req" value="${data.req ?? 2}" min="1" max="99" /></td>
    <td><input type="number" class="inst-rooms" value="${data.rooms ?? 1}" min="0" max="50" /></td>
    <td><button class="btn btn-danger" type="button" data-remove="${id}">הסר</button></td>`;
  tbody.appendChild(tr);
  renumberRows();
}

function renumberRows() {
  $("instancesBody").querySelectorAll("tr").forEach((tr, i) => {
    tr.cells[0].textContent = i + 1;
  });
}

function readInstances() {
  const rows = $("instancesBody").querySelectorAll("tr");
  const result = [];
  for (const tr of rows) {
    const startVal = tr.querySelector(".inst-start")?.value;
    const endVal   = tr.querySelector(".inst-end")?.value;
    const req      = parseInt(tr.querySelector(".inst-req")?.value || "1", 10);
    const rooms    = parseInt(tr.querySelector(".inst-rooms")?.value || "0", 10);
    if (!startVal || !endVal) continue;
    result.push({
      startUtc: localDtToUtcIso(startVal),
      endUtc:   localDtToUtcIso(endVal),
      requiredInstructors: req,
      roomsCount: rooms
    });
  }
  return result;
}

// ── submit ─────────────────────────────────────────────────
async function submit() {
  setMsg("pageMsg", "");
  const name   = ($("fName").value || "").trim();
  const typeId = parseInt($("fType").value || "0", 10);
  const course = parseInt($("fCourse").value || "0", 10);
  const dead   = $("fDeadline").value;

  if (!name)   { setMsg("pageMsg", "חובה להזין שם פעילות.", "err"); return; }
  if (!typeId) { setMsg("pageMsg", "חובה לבחור סוג פעילות.", "err"); return; }
  if (!course) { setMsg("pageMsg", "חובה לבחור קורס.", "err"); return; }

  const instances = readInstances();
  if (!instances.length) { setMsg("instMsg", "הוסף לפחות מופע אחד.", "err"); return; }

  const badInst = instances.find(x => new Date(x.endUtc) <= new Date(x.startUtc));
  if (badInst) { setMsg("instMsg", "יש מופע שזמן הסיום שלו לפני ההתחלה.", "err"); return; }

  const payload = {
    activityName: name,
    activityTypeId: typeId,
    courseId: course,
    leadInstructorId: 0,
    applicationDeadlineUtc: dead ? localDtToUtcIso(dead) : null,
    instances
  };

  $("submitBtn").disabled = true;
  $("submitStatus").textContent = "שומר…";

  try {
    const r = await fetchJson(`${API_BASE}/lead/activities/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!r) return;
    $("submitStatus").textContent = "";
    setMsg("pageMsg", `✅ הפעילות נוצרה בהצלחה (ID: ${r.activityId})`, "ok");
    resetForm();
  } catch (e) {
    setMsg("pageMsg", "שגיאה: " + e.message, "err");
    $("submitStatus").textContent = "";
  } finally {
    $("submitBtn").disabled = false;
  }
}

function resetForm() {
  $("fName").value = "";
  $("fDeadline").value = "";
  $("fType").value = "";
  $("fCourse").innerHTML = "<option value=''>בחר סוג פעילות קודם</option>";
  $("fCourse").disabled = true;
  $("instancesBody").innerHTML = "";
  setMsg("instMsg", "");
  instSeq = 0;
}

// ── load dropdowns (scoped to lead's courses only) ─────────
let _myCourses = [];
let _coursesByType = {};

async function loadMyCourseDropdowns() {
  const [allTypes, myCourses] = await Promise.all([
    fetchJson(`${API_BASE}/activity-types`),
    fetchJson(`${API_BASE}/lead/my-courses`)
  ]);
  _myCourses = myCourses || [];
  _coursesByType = {};
  for (const c of _myCourses) {
    const tid = c.activityTypeId;
    if (tid) {
      if (!_coursesByType[tid]) _coursesByType[tid] = [];
      _coursesByType[tid].push(c);
    }
  }

  // Only show types the lead has courses in
  const relevant = (allTypes || []).filter(t => _coursesByType[t.activityTypeId]?.length > 0);
  const sel = $("fType");
  sel.innerHTML = "<option value=''>בחר סוג פעילות…</option>";
  relevant.forEach(t => {
    const o = document.createElement("option");
    o.value = t.activityTypeId;
    o.textContent = t.typeName;
    sel.appendChild(o);
  });

  // Auto-select if only one type
  if (relevant.length === 1) {
    sel.value = String(relevant[0].activityTypeId);
    onTypeChange();
  }
}

function onTypeChange() {
  const typeId = $("fType").value ? Number($("fType").value) : null;
  const sel = $("fCourse");
  if (!typeId) {
    sel.innerHTML = "<option value=''>בחר סוג פעילות קודם</option>";
    sel.disabled = true;
    return;
  }
  const courses = _coursesByType[typeId] || [];
  sel.innerHTML = "<option value=''>בחר קורס…</option>";
  courses.forEach(c => {
    const o = document.createElement("option");
    o.value = c.courseId;
    o.textContent = c.courseName;
    sel.appendChild(o);
  });
  sel.disabled = courses.length === 0;
  if (courses.length === 1) sel.value = String(courses[0].courseId);
}

// ── init ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // theme
  $("themeToggle")?.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    $("themeToggle").textContent = next === "dark" ? "🌙" : "☀️";
  });
  if (localStorage.getItem("theme") === "light") $("themeToggle").textContent = "☀️";

  // me
  try {
    const me = await fetchJson(`${API_BASE}/me`);
    if (me) {
      $("meName").textContent = me.fullName || me.email || "—";
      $("meRole").textContent = me.roleName || "—";
    }
  } catch { /* non-fatal */ }

  await loadMyCourseDropdowns();

  $("fType").addEventListener("change", () => { onTypeChange(); });

  $("addInstanceBtn").addEventListener("click", () => addInstanceRow());

  $("instancesBody").addEventListener("click", e => {
    const id = e.target?.dataset?.remove;
    if (!id) return;
    e.target.closest("tr").remove();
    renumberRows();
  });

  $("submitBtn").addEventListener("click", () => submit());

  // default: add one empty row
  addInstanceRow();
});

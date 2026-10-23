const _dir = window.location.pathname.replace(/\/[^\/]*$/, "");
const API  = `${window.location.origin}${_dir}/api/api`;

const $ = id => document.getElementById(id);

// ── state ──────────────────────────────────────────────────────────────────
let allInstructors = [];   // AdminCourseInstructorRowDto[]
let allCourses     = [];   // AdminCourseDto[]
let selectedCourseId = null;
let checked = new Set();   // InstructorIds currently checked

// ── helpers ────────────────────────────────────────────────────────────────
function esc(v) {
  return String(v ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function showMsg(text, type) {
  const el = $("msgBox");
  el.textContent = text;
  el.className = "msg " + type;
  el.style.display = "";
  if (type === "ok") setTimeout(() => { el.style.display = "none"; }, 3000);
}

function statusBadge(s) {
  const cls = s === "Active" ? "badge-active"
            : s === "Inactive" || s === "Disabled" ? "badge-inactive"
            : (s || "").startsWith("Pending") ? "badge-pending"
            : "badge-other";
  return `<span class="badge ${cls}">${esc(s)}</span>`;
}

function updateCounter() {
  const visible = [...document.querySelectorAll("#tbody tr[data-id]")]
    .filter(r => r.style.display !== "none");
  const visibleChecked = visible.filter(r => checked.has(+r.dataset.id)).length;
  $("counter").innerHTML =
    `<b>${checked.size}</b> מדריכים מסומנים מתוך <b>${allInstructors.length}</b>`;

  // master checkbox state
  const chkAll = $("chkAll");
  if (visible.length === 0) { chkAll.indeterminate = false; chkAll.checked = false; return; }
  if (visibleChecked === visible.length) { chkAll.checked = true; chkAll.indeterminate = false; }
  else if (visibleChecked === 0)         { chkAll.checked = false; chkAll.indeterminate = false; }
  else                                   { chkAll.indeterminate = true; }
}

// ── render table ───────────────────────────────────────────────────────────
function renderTable(filter) {
  const q = (filter || "").trim().toLowerCase();
  const tbody = $("tbody");

  const rows = allInstructors.map(inst => {
    const show = !q
      || (inst.fullName   || "").toLowerCase().includes(q)
      || (inst.email      || "").toLowerCase().includes(q)
      || (inst.department || "").toLowerCase().includes(q);

    const isChecked = checked.has(inst.instructorId);
    return { inst, show, isChecked };
  });

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">אין מדריכים במערכת</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(({ inst, show, isChecked }) => `
    <tr data-id="${inst.instructorId}" style="${show ? "" : "display:none"}">
      <td><input type="checkbox" data-id="${inst.instructorId}"
           ${isChecked ? "checked" : ""} /></td>
      <td>${esc(inst.fullName)}</td>
      <td style="color:var(--muted);font-size:13px">${esc(inst.email)}</td>
      <td style="color:var(--muted);font-size:13px">${esc(inst.department || "—")}</td>
      <td style="font-size:13px">${esc(inst.roleName || "—")}</td>
      <td>${statusBadge(inst.status)}</td>
    </tr>
  `).join("");

  // wire row checkboxes
  tbody.querySelectorAll("input[type=checkbox]").forEach(chk => {
    chk.addEventListener("change", () => {
      const id = +chk.dataset.id;
      if (chk.checked) checked.add(id); else checked.delete(id);
      updateCounter();
    });
  });

  updateCounter();
}

// ── load courses ────────────────────────────────────────────────────────────
async function loadCourses() {
  const res = await fetch(`${API}/admin/course-instructors/courses`, { credentials: "include" });
  if (!res.ok) throw new Error("טעינת קורסים נכשלה – " + res.status);
  allCourses = await res.json();

  const sel = $("courseSelect");
  allCourses
    .slice()
    .sort((a, b) => (a.courseName || "").localeCompare(b.courseName || "", "he"))
    .forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.courseId;
      opt.textContent = c.courseName;
      sel.appendChild(opt);
    });
}

// ── load instructors ────────────────────────────────────────────────────────
async function loadInstructors() {
  const res = await fetch(`${API}/admin/course-instructors`, { credentials: "include" });
  if (!res.ok) throw new Error("טעינת מדריכים נכשלה – " + res.status);
  allInstructors = await res.json();
}

// ── select course ───────────────────────────────────────────────────────────
function onCourseChange() {
  const sel    = $("courseSelect");
  const courseId = +sel.value || null;
  selectedCourseId = courseId;
  $("msgBox").style.display = "none";

  if (!courseId) {
    $("listCard").style.display = "none";
    $("courseInfo").textContent = "";
    return;
  }

  const course = allCourses.find(c => c.courseId === courseId);
  const assignedSet = new Set(course?.instructorIds || []);
  checked = new Set(assignedSet);

  $("courseInfo").textContent =
    `${checked.size} מדריכים מוסמכים מתוך ${allInstructors.length}`;

  $("searchBox").value = "";
  $("listCard").style.display = "";
  renderTable("");
}

// ── save ────────────────────────────────────────────────────────────────────
async function save() {
  if (!selectedCourseId) return;
  $("btnSave").disabled = true;
  try {
    const res = await fetch(
      `${API}/admin/course-instructors/course/${selectedCourseId}/instructors`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructorIds: [...checked] })
      }
    );
    if (!res.ok) throw new Error("שמירה נכשלה – " + res.status);

    // update local course data
    const course = allCourses.find(c => c.courseId === selectedCourseId);
    if (course) course.instructorIds = [...checked];

    $("courseInfo").textContent =
      `${checked.size} מדריכים מוסמכים מתוך ${allInstructors.length}`;
    showMsg("✔ שינויים נשמרו בהצלחה", "ok");
  } catch (e) {
    showMsg(e.message, "err");
  } finally {
    $("btnSave").disabled = false;
  }
}

// ── init ────────────────────────────────────────────────────────────────────
(async function init() {
  try {
    await Promise.all([loadCourses(), loadInstructors()]);
  } catch (e) {
    showMsg(e.message, "err");
    return;
  }

  $("courseSelect").addEventListener("change", onCourseChange);

  $("searchBox").addEventListener("input", function () {
    renderTable(this.value);
  });

  $("chkAll").addEventListener("change", function () {
    const visible = [...document.querySelectorAll("#tbody tr[data-id]")]
      .filter(r => r.style.display !== "none");
    visible.forEach(r => {
      const id = +r.dataset.id;
      if (this.checked) checked.add(id); else checked.delete(id);
      const chk = r.querySelector("input[type=checkbox]");
      if (chk) chk.checked = this.checked;
    });
    updateCounter();
  });

  $("btnSelectAll").addEventListener("click", () => {
    allInstructors.forEach(i => checked.add(i.instructorId));
    renderTable($("searchBox").value);
  });

  $("btnClearAll").addEventListener("click", () => {
    checked.clear();
    renderTable($("searchBox").value);
  });

  $("btnSave").addEventListener("click", save);
})();

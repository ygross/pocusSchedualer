const _dir = window.location.pathname.replace(/\/[^\/]*$/, "");
const API_BASE = `${_dir}/api/api`;
const $ = (id) => document.getElementById(id);

let allCourses = [];
let activityTypes = [];
let courseManagers = [];
let editingCourseId = null;
let isSysAdmin = false;

function esc(s) {
  return (s ?? "").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Accept": "application/json", ...(opts.headers||{}) },
    ...opts
  });
  if (res.status === 401) {
    window.top.location.href = `${_dir}/login-otp.html`;
    return null;
  }
  if (!res.ok) {
    const t = await res.text().catch(()=>"");
    throw new Error(`${res.status} ${t}`.trim());
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : null;
}

function setMsg(elId, text, kind = "") {
  const el = $(elId);
  if (!el) return;
  el.className = "msg" + (kind ? " " + kind : "");
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
}

async function init() {
  $("themeToggle")?.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });

  try {
    const me = await fetchJson(`${API_BASE}/me`);
    if (!me) return;
    $("meName").textContent  = me.fullName || me.email || "—";
    $("meRole").textContent  = me.roleName || "—";
    $("otpRoleInline").textContent = me.roleName || "—";
    $("dotSession").className = "dot is-ok";
    const roleNorm = String(me.roleName || "").toLowerCase();
    const isAdmin = roleNorm === "admin" || roleNorm === "systemadmin";
    isSysAdmin = roleNorm === "systemadmin";
    $("dotAdmin").className = isAdmin ? "dot is-ok" : "dot is-err";
    $("dotApi").className = "dot is-ok";
  } catch {
    $("dotSession").className = "dot is-err";
    setMsg("pageMsg", "אין חיבור לשרת או שאינך מחובר.", "err");
    return;
  }

  // load activity types
  try {
    activityTypes = await fetchJson(`${API_BASE}/activity-types`) || [];
    const sel = $("activityTypeFilter");
    activityTypes.forEach(t => {
      const o = document.createElement("option");
      o.value      = t.activityTypeId ?? t.ActivityTypeId;
      o.textContent = t.typeName      ?? t.TypeName ?? "";
      sel.appendChild(o);
    });
  } catch { /* non-fatal */ }

  // load course managers
  try {
    courseManagers = await fetchJson(`${API_BASE}/admin/courses-admin/course-managers`) || [];
  } catch { /* non-fatal */ }

  await loadCourses();

  $("refreshBtn").addEventListener("click", loadCourses);
  $("addCourseBtn").addEventListener("click", () => openModal(null));
  $("searchInput").addEventListener("input", renderTable);
  $("activityTypeFilter").addEventListener("change", renderTable);
  $("statusFilter").addEventListener("change", renderTable);

  // Event delegation — survives every renderTable() call
  $("coursesTbody").addEventListener("click", e => {
    const btn = e.target.closest("button[data-edit]");
    if (btn) openModal(Number(btn.dataset.edit));
  });

  $("closeModalBtn").addEventListener("click", closeModal);
  $("cancelModalBtn").addEventListener("click", closeModal);
  $("saveCourseBtn").addEventListener("click", saveCourse);
  $("deleteCourseBtn").addEventListener("click", deleteCourse);
  $("forceDeleteCourseBtn").addEventListener("click", forceDeleteCourse);
  $("courseModal").addEventListener("click", e => { if (e.target === $("courseModal")) closeModal(); });

  $("leadSearch").addEventListener("input", () => {
    const cur = Number($("courseLeadSelect").value) || null;
    renderLeadSelect(cur);
  });

  $("courseLeadSelect").addEventListener("change", () => {
    const id = Number($("courseLeadSelect").value) || null;
    const info = $("leadSelectedInfo");
    if (!info) return;
    if (id) {
      const m = courseManagers.find(x => getId(x) === id);
      if (m) {
        info.textContent = `✓ נבחר: ${m.fullName || m.FullName || ""}`;
        info.style.display = "block";
      }
    } else {
      info.style.display = "none";
    }
  });
}

async function loadCourses() {
  setMsg("pageMsg", "טוען קורסים…");
  try {
    allCourses = await fetchJson(`${API_BASE}/admin/courses-admin`) || [];
    renderStats();
    renderTable();
    setMsg("pageMsg", "");
  } catch (e) {
    setMsg("pageMsg", "שגיאה בטעינת קורסים: " + e.message, "err");
  }
}

function renderStats() {
  const total    = allCourses.length;
  const active   = allCourses.filter(c => c.isActive).length;
  const withLead = allCourses.filter(c => c.defaultLeadInstructorId).length;
  const withAct  = allCourses.filter(c => (c.activitiesCount || 0) > 0).length;
  $("statTotal").textContent          = total;
  $("statActive").textContent         = active;
  $("statInactive").textContent       = total - active;
  $("statWithActivities").textContent = withAct;
}

function renderTable() {
  const q       = ($("searchInput")?.value || "").toLowerCase();
  const typeId  = $("activityTypeFilter")?.value || "";
  const statusV = $("statusFilter")?.value || "";

  const rows = allCourses.filter(c => {
    if (q && !((c.courseName||"") + " " + (c.courseCode||"") + " " + (c.activityTypeName||"") + " " + (c.defaultLeadName||"")).toLowerCase().includes(q)) return false;
    if (typeId && String(c.activityTypeId) !== typeId) return false;
    if (statusV === "active"   && !c.isActive) return false;
    if (statusV === "inactive" &&  c.isActive) return false;
    return true;
  });

  $("resultsInfo").textContent = `${rows.length} תוצאות`;

  const tbody = $("coursesTbody");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-row">אין תוצאות</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(c => {
    const id   = c.courseId        ?? c.CourseId        ?? "";
    const name = c.courseName      ?? c.CourseName      ?? "";
    const code = c.courseCode      ?? c.CourseCode      ?? "";
    const type = c.activityTypeName?? c.ActivityTypeName?? "";
    const lead = c.defaultLeadName ?? c.DefaultLeadName ?? "";
    const active = c.isActive      ?? c.IsActive        ?? false;
    const acts = c.activitiesCount ?? c.ActivitiesCount ?? 0;
    const insts= c.instructorsCount?? c.InstructorsCount?? 0;
    return `
    <tr>
      <td>${id}</td>
      <td>${esc(name)}</td>
      <td>${esc(code || "—")}</td>
      <td>${esc(type || "—")}</td>
      <td>${lead
        ? `<span class="pill ok">${esc(lead)}</span>`
        : `<span style="color:var(--text-muted,#888);font-size:12px">לא הוגדר</span>`}</td>
      <td><span class="pill ${active ? "ok" : "bad"}">${active ? "פעיל" : "לא פעיל"}</span></td>
      <td>${acts}</td>
      <td>${insts}</td>
      <td><button class="btn btn-light" data-edit="${id}" type="button">עריכה</button></td>
    </tr>`;
  }).join("");

  // click handled by delegation on tbody (set up once in init)
}

function getName(m)  { return (m.fullName  || m.FullName  || "").toLowerCase(); }
function getEmail(m) { return (m.email     || m.Email     || "").toLowerCase(); }
function getId(m)    { return m.instructorId ?? m.InstructorId ?? 0; }

function renderLeadSelect(selectedId) {
  const q   = ($("leadSearch")?.value || "").trim().toLowerCase();
  const sel = $("courseLeadSelect");
  if (!sel) return;
  const matches = q
    ? courseManagers.filter(m => getName(m).includes(q) || getEmail(m).includes(q))
    : courseManagers;
  sel.innerHTML = `<option value="">— ללא מרכז קורס —</option>` + matches.map(m => {
    const id = getId(m);
    const fn = m.fullName || m.FullName || "";
    const em = m.email    || m.Email    || "";
    return `<option value="${id}" ${id === selectedId ? "selected" : ""}>${esc(fn)} (${esc(em)})</option>`;
  }).join("");

  // Show selected name below the dropdown for confirmation
  const info = $("leadSelectedInfo");
  if (info) {
    if (selectedId) {
      const sel2 = matches.find(m => getId(m) === selectedId);
      if (sel2) {
        const fn = sel2.fullName || sel2.FullName || "";
        info.textContent = `✓ נבחר: ${fn}`;
        info.style.display = "block";
      } else {
        info.style.display = "none";
      }
    } else {
      info.style.display = "none";
    }
  }
}

function openModal(courseId) {
  editingCourseId = courseId;
  setMsg("modalMsg", "");

  const typeSel = $("courseTypeSelect");
  typeSel.innerHTML = `<option value="">בחר סוג פעילות…</option>` +
    activityTypes.map(t => {
      const id  = t.activityTypeId ?? t.ActivityTypeId;
      const nm  = t.typeName       ?? t.TypeName ?? "";
      return `<option value="${id}">${esc(nm)}</option>`;
    }).join("");

  $("leadSearch").value = "";

  if (courseId) {
    // eslint-disable-next-line eqeqeq
    const c = allCourses.find(x => x.courseId == courseId || x.CourseId == courseId);
    if (!c) { console.error("Course not found:", courseId, allCourses[0]); return; }
    $("modalTitle").textContent    = "עריכת קורס";
    $("modalSubtitle").textContent = `CourseId: ${c.courseId}`;
    $("courseNameInput").value     = c.courseName || "";
    $("courseCodeInput").value     = c.courseCode || "";
    typeSel.value                  = String(c.activityTypeId || "");
    renderLeadSelect(c.defaultLeadInstructorId || null);
    $("courseIsActiveInput").checked = !!c.isActive;
    $("deleteCourseBtn").classList.remove("hidden");
    if (isSysAdmin) $("forceDeleteCourseBtn").classList.remove("hidden");
    const usage = $("usageBox");
    usage.textContent = `פעילויות משויכות: ${c.activitiesCount ?? 0} | מדריכים: ${c.instructorsCount ?? 0}`;
    usage.classList.remove("hidden");
  } else {
    $("modalTitle").textContent    = "הוספת קורס";
    $("modalSubtitle").textContent = "יצירת רשומת קורס חדשה";
    $("courseNameInput").value     = "";
    $("courseCodeInput").value     = "";
    typeSel.value                  = "";
    renderLeadSelect(null);
    $("courseIsActiveInput").checked = true;
    $("deleteCourseBtn").classList.add("hidden");
    $("forceDeleteCourseBtn").classList.add("hidden");
    $("usageBox").classList.add("hidden");
  }

  $("courseModal").classList.remove("hidden");
}

function closeModal() {
  $("courseModal").classList.add("hidden");
  editingCourseId = null;
}

async function saveCourse() {
  const name   = $("courseNameInput").value.trim();
  const code   = $("courseCodeInput").value.trim();
  const typeId = Number($("courseTypeSelect").value || 0);
  const active = $("courseIsActiveInput").checked;
  const leadId = Number($("courseLeadSelect").value || 0) || null;

  // Clear previous message and validate
  setMsg("modalMsg", "");
  if (!name) {
    setMsg("modalMsg", "⚠ שם קורס הוא שדה חובה.", "err");
    $("courseNameInput").focus();
    return;
  }
  if (!typeId) {
    setMsg("modalMsg", "⚠ יש לבחור סוג פעילות.", "err");
    $("courseTypeSelect").focus();
    return;
  }
  // Lead is optional — DB allows null

  const payload = {
    courseName: name,
    courseCode: code || null,
    activityTypeId: typeId,
    isActive: active,
    defaultLeadInstructorId: leadId
  };

  const btn = $("saveCourseBtn");
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "שומר…";
  setMsg("modalMsg", "מעבד בקשה…");

  try {
    if (editingCourseId) {
      await fetchJson(`${API_BASE}/admin/courses-admin/${editingCourseId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
    } else {
      await fetchJson(`${API_BASE}/admin/courses-admin`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
    }
    const successText = editingCourseId ? "הקורס עודכן בהצלחה ✅" : "הקורס נוסף בהצלחה ✅";
    closeModal();
    await loadCourses();                      // clears pageMsg internally → set AFTER
    setMsg("pageMsg", successText, "ok");
    $("pageMsg")?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setMsg("pageMsg", ""), 5000);
  } catch (e) {
    setMsg("modalMsg", "❌ שגיאה בשמירה: " + e.message, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}

async function deleteCourse() {
  if (!editingCourseId) return;
  if (!confirm(`למחוק קורס ${editingCourseId}?`)) return;
  setMsg("modalMsg", "מוחק…");
  try {
    await fetchJson(`${API_BASE}/admin/courses-admin/${editingCourseId}`, { method: "DELETE" });
    closeModal();
    setMsg("pageMsg", "הקורס נמחק ✅", "ok");
    await loadCourses();
  } catch (e) {
    setMsg("modalMsg", "שגיאה: " + e.message, "err");
  }
}

async function forceDeleteCourse() {
  if (!editingCourseId) return;
  const c = allCourses.find(x => x.courseId == editingCourseId || x.CourseId == editingCourseId);
  const name = c?.courseName || c?.CourseName || editingCourseId;
  if (!confirm(`⚠ Force Delete — SysAdmin\n\nמחיקה מוחלטת של קורס "${name}" כולל:\n• כל הפעילויות\n• כל המופעים\n• כל השיבוצים\n• כל בקשות הזמינות\n\nפעולה בלתי הפיכה! להמשיך?`)) return;
  setMsg("modalMsg", "מוחק...", "");
  try {
    await fetchJson(`${API_BASE}/sysadmin/courses/${editingCourseId}/force`, { method: "DELETE" });
    closeModal();
    setMsg("pageMsg", `הקורס נמחק לגמרי (Force Delete) ✅`, "ok");
    await loadCourses();
  } catch (e) {
    setMsg("modalMsg", "שגיאה: " + e.message, "err");
  }
}

document.addEventListener("DOMContentLoaded", init);

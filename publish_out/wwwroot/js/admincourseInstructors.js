const API_BASE = "/simcenter/PocusSchedualer/api/api/admin";

const state = {
  instructors: [],
  filtered: [],
  courses: [],
  selectedInstructor: null,
  selectedCourses: new Set()
};

const els = {
  tbody: document.getElementById("instructorsTbody"),
  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter"),
  roleFilter: document.getElementById("roleFilter"),
  resultsInfo: document.getElementById("resultsInfo"),
  statTotal: document.getElementById("statTotal"),
  statActive: document.getElementById("statActive"),
  statInactive: document.getElementById("statInactive"),
  statPending: document.getElementById("statPending"),
  refreshBtn: document.getElementById("refreshBtn"),
  modal: document.getElementById("coursesModal"),
  modalInstructorName: document.getElementById("modalInstructorName"),
  coursesChecklist: document.getElementById("coursesChecklist"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  cancelModalBtn: document.getElementById("cancelModalBtn"),
  saveCoursesBtn: document.getElementById("saveCoursesBtn"),
  selectAllBtn: document.getElementById("selectAllBtn"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  courseSearchInput: document.getElementById("courseSearchInput"),
  loggedUserRole: document.getElementById("loggedUserRole")
};

const endpoints = {
  instructors: `${API_BASE}/course-instructors`,
  courses: `${API_BASE}/course-instructors/courses`,
  status: (id) => `${API_BASE}/course-instructors/${id}/status`,
  saveCourses: (id) => `${API_BASE}/course-instructors/${id}/courses`
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getLoggedUser() {
  const candidates = [
    sessionStorage.getItem("user"),
    localStorage.getItem("user"),
    sessionStorage.getItem("currentUser"),
    localStorage.getItem("currentUser")
  ].filter(Boolean);

  for (const raw of candidates) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed) return parsed;
    } catch (_) {}
  }

  return null;
}

function renderLoggedUserRole() {
  const user = getLoggedUser();
  const role = user?.role || user?.Role || user?.roleName || user?.RoleName || "לא ידוע";
  const name = user?.fullName || user?.FullName || user?.name || user?.Name || "";
  els.loggedUserRole.textContent = name
    ? `תפקיד המשתמש המחובר: ${role} · ${name}`
    : `תפקיד המשתמש המחובר: ${role}`;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const err = new Error(`HTTP ${response.status}${text ? ` - ${text}` : ""}`);
    err.status = response.status;
    throw err;
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : null;
}

function normalizeStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "pendingapproval") return "PendingApproval";
  if (s === "pending") return "Pending";
  if (s === "disabled") return "Disabled";
  if (s === "inactive") return "Inactive";
  if (s === "active") return "Active";
  return status || "Inactive";
}

function normalizeInstructorRows(rows) {
  return rows.map((row) => ({
    instructorId: row.instructorId ?? row.id ?? row.instructorID ?? 0,
    fullName: row.fullName ?? row.name ?? [row.firstName, row.lastName].filter(Boolean).join(" ") ?? "",
    email: row.email ?? "",
    department: row.department ?? "",
    role: row.roleName ?? row.role ?? "",
    status: normalizeStatus(row.status ?? row.instructorStatus ?? "Inactive"),
    courseIds: Array.isArray(row.courseIds) ? row.courseIds : [],
    courses: Array.isArray(row.courseNames)
      ? row.courseNames
      : Array.isArray(row.courses)
        ? row.courses.map((c) => typeof c === "string" ? c : (c?.courseName || c?.name || "")).filter(Boolean)
        : []
  }));
}

function normalizeCourseRows(rows) {
  return rows.map((row) => ({
    courseId: row.courseId ?? row.id ?? row.courseID ?? 0,
    courseName: row.courseName ?? row.name ?? `קורס ${row.courseId ?? row.id ?? ""}`,
    department: row.department ?? "",
    instructorIds: Array.isArray(row.instructorIds) ? row.instructorIds : []
  }));
}

function setLoading(message) {
  els.tbody.innerHTML = `<tr><td colspan="7" class="empty-row">${message}</td></tr>`;
}

async function loadData() {
  try {
    setLoading("טוען נתונים...");
    renderLoggedUserRole();

    const [instructorsRaw, coursesRaw] = await Promise.all([
      request(endpoints.instructors),
      request(endpoints.courses)
    ]);

    state.instructors = normalizeInstructorRows(Array.isArray(instructorsRaw) ? instructorsRaw : []);
    state.courses = normalizeCourseRows(Array.isArray(coursesRaw) ? coursesRaw : []);

    enrichMissingCourseIdsFromCoursesTable();
    applyFilters();
  } catch (error) {
    console.error(error);
    setLoading(`שגיאה בטעינת נתונים: ${escapeHtml(error.message)}`);
  }
}

function enrichMissingCourseIdsFromCoursesTable() {
  const courseMap = new Map();
  state.courses.forEach((course) => {
    (course.instructorIds || []).forEach((instId) => {
      if (!courseMap.has(instId)) courseMap.set(instId, []);
      courseMap.get(instId).push(course);
    });
  });

  state.instructors.forEach((inst) => {
    if ((!inst.courseIds || !inst.courseIds.length) && (!inst.courses || !inst.courses.length)) {
      const mapped = courseMap.get(inst.instructorId) || [];
      inst.courseIds = mapped.map((c) => c.courseId);
      inst.courses = mapped.map((c) => c.courseName);
    }
  });
}

function applyFilters() {
  const q = els.searchInput.value.trim().toLowerCase();
  const status = els.statusFilter.value;
  const role = els.roleFilter.value;

  state.filtered = state.instructors.filter((item) => {
    const haystack = `${item.fullName} ${item.email} ${item.department} ${item.role}`.toLowerCase();
    return (!q || haystack.includes(q)) &&
      (!status || item.status === status) &&
      (!role || item.role === role);
  });

  renderStats();
  renderTable();
}

function renderStats() {
  const all = state.instructors;
  els.statTotal.textContent = String(all.length);
  els.statActive.textContent = String(all.filter((x) => x.status === "Active").length);
  els.statInactive.textContent = String(all.filter((x) => ["Inactive", "Disabled"].includes(x.status)).length);
  els.statPending.textContent = String(all.filter((x) => ["Pending", "PendingApproval"].includes(x.status)).length);
  els.resultsInfo.textContent = `${state.filtered.length} תוצאות`;
}

function statusClass(status) {
  switch ((status || "").toLowerCase()) {
    case "active": return "status-active";
    case "pending":
    case "pendingapproval": return "status-pending";
    case "inactive": return "status-inactive";
    case "disabled": return "status-disabled";
    default: return "status-inactive";
  }
}

function renderTable() {
  if (!state.filtered.length) {
    setLoading("לא נמצאו מדריכים");
    return;
  }

  els.tbody.innerHTML = state.filtered.map((item) => {
    const courses = Array.isArray(item.courses) ? item.courses : [];
    const courseCount = Array.isArray(item.courseIds) ? item.courseIds.length : courses.length;

    const courseHtml = courses.length
      ? courses.slice(0, 5).map((name) => `<span class="tag">${escapeHtml(name)}</span>`).join("")
      : `<span class="tag tag-empty">ללא הסמכות</span>`;

    const canActivate = ["Pending", "PendingApproval", "Inactive", "Disabled"].includes(item.status);
    const canDeactivate = item.status === "Active";

    return `
      <tr>
        <td>
          <div class="person-name">${escapeHtml(item.fullName)}</div>
          <div class="person-meta">#${escapeHtml(item.instructorId)}</div>
        </td>
        <td>${escapeHtml(item.email || "—")}</td>
        <td>${escapeHtml(item.department || "—")}</td>
        <td>${escapeHtml(item.role || "—")}</td>
        <td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status || "—")}</span></td>
        <td>
          <div class="tag-list">${courseHtml}</div>
          <div class="course-count-badge">${courseCount} הסמכות</div>
        </td>
        <td>
          <div class="actions">
            ${canActivate ? `<button class="btn btn-success" type="button" onclick="changeStatus(${item.instructorId}, 'Active')">ACTIVE</button>` : ""}
            ${canDeactivate ? `<button class="btn btn-danger" type="button" onclick="changeStatus(${item.instructorId}, 'Inactive')">INACTIVE</button>` : ""}
            <button class="btn btn-secondary" type="button" onclick="openCoursesModal(${item.instructorId})">ערוך הסמכות</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function changeStatus(instructorId, status) {
  try {
    await request(endpoints.status(instructorId), {
      method: "POST",
      body: JSON.stringify({ status })
    });

    const item = state.instructors.find((x) => x.instructorId === instructorId);
    if (item) {
      item.status = status;
    }

    applyFilters();
  } catch (error) {
    console.error(error);
    alert(`לא ניתן לעדכן סטטוס: ${error.message}`);
  }
}

function openCoursesModal(instructorId) {
  const item = state.instructors.find((x) => x.instructorId === instructorId);
  if (!item) return;

  state.selectedInstructor = item;
  state.selectedCourses = new Set(Array.isArray(item.courseIds) ? item.courseIds : []);

  els.modalInstructorName.textContent = `${item.fullName} • ${item.email || ""}`;
  els.courseSearchInput.value = "";
  renderCoursesChecklist();
  els.modal.classList.remove("hidden");
}

function closeCoursesModal() {
  els.modal.classList.add("hidden");
  state.selectedInstructor = null;
  state.selectedCourses = new Set();
}

function renderCoursesChecklist() {
  const q = els.courseSearchInput.value.trim().toLowerCase();

  const rows = state.courses.filter((course) => {
    const txt = `${course.courseName || ""} ${course.department || ""}`.toLowerCase();
    return !q || txt.includes(q);
  });

  els.coursesChecklist.innerHTML = rows.length ? rows.map((course) => {
    const checked = state.selectedCourses.has(course.courseId) ? "checked" : "";
    return `
      <div class="course-option">
        <label>
          <input type="checkbox" data-course-id="${course.courseId}" ${checked}>
          <div>
            <div class="course-name">${escapeHtml(course.courseName)}</div>
            <div class="course-meta">${escapeHtml(course.department || "")}</div>
          </div>
        </label>
      </div>
    `;
  }).join("") : `<div class="empty-courses">לא נמצאו קורסים</div>`;

  els.coursesChecklist.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const id = Number(e.target.dataset.courseId);
      if (e.target.checked) state.selectedCourses.add(id);
      else state.selectedCourses.delete(id);
    });
  });
}

async function saveCourses() {
  if (!state.selectedInstructor) return;

  try {
    const courseIds = Array.from(state.selectedCourses);

    await request(endpoints.saveCourses(state.selectedInstructor.instructorId), {
      method: "PUT",
      body: JSON.stringify({ courseIds })
    });

    const selectedNames = state.courses
      .filter((c) => state.selectedCourses.has(c.courseId))
      .map((c) => c.courseName);

    const item = state.instructors.find((x) => x.instructorId === state.selectedInstructor.instructorId);
    if (item) {
      item.courseIds = courseIds;
      item.courses = selectedNames;
    }

    closeCoursesModal();
    applyFilters();
  } catch (error) {
    console.error(error);
    alert(`לא ניתן לשמור הסמכות: ${error.message}`);
  }
}

els.searchInput.addEventListener("input", applyFilters);
els.statusFilter.addEventListener("change", applyFilters);
els.roleFilter.addEventListener("change", applyFilters);
els.refreshBtn.addEventListener("click", loadData);
els.closeModalBtn.addEventListener("click", closeCoursesModal);
els.cancelModalBtn.addEventListener("click", closeCoursesModal);
els.saveCoursesBtn.addEventListener("click", saveCourses);
els.courseSearchInput.addEventListener("input", renderCoursesChecklist);
els.selectAllBtn.addEventListener("click", () => {
  state.courses.forEach((course) => state.selectedCourses.add(course.courseId));
  renderCoursesChecklist();
});
els.clearAllBtn.addEventListener("click", () => {
  state.selectedCourses.clear();
  renderCoursesChecklist();
});
els.modal.addEventListener("click", (e) => {
  if (e.target === els.modal) closeCoursesModal();
});

window.changeStatus = changeStatus;
window.openCoursesModal = openCoursesModal;

loadData();

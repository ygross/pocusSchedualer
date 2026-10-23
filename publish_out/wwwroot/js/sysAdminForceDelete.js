(function () {
  const _dir    = window.location.pathname.replace(/\/[^\/]*$/, "");
  const API_BASE = `${window.location.origin}${_dir}/api/api`;
  const $        = id => document.getElementById(id);

  let allCourses = [];

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

  function setMsg(text, kind) {
    const el = $("pageMsg");
    if (!el) return;
    el.className = "msg" + (kind ? " " + kind : "");
    el.textContent = text || "";
    el.style.display = text ? "block" : "none";
  }

  async function init() {
    try {
      const me = await fetchJson(`${API_BASE}/me`);
      if (!me) return;
      const role = String(me.roleName || me.RoleName || "").toLowerCase();
      if (role !== "systemadmin") {
        document.body.innerHTML = '<div style="padding:40px;color:#e74c3c;font-size:16px">⛔ גישה מוגבלת — SysAdmin בלבד</div>';
        return;
      }
      if ($("meName")) $("meName").textContent = me.fullName || me.email || "";
      if ($("meRole")) $("meRole").textContent = me.roleName || "";

      const themeBtn = $("themeToggle");
      if (themeBtn) {
        themeBtn.addEventListener("click", () => {
          const cur = document.documentElement.getAttribute("data-theme");
          const next = cur === "light" ? "dark" : "light";
          document.documentElement.setAttribute("data-theme", next);
          localStorage.setItem("theme", next);
          if (window.top !== window) window.top.postMessage({ type: "theme", value: next }, "*");
        });
      }

      await loadCourses();
    } catch (e) {
      setMsg("שגיאה בטעינה: " + e.message, "err");
    }
  }

  async function loadCourses() {
    $("coursesTbody").innerHTML = '<tr class="empty-row"><td colspan="8">טוען…</td></tr>';
    setMsg("", "");
    try {
      const data = await fetchJson(`${API_BASE}/admin/courses-admin`);
      allCourses = Array.isArray(data) ? data : (data?.courses || data?.items || []);
      renderTable(allCourses);
    } catch (e) {
      $("coursesTbody").innerHTML = `<tr class="empty-row"><td colspan="8">שגיאה: ${e.message}</td></tr>`;
    }
  }

  function filterCourses() {
    const q = ($("searchInput")?.value || "").toLowerCase().trim();
    if (!q) { renderTable(allCourses); return; }
    renderTable(allCourses.filter(c => {
      const name = (c.courseName || c.CourseName || "").toLowerCase();
      const code = (c.courseCode || c.CourseCode || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    }));
  }
  window.filterCourses = filterCourses;

  function renderTable(courses) {
    const label = $("countLabel");
    if (label) label.textContent = `${courses.length} קורסים`;

    if (!courses.length) {
      $("coursesTbody").innerHTML = '<tr class="empty-row"><td colspan="8">לא נמצאו קורסים</td></tr>';
      return;
    }

    $("coursesTbody").innerHTML = courses.map(c => {
      const id       = c.courseId   ?? c.CourseId   ?? "";
      const name     = c.courseName ?? c.CourseName ?? "—";
      const code     = c.courseCode ?? c.CourseCode ?? "—";
      const type     = c.activityTypeName ?? c.ActivityTypeName ?? "—";
      const active   = c.isActive   ?? c.IsActive   ?? false;
      const acts     = c.activitiesCount  ?? c.ActivitiesCount  ?? "—";
      const insts    = c.instructorsCount ?? c.InstructorsCount ?? "—";
      const statusCls = active ? "badge-active" : "badge-inactive";
      const statusTxt = active ? "פעיל" : "לא פעיל";
      return `<tr>
        <td>${id}</td>
        <td><b>${esc(name)}</b></td>
        <td>${esc(code)}</td>
        <td>${esc(type)}</td>
        <td class="${statusCls}">${statusTxt}</td>
        <td><span class="count-badge">${acts}</span></td>
        <td><span class="count-badge">${insts}</span></td>
        <td><button class="btn btn-danger btn-sm" data-cid="${id}" data-cname="${esc(name)}" onclick="forceDeleteBtn(this)">⚠ Force Delete</button></td>
      </tr>`;
    }).join("");
  }

  function esc(s) {
    return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function forceDeleteBtn(btn) {
    forceDelete(parseInt(btn.dataset.cid), btn.dataset.cname);
  }
  window.forceDeleteBtn = forceDeleteBtn;

  async function forceDelete(courseId, courseName) {
    const msg = `⚠ Force Delete — SysAdmin\n\nאתה עומד למחוק לצמיתות:\n"${courseName}" (ID: ${courseId})\n\nהפעולה תמחק:\n• כל הפעילויות של הקורס\n• כל מופעי הפעילויות\n• כל השיבוצים למופעים אלה\n• כל בקשות הזמינות\n• כל שיוכי המדריכים לקורס\n\nלא ניתן לשחזר. להמשיך?`;
    if (!confirm(msg)) return;
    if (!confirm(`אישור סופי — מוחק "${courseName}"?`)) return;

    setMsg("מוחק…", "");
    try {
      const res = await fetchJson(`${API_BASE}/sysadmin/courses/${courseId}/force`, { method: "DELETE" });
      const r = res?.result || {};
      setMsg(
        `✅ נמחק: "${courseName}" — ${r.activitiesCount ?? 0} פעילויות, ${r.instancesCount ?? 0} מופעים, ${r.assignmentsCount ?? 0} שיבוצים, ${r.instructorLinksCount ?? 0} שיוכי מדריכים`,
        "ok"
      );
      await loadCourses();
    } catch (e) {
      setMsg("שגיאה: " + e.message, "err");
    }
  }
  window.forceDelete = forceDelete;
  window.loadCourses  = loadCourses;

  document.addEventListener("DOMContentLoaded", init);
})();

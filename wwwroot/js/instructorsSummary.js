(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function showError(msg){
    const box = $("errBox");
    if (!box) return;
    box.style.display = msg ? "block" : "none";
    box.textContent = msg || "";
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll("\"","&quot;")
      .replaceAll("'","&#039;");
  }

  // =========================
  // API base detect
  // =========================
  function getAppPrefix(){
    const m = location.pathname.match(/^(.*\/PocusSchedualer)\//i);
    return m ? m[1] : "";
  }

  async function tryMe(base){
    try{
      const res = await fetch(`${base}/me`, { credentials:"include" });
      return res.ok;
    }catch{
      return false;
    }
  }

  async function detectApiBase(){
    const prefix = getAppPrefix();
    const candidates = [
      `${prefix}/api/api`,
      `${prefix}/api`,
      `/api/api`,
      `/api`
    ];
    for (const c of candidates){
      if (await tryMe(c)) return c;
    }
    return candidates[0];
  }

  async function fetchJson(url){
    const r = await fetch(url, { credentials:"include" });
    if (!r.ok){
      const t = await r.text().catch(()=> "");
      throw new Error(`HTTP ${r.status} ${r.statusText}${t ? " - " + t : ""}`);
    }
    return await r.json();
  }

  function pad2(n){ return String(n).padStart(2, "0"); }

  function toDateInputValue(d){
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }

  function parseDateInput(val){
    // val = YYYY-MM-DD ; ניצור Date ב-local
    if (!val) return null;
    const [y, m, d] = val.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0);
  }

  // =========================
  // Ranges
  // =========================
  function setRange(fromDate, toDate){
    $("fromDate").value = toDateInputValue(fromDate);
    $("toDate").value   = toDateInputValue(toDate);
    updateRangeLabel();
  }

  // דיפולט: חודש קלנדרי נוכחי (1..1 חודש הבא)
  function setThisCalendarMonth(){
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    setRange(from, to);
  }

  function setNextCalendarMonth(){
    const baseFrom = parseDateInput($("fromDate").value) || new Date();
    const from = new Date(baseFrom.getFullYear(), baseFrom.getMonth() + 1, 1);
    const to   = new Date(baseFrom.getFullYear(), baseFrom.getMonth() + 2, 1);
    setRange(from, to);
  }

  function setPrevCalendarMonth(){
    const baseFrom = parseDateInput($("fromDate").value) || new Date();
    const from = new Date(baseFrom.getFullYear(), baseFrom.getMonth() - 1, 1);
    const to   = new Date(baseFrom.getFullYear(), baseFrom.getMonth(), 1);
    setRange(from, to);
  }

  // רבעון = 3 חודשים מלאים: from=1 בחודש, to=+3 חודשים
  function setNextQuarter(){
    const baseFrom = parseDateInput($("fromDate").value) || new Date();
    const from = new Date(baseFrom.getFullYear(), baseFrom.getMonth() + 3, 1);
    const to   = new Date(from.getFullYear(), from.getMonth() + 3, 1);
    setRange(from, to);
  }

  function setPrevQuarter(){
    const baseFrom = parseDateInput($("fromDate").value) || new Date();
    const from = new Date(baseFrom.getFullYear(), baseFrom.getMonth() - 3, 1);
    const to   = new Date(from.getFullYear(), from.getMonth() + 3, 1);
    setRange(from, to);
  }

  function updateRangeLabel(){
    const from = $("fromDate")?.value || "";
    const to   = $("toDate")?.value || "";
    const el = $("rangeLabel");
    if (!el) return;
    if (!from || !to) { el.textContent = "בחר טווח תאריכים"; return; }
    el.textContent = `טווח נבחר: ${from} עד ${to} (to לא כולל)`;
  }

  // =========================
  // UI (Load bar)
  // =========================
  function setLoadUI(totalHours, distinctActivities){
    const hrs = Number(totalHours || 0);

    let level = "low";
    let label = "עומס נמוך 🟢";

    // 30 שעות = 100% (אפשר לשנות)
    const pct = Math.max(0, Math.min(100, (hrs / 30) * 100));

    if (hrs >= 25){
      level = "high"; label = "עומס גבוה 🔴";
    } else if (hrs >= 10){
      level = "mid"; label = "עומס בינוני 🟡";
    }

    $("loadLabel").textContent = label;
    $("loadInfo").textContent = `${distinctActivities} פעילויות שונות בתקופה`;
    $("loadBar").style.width = `${pct.toFixed(0)}%`;

    const fill = $("loadBar");
    // (בלי תלות CSS, כדי שזה יראה טוב בכל מצב)
    if (level === "high"){
      fill.style.background = "linear-gradient(90deg, rgba(255,107,107,0.95), rgba(255,204,102,0.85))";
    } else if (level === "mid"){
      fill.style.background = "linear-gradient(90deg, rgba(255,204,102,0.95), rgba(42,163,255,0.85))";
    } else {
      fill.style.background = "linear-gradient(90deg, rgba(41,209,125,0.95), rgba(42,163,255,0.85))";
    }
  }

  function renderPills(containerId, items, emptyText){
    const el = $(containerId);
    if (!el) return;

    if (!items || items.length === 0){
      el.classList.add("muted");
      el.innerHTML = esc(emptyText || "אין נתונים");
      return;
    }

    el.classList.remove("muted");
    el.innerHTML = items.map(x => `<span class="pill">${esc(x)}</span>`).join("");
  }

  function renderCourses(items){
    const el = $("courses");
    if (!el) return;

    if (!items || items.length === 0){
      el.classList.add("muted");
      el.textContent = "אין קורסים משויכים";
      return;
    }

    el.classList.remove("muted");
    el.innerHTML = items
      .map(c => `<span class="pill" title="CourseId: ${esc(c.courseId)}">${esc(c.courseName)}</span>`)
      .join("");
  }

  function renderTable(rows, q){
    const tbody = $("activitiesTable");
    if (!tbody) return;

    const query = (q || "").trim().toLowerCase();
    const filtered = !query
      ? rows
      : rows.filter(r => String(r.activityName || r.ActivityName || "").toLowerCase().includes(query));

    if (!filtered || filtered.length === 0){
      tbody.innerHTML = `<tr><td colspan="3" class="muted">אין נתונים להצגה</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(r => {
      const name = r.activityName ?? r.ActivityName ?? "";
      const inst = r.instances ?? r.Instances ?? 0;
      const hrs  = r.hours ?? r.Hours ?? 0;
      return `
        <tr>
          <td>${esc(name)}</td>
          <td class="num">${esc(inst)}</td>
          <td class="num">${esc(Number(hrs).toFixed(1))}</td>
        </tr>
      `;
    }).join("");
  }

  // =========================
  // Stats by dates
  // =========================
  async function loadStatsByDates(apiBase){
    showError("");
    updateRangeLabel();

    // אם משתמש מחק תאריך – נחזיר לדיפולט חודש קלנדרי נוכחי
    if (!$("fromDate").value || !$("toDate").value){
      setThisCalendarMonth();
    }

    const from = $("fromDate").value;
    const to   = $("toDate").value;

    if (from >= to){
      showError("הטווח לא תקין: 'מתאריך' חייב להיות קטן מ-'עד תאריך'.");
      return;
    }

    const url = `${apiBase}/instructors/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const stats = await fetchJson(url);

    const totalInstances = stats.totalInstances ?? stats.TotalInstances ?? 0;
    const totalHours = Number(stats.totalHours ?? stats.TotalHours ?? 0);
    const byActivity = stats.byActivity ?? stats.ByActivity ?? [];

    $("totalInstances").textContent = String(totalInstances);
    $("totalHours").textContent = totalHours.toFixed(1);
    $("distinctActivities").textContent = String(byActivity.length);

    setLoadUI(totalHours, byActivity.length);
    renderTable(byActivity, $("searchBox")?.value || "");
  }

  async function main(){
    showError("");

    const apiBase = await detectApiBase();
    $("apiBaseLabel").textContent = `API: ${apiBase}`;

    // ME
    const me = await fetchJson(`${apiBase}/me`);
    $("meLine").textContent = `${me.fullName || me.FullName || me.email || me.Email || "משתמש"}`;
    $("loggedRole").textContent = `${me.roleName || me.RoleName || me.role || me.Role || "—"}`;
    $("instructorDetails").innerHTML =
      `<div><b>שם:</b> ${esc(me.fullName || me.FullName || "—")}</div>
       <div><b>מייל:</b> ${esc(me.email || me.Email || "—")}</div>
       <div><b>מחלקה:</b> ${esc(me.department || me.Department || "—")}</div>`;

    // CERTS + COURSES
    const [certs, courses] = await Promise.all([
      fetchJson(`${apiBase}/instructors/certifications`),
      fetchJson(`${apiBase}/instructors/courses`)
    ]);
    renderPills("certifications", certs, "אין הסמכות");
    renderCourses(courses);

    // Default = this calendar month
    setThisCalendarMonth();

    const run = () => loadStatsByDates(apiBase).catch(err => {
      showError(err?.message || String(err));
      console.error(err);
    });

    // Buttons
    $("btnRefresh")?.addEventListener("click", run);

    $("btnPrevMonth")?.addEventListener("click", () => { setPrevCalendarMonth(); run(); });
    $("btnThisMonth")?.addEventListener("click", () => { setThisCalendarMonth(); run(); });
    $("btnNextMonth")?.addEventListener("click", () => { setNextCalendarMonth(); run(); });

    $("btnPrevQuarter")?.addEventListener("click", () => { setPrevQuarter(); run(); });
    $("btnNextQuarter")?.addEventListener("click", () => { setNextQuarter(); run(); });

    // Date changes
    $("fromDate")?.addEventListener("change", run);
    $("toDate")?.addEventListener("change", run);

    // Search
    let t = null;
    $("searchBox")?.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(run, 150);
    });

    await run();
  }

  document.addEventListener("DOMContentLoaded", () => {
    main().catch(err => {
      showError(err?.message || String(err));
      console.error(err);
    });
  });
})();

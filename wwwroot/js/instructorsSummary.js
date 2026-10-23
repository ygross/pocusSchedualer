// ── API base (same reliable pattern as my-assignments.js) ─────────────────
const _dir = window.location.pathname.replace(/\/[^\/]*$/, "");
const API  = `${window.location.origin}${_dir}/api/api`;

// ── Helpers ────────────────────────────────────────────────────────────────
function pad2(n) { return String(n).padStart(2, "0"); }

function fmtDateInput(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

async function fetchJson(url) {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error("API error " + r.status + " – " + url);
  return r.json();
}

function pickText(x) {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  return x.courseName || x.name || x.typeName || x.label || "";
}

function renderPills(id, items, fallback) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = (!items || !items.length)
    ? `<span class='pill'>${fallback}</span>`
    : items.map(x => `<span class='pill'>${pickText(x)}</span>`).join("");
}

function fmtIsraelDateTime(utcStr) {
  if (!utcStr) return "—";
  return new Date(utcStr).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function renderTable(rows) {
  const body = document.getElementById("tblBody");
  if (!body) return;
  if (!rows || !rows.length) {
    body.innerHTML = "<tr><td colspan='3' class='empty-cell'>אין נתונים</td></tr>";
    return;
  }
  body.innerHTML = rows.map(x => `
    <tr>
      <td>${pickText(x.activityName || x.name)}</td>
      <td>${fmtIsraelDateTime(x.startUtc)}</td>
      <td>${(+(x.hours ?? 0)).toFixed(1)}</td>
    </tr>
  `).join("");
}

function setDefaults() {
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fromEl = document.getElementById("fromDate");
  const toEl   = document.getElementById("toDate");
  if (fromEl && !fromEl.value) fromEl.value = fmtDateInput(first);
  if (toEl   && !toEl.value)   toEl.value   = fmtDateInput(last);
}

// ── Main load ──────────────────────────────────────────────────────────────
async function load() {
  const errBox = document.getElementById("errBox");
  if (errBox) { errBox.style.display = "none"; errBox.textContent = ""; }

  try {
    // User info
    const me = await fetchJson(`${API}/me`);
    const nameEl = document.getElementById("meName");
    const roleEl = document.getElementById("meRole");
    const otpEl  = document.getElementById("otpRoleInline");
    if (nameEl) nameEl.textContent = me.fullName || me.email || "—";
    if (roleEl) roleEl.textContent = me.roleName || me.role || "—";
    if (otpEl)  otpEl.textContent  = me.roleName || me.role || "—";

    // Date range from inputs (default = current month)
    const from = document.getElementById("fromDate")?.value;
    const to   = document.getElementById("toDate")?.value;

    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to)   qs.set("to",   to);

    const stats = await fetchJson(`${API}/instructors/stats?${qs.toString()}`);

    // KPI
    const setKpi = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setKpi("totalInstances",     stats.totalInstances     ?? 0);
    setKpi("totalHours",         (+(stats.totalHours      ?? 0)).toFixed(1));
    setKpi("distinctActivities", stats.distinctActivities ?? 0);

    // Certifications pills
    renderPills("certifications", stats.certifications || [], "אין הסמכות");

    // Table
    renderTable(stats.byActivity || []);

  } catch (e) {
    if (errBox) { errBox.textContent = e.message; errBox.style.display = ""; }
    console.error(e);
  }
}

// ── Init ───────────────────────────────────────────────────────────────────
(function init() {
  // Theme
  if (localStorage.getItem("theme") === "light") document.body.classList.remove("theme-dark");
  else document.body.classList.add("theme-dark");

  const themeBtn = document.getElementById("themeToggle");
  themeBtn?.addEventListener("click", () => {
    const dark = document.body.classList.toggle("theme-dark");
    localStorage.setItem("theme", dark ? "dark" : "light");
    themeBtn.textContent = dark ? "🌞" : "🌙";
  });

  // Search filter
  document.getElementById("searchBox")?.addEventListener("input", function () {
    const q = this.value.toLowerCase();
    document.querySelectorAll("#tblBody tr").forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });

  // Refresh button
  document.getElementById("btnRefresh")?.addEventListener("click", load);

  // Set date defaults then load
  setDefaults();
  load();
})();

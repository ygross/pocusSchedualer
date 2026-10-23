const _dir    = window.location.pathname.replace(/\/[^\/]*$/, "");
const API_BASE = `${window.location.origin}${_dir}/api/api`;
const $ = id => document.getElementById(id);

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
  el.className = "msg" + (kind ? " " + kind : "");
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
}

function fmtDt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL", {
    day:"2-digit", month:"2-digit", year:"numeric",
    hour:"2-digit", minute:"2-digit"
  });
}

function fmtRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const date = s.toLocaleDateString("he-IL", { day:"2-digit", month:"2-digit", year:"numeric" });
  const ts   = s.toLocaleTimeString("he-IL", { hour:"2-digit", minute:"2-digit" });
  const te   = e.toLocaleTimeString("he-IL", { hour:"2-digit", minute:"2-digit" });
  return `${date} · ${ts}–${te}`;
}

async function load() {
  setMsg("טוען נתונים…");
  try {
    const rows = await fetchJson(`${API_BASE}/lead/conflicts`) || [];
    render(rows);
    setMsg("");
  } catch(e) { setMsg("שגיאה: " + e.message, "err"); }
}

function render(rows) {
  const container = $("conflictsList");

  if (!rows.length) {
    $("statConflicts").textContent   = "0";
    $("statInstructors").textContent = "0";
    $("summaryLine").textContent     = "";
    container.innerHTML = `<div class="no-conflicts">✅ לא נמצאו התנגשויות — כל השיבוצים תקינים!</div>`;
    return;
  }

  const uniqueInstructors = new Set(rows.map(r => r.instructorId));
  $("statConflicts").textContent   = rows.length;
  $("statInstructors").textContent = uniqueInstructors.size;
  $("summaryLine").textContent     = `${rows.length} התנגשויות · ${uniqueInstructors.size} מדריכים`;

  // Group by instructor
  const byInstructor = {};
  for (const r of rows) {
    if (!byInstructor[r.instructorId]) byInstructor[r.instructorId] = { name: r.fullName, pairs: [] };
    byInstructor[r.instructorId].pairs.push(r);
  }

  container.innerHTML = Object.entries(byInstructor).map(([id, info]) => `
    <div class="conflict-card">
      <div class="conflict-instructor">⚠️ ${info.name} <span style="font-size:11px;color:var(--muted);font-weight:400">(ID ${id})</span></div>
      ${info.pairs.map(p => `
        <div class="conflict-pair" style="margin-bottom:8px">
          <div class="conflict-activity">
            <div class="conflict-name">${p.activity1}</div>
            <div class="conflict-time">${fmtRange(p.start1, p.end1)}</div>
            <div style="font-size:10px;color:var(--muted2)">מופע ${p.instanceId1}</div>
          </div>
          <div class="conflict-vs">⚡<br>חפיפה</div>
          <div class="conflict-activity">
            <div class="conflict-name">${p.activity2}</div>
            <div class="conflict-time">${fmtRange(p.start2, p.end2)}</div>
            <div style="font-size:10px;color:var(--muted2)">מופע ${p.instanceId2}</div>
          </div>
        </div>
      `).join("")}
    </div>
  `).join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  $("themeToggle")?.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    $("themeToggle").textContent = next === "dark" ? "🌙" : "☀️";
  });
  if (localStorage.getItem("theme") === "light") $("themeToggle").textContent = "☀️";

  try {
    const me = await fetchJson(`${API_BASE}/me`);
    if (me) { $("meName").textContent = me.fullName || me.email || "—"; $("meRole").textContent = me.roleName || "—"; }
  } catch { /* non-fatal */ }

  $("refreshBtn").addEventListener("click", load);
  await load();
});

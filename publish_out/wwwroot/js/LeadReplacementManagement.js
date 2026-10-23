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
  return new Date(iso).toLocaleString("he-IL", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

let rows = [];

async function load() {
  setMsg("טוען נתונים…");
  try {
    rows = await fetchJson(`${API_BASE}/lead/needs-attention`) || [];
    render();
    setMsg("");
  } catch(e) { setMsg("שגיאה: " + e.message, "err"); }
}

function render() {
  const tbody = $("tableBody");

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-row">✅ כל המופעים מכוסים — אין פעולה נדרשת!</td></tr>`;
    $("statTotal").textContent = "0";
    $("statCancelled").textContent = "0";
    $("statAvail").textContent = "0";
    $("summaryLine").textContent = "";
    return;
  }

  const totalCancelled = rows.reduce((s, r) => s + r.recentCancellations, 0);
  const totalAvail     = rows.reduce((s, r) => s + r.availableCount, 0);
  $("statTotal").textContent     = rows.length;
  $("statCancelled").textContent = totalCancelled;
  $("statAvail").textContent     = totalAvail;
  $("summaryLine").textContent   = `${rows.length} מופעים דורשים טיפול`;

  tbody.innerHTML = rows.map(r => {
    const missing  = r.requiredInstructors - r.assignedCount;
    const urgClass = missing > 2 ? "pill pill-red" : missing > 0 ? "pill pill-amber" : "pill pill-green";
    const cancBadge = r.recentCancellations > 0
      ? `<span class="pill pill-red">${r.recentCancellations} ביטולים</span>` : "—";
    const availBadge = r.availableCount > 0
      ? `<span class="pill pill-blue">${r.availableCount} פנויים</span>` : `<span class="pill pill-gray">0</span>`;

    return `<tr>
      <td><b>${r.activityName}</b><br><small style="color:var(--muted)">ID ${r.activityId} · מופע ${r.instanceId}</small></td>
      <td>${fmtDt(r.startUtc)}</td>
      <td>${r.requiredInstructors}</td>
      <td>${r.assignedCount}</td>
      <td><span class="${urgClass}">${missing}</span></td>
      <td>${availBadge}</td>
      <td>${cancBadge}</td>
      <td>
        <button class="btn btn-primary btn-sm" type="button"
          onclick="goAssign(${r.activityId})">שיבוץ →</button>
      </td>
    </tr>`;
  }).join("");
}

function goAssign(activityId) {
  const base = _dir || "";
  window.top.location.href = `${base}/leadassignment.html`;
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

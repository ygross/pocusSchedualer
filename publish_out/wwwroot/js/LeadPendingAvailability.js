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
    rows = await fetchJson(`${API_BASE}/lead/pending-availability`) || [];
    render();
    setMsg("");
  } catch(e) { setMsg("שגיאה: " + e.message, "err"); }
}

function render() {
  const tbody = $("tableBody");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-row">✅ אין מופעים עם זמינות ממתינה — הכל מטופל!</td></tr>`;
    $("summaryLine").textContent = "";
    return;
  }

  const totalPending = rows.reduce((s, r) => s + r.stillPending, 0);
  $("summaryLine").textContent = `${rows.length} מופעים · ${totalPending} בקשות ממתינות`;

  tbody.innerHTML = rows.map(r => {
    const urgency = r.stillPending >= r.requiredInstructors ? "pill pill-red" : "pill pill-amber";
    return `<tr>
      <td><b>${r.activityName}</b><br><small style="color:var(--muted)">ID ${r.activityId}</small></td>
      <td>${fmtDt(r.startUtc)}</td>
      <td>${r.requiredInstructors}</td>
      <td>${r.totalRequested}</td>
      <td><span class="${urgency}">${r.stillPending}</span></td>
      <td>${r.responded}</td>
      <td>${r.declined}</td>
      <td>
        <button class="btn btn-secondary btn-sm btn-remind"
          data-iid="${r.instanceId}" data-aname="${r.activityName}"
          type="button">📨 שלח תזכורת</button>
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll(".btn-remind").forEach(btn => {
    btn.addEventListener("click", () => sendReminder(Number(btn.dataset.iid), btn.dataset.aname, btn));
  });
}

async function sendReminder(instanceId, activityName, btn) {
  if (!confirm(`לשלוח תזכורת לכל מי שלא הגיב עבור "${activityName}"?`)) return;
  btn.disabled = true;
  btn.textContent = "שולח…";
  try {
    const r = await fetchJson(
      `${API_BASE}/lead/instances/${instanceId}/send-availability-reminder`,
      { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyNotResponded: true }) }
    );
    if (!r) return;
    btn.textContent = `✅ נשלחו ${r.sentNow}`;
    setTimeout(() => { btn.textContent = "📨 שלח תזכורת"; btn.disabled = false; }, 3000);
  } catch(e) {
    alert("שגיאה: " + e.message);
    btn.textContent = "📨 שלח תזכורת";
    btn.disabled = false;
  }
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

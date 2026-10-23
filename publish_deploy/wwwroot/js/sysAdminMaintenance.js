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
  return new Date(iso).toLocaleString("en-GB", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit" });
}

function showResult(id, text, ok) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className = "action-result " + (ok ? "ok" : "err");
}

async function loadSysInfo() {
  try {
    const d = await fetchJson(`${API_BASE}/sysadmin/maintenance/system-info`);
    if (!d) return;
    $("sysInfoGrid").innerHTML = [
      ["Host",         d.host],
      ["OS",           d.os],
      [".NET",         d.dotNet],
      ["Process ID",   d.processId],
      ["Started (UTC)",fmtDt(d.appStartUtc)],
      ["Uptime",       `${d.uptimeMinutes} minutes`],
      ["Working Set",  `${d.workingSetMb} MB`],
      ["Server UTC",   fmtDt(d.nowUtc)]
    ].map(([k,v]) => `<div class="info-key">${k}</div><div class="info-val">${v ?? "—"}</div>`).join("");
  } catch(e) {
    $("sysInfoGrid").innerHTML = `<div class="info-key" style="color:var(--red)">Error: ${e.message}</div><div></div>`;
  }
}

async function doAction(name, btn) {
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = "Running…";
  try {
    const d = await fetchJson(`${API_BASE}/sysadmin/maintenance/${name}`, { method: "POST" });
    showResult(`res-${name}`, d?.message || "Done ✓", true);
  } catch(e) {
    showResult(`res-${name}`, "Error: " + e.message, false);
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

async function doClearOtps() {
  const days = parseInt($("otpDays").value) || 7;
  const btn = document.querySelector('[onclick="doClearOtps()"]');
  if (btn) { btn.disabled = true; btn.textContent = "Running…"; }
  try {
    const d = await fetchJson(`${API_BASE}/sysadmin/maintenance/clear-otps?olderThanDays=${days}`, { method: "POST" });
    showResult("res-clear-otps", `Deleted ${d?.deleted ?? 0} OTP records ✓`, true);
  } catch(e) {
    showResult("res-clear-otps", "Error: " + e.message, false);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Run"; }
  }
}

async function doPurgeLogs() {
  const days = parseInt($("purgeDays").value) || 90;
  if (!confirm(`⚠ Purge Logs\n\nמחיקת רשומות ישנות מ EmailSendLog, EmailOutbox ו AuditLog\nישנות מ-${days} ימים.\n\nפעולה בלתי הפיכה! להמשיך?`)) return;
  const btn = document.querySelector('[onclick="doPurgeLogs()"]');
  if (btn) { btn.disabled = true; btn.textContent = "Purging…"; }
  try {
    const d = await fetchJson(`${API_BASE}/sysadmin/maintenance/purge-logs?olderThanDays=${days}`, { method: "POST" });
    const r = d?.result || {};
    showResult("res-purge-logs",
      `Done ✓ — EmailSendLog: ${r.emailSendLogDeleted ?? 0} | EmailOutbox: ${r.emailOutboxDeleted ?? 0} | AuditLog: ${r.auditLogDeleted ?? 0}`,
      true);
  } catch (e) {
    showResult("res-purge-logs", "Error: " + e.message, false);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Purge"; }
  }
}

// expose to inline onclick
window.doAction    = doAction;
window.doClearOtps = doClearOtps;
window.doPurgeLogs = doPurgeLogs;

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

  await loadSysInfo();
});

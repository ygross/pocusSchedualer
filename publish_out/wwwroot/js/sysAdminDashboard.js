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

function infoRow(key, val) {
  return `<div class="info-key">${key}</div><div class="info-val">${val ?? "—"}</div>`;
}

async function load() {
  setMsg("Loading…");
  try {
    const d = await fetchJson(`${API_BASE}/sysadmin/dashboard`);
    if (!d) return;

    $("statInstructors").textContent  = d.activeInstructors ?? "—";
    $("statEmailsSent").textContent   = d.emailsSentToday  ?? "—";
    $("statEmailsFailed").textContent = d.emailsFailedToday ?? "—";
    $("statAudit").textContent        = d.auditActionsToday ?? "—";

    const startUtc = d.appStartUtc ? new Date(d.appStartUtc) : null;
    const uptime   = startUtc ? Math.round((Date.now() - startUtc) / 60000) : "—";
    $("statUptime").textContent = uptime;

    $("appGrid").innerHTML =
      infoRow("Host",       d.appHost) +
      infoRow(".NET",       d.dotNetVersion) +
      infoRow("OS",         d.os) +
      infoRow("Started",    fmtDt(d.appStartUtc)) +
      infoRow("Uptime",     typeof uptime === "number" ? `${uptime} min` : "—") +
      infoRow("SysAdmins",  d.sysAdminCount);

    $("dbGrid").innerHTML =
      infoRow("DB Time (UTC)", fmtDt(d.dbTimeUtc)) +
      infoRow("Status", `<span class="pill pill-green">✓ Connected</span>`);

    $("lastRefresh").textContent = "Last refresh: " + new Date().toLocaleTimeString("en-GB");
    setMsg("");
  } catch(e) {
    setMsg("Error: " + e.message, "err");
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

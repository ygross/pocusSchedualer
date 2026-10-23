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

function actionPill(a) {
  const map = { Create:"pill-green", Update:"pill-blue", Delete:"pill-red", SoftDelete:"pill-amber", SendEmail:"pill-purple" };
  const cls = map[a] || "pill-gray";
  return `<span class="pill ${cls}">${escHtml(a)}</span>`;
}

function shortJson(j) {
  if (!j) return "—";
  try {
    const o = JSON.parse(j);
    const keys = Object.keys(o).slice(0, 3);
    return keys.map(k => `${k}:${JSON.stringify(o[k])}`).join(", ").slice(0, 80);
  } catch { return String(j).slice(0, 80); }
}

async function load() {
  const entity  = $("filterEntity").value.trim() || null;
  const action  = $("filterAction").value.trim() || null;
  const actorId = parseInt($("filterActor").value) || null;
  const days    = parseInt($("filterDays").value) || 7;

  setMsg("Loading…");
  try {
    const qs = new URLSearchParams({ days });
    if (entity)  qs.set("entity",  entity);
    if (action)  qs.set("action",  action);
    if (actorId) qs.set("actorId", actorId);
    const rows = await fetchJson(`${API_BASE}/sysadmin/audit?${qs}`) || [];
    render(rows);
    setMsg("");
  } catch(e) { setMsg("Error: " + e.message, "err"); }
}

function render(rows) {
  $("summaryLine").textContent = `${rows.length} rows`;
  const tbody = $("tableBody");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-row">No audit rows found.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `<tr>
    <td style="font-size:11px;color:var(--muted)">${r.logId}</td>
    <td style="white-space:nowrap">
      ${r.actorName ? escHtml(r.actorName) : "—"}
      ${r.actorInstructorId ? `<br><span style="font-size:10px;color:var(--muted2)">ID ${r.actorInstructorId}</span>` : ""}
    </td>
    <td>${actionPill(r.action)}</td>
    <td style="font-size:12px">${escHtml(r.entity||"—")}</td>
    <td style="font-size:12px">${escHtml(r.entityId||"—")}</td>
    <td style="font-size:11px;color:var(--muted)">${escHtml(r.ip||"—")}</td>
    <td style="font-size:11px;color:var(--muted2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.detailsJson||"")}">${shortJson(r.detailsJson)}</td>
    <td style="white-space:nowrap;font-size:12px">${fmtDt(r.createdAtUtc)}</td>
  </tr>`).join("");
}

function escHtml(s) { return String(s||"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

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

  $("loadBtn").addEventListener("click", load);
  await load();
});

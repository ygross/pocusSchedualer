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
  return new Date(iso).toLocaleString("en-GB", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

function statusPill(s) {
  const map = { Sent:"pill-green", Failed:"pill-red", Queued:"pill-amber" };
  return `<span class="pill ${map[s]||'pill-gray'}">${s}</span>`;
}

let rows = [];

async function load() {
  const status = $("filterStatus").value;
  const days   = $("filterDays").value;
  setMsg("Loading…");
  try {
    const qs = new URLSearchParams({ days });
    if (status) qs.set("status", status);
    rows = await fetchJson(`${API_BASE}/sysadmin/emails?${qs}`) || [];
    render();
    setMsg("");
  } catch(e) { setMsg("Error: " + e.message, "err"); }
}

function render() {
  const sent   = rows.filter(r => r.status === "Sent").length;
  const failed = rows.filter(r => r.status === "Failed").length;
  const queued = rows.filter(r => r.status === "Queued").length;
  $("statTotal").textContent  = rows.length;
  $("statSent").textContent   = sent;
  $("statFailed").textContent = failed;
  $("statQueued").textContent = queued;
  $("summaryLine").textContent = `${rows.length} emails`;

  const tbody = $("tableBody");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-row">No emails found for this filter.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `<tr>
    <td style="color:var(--muted);font-size:11px">${r.emailId}</td>
    <td>${escHtml(r.toEmail)}</td>
    <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.subject)}">${escHtml(r.subject)}</td>
    <td>${statusPill(r.status)}</td>
    <td style="font-size:11px;color:var(--muted)">${r.relatedEntity||""}${r.relatedId ? ` #${r.relatedId}`:""}</td>
    <td style="white-space:nowrap;font-size:12px">${fmtDt(r.createdAtUtc)}</td>
    <td style="white-space:nowrap;font-size:12px">${fmtDt(r.sentAtUtc)}</td>
    <td style="max-width:160px;font-size:11px;color:var(--red);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.failReason||"")}">${r.failReason||"—"}</td>
    <td>${r.status==="Failed"
      ? `<button class="btn btn-primary btn-sm" onclick="resend(${r.emailId},this)">Resend</button>`
      : ""}</td>
  </tr>`).join("");
}

async function resend(id, btn) {
  btn.disabled = true;
  btn.textContent = "…";
  try {
    await fetchJson(`${API_BASE}/sysadmin/emails/${id}/resend`, { method: "POST" });
    btn.textContent = "✓";
    btn.className = "btn btn-sm";
    // refresh the row status locally
    const r = rows.find(x => x.emailId === id);
    if (r) { r.status = "Queued"; r.failReason = null; }
    render();
  } catch(e) {
    btn.disabled = false;
    btn.textContent = "Resend";
    setMsg("Resend failed: " + e.message, "err");
  }
}

async function resendAll() {
  const failed = rows.filter(r => r.status === "Failed");
  if (!failed.length) { setMsg("No failed emails to resend.", "err"); return; }
  if (!confirm(`Resend all ${failed.length} failed emails?`)) return;
  setMsg(`Resending ${failed.length} emails…`);
  let ok = 0, errs = 0;
  for (const r of failed) {
    try { await fetchJson(`${API_BASE}/sysadmin/emails/${r.emailId}/resend`, { method: "POST" }); ok++; }
    catch { errs++; }
  }
  setMsg(`Done — ${ok} queued, ${errs} errors.`, errs ? "err" : "ok");
  await load();
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
  $("resendAllBtn").addEventListener("click", resendAll);
  await load();
});

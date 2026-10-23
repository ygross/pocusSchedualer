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

function escHtml(s) { return String(s||"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

async function load() {
  const days = parseInt($("filterDays").value) || 7;
  setMsg("Loading…");
  try {
    const d = await fetchJson(`${API_BASE}/sysadmin/errors?days=${days}`);
    if (!d) return;

    const fe = d.failedEmails || [];
    const eo = d.exhaustedOtps || [];

    $("statEmailFails").textContent = fe.length;
    $("statOtpFails").textContent   = eo.length;
    $("summaryLine").textContent    = `${fe.length + eo.length} issues`;

    $("emailBody").innerHTML = fe.length ? fe.map(r => `<tr>
      <td style="font-size:11px;color:var(--muted)">${r.logId}</td>
      <td style="font-size:11px;color:var(--muted)">${r.emailId||"—"}</td>
      <td>${escHtml(r.toEmail)}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.subject)}">${escHtml(r.subject)}</td>
      <td><span class="pill pill-gray">${escHtml(r.provider)}</span></td>
      <td>${r.attemptNo}</td>
      <td style="color:var(--red);font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.failReason||"")}">${escHtml(r.failReason||"—")}</td>
      <td style="white-space:nowrap;font-size:12px">${fmtDt(r.createdAtUtc)}</td>
    </tr>`).join("") :
    `<tr><td colspan="8" class="empty-row">✅ No failed email sends in this period.</td></tr>`;

    $("otpBody").innerHTML = eo.length ? eo.map(r => `<tr>
      <td style="font-size:11px;color:var(--muted)">${r.otpId}</td>
      <td>${escHtml(r.email)}</td>
      <td><span class="pill pill-red">${r.attempts}</span></td>
      <td>${r.maxAttempts}</td>
      <td>${r.isUsed ? '<span class="pill pill-green">Yes</span>' : '<span class="pill pill-gray">No</span>'}</td>
      <td style="white-space:nowrap;font-size:12px">${fmtDt(r.expiresAtUtc)}</td>
      <td style="white-space:nowrap;font-size:12px">${fmtDt(r.createdAtUtc)}</td>
    </tr>`).join("") :
    `<tr><td colspan="7" class="empty-row">✅ No exhausted OTP attempts in this period.</td></tr>`;

    setMsg("");
  } catch(e) { setMsg("Error: " + e.message, "err"); }
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

  $("loadBtn").addEventListener("click", load);
  await load();
});

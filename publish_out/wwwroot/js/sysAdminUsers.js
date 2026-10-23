const _dir    = window.location.pathname.replace(/\/[^\/]*$/, "");
const API_BASE = `${window.location.origin}${_dir}/api/api`;
const $ = id => document.getElementById(id);

const ROLES    = ["Admin", "CourseManager", "Instructor", "SystemAdmin"];
const STATUSES = ["active", "approved", "inactive", "suspended", "pendingApproval"];

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

function escHtml(s) { return String(s||"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

let allRows = [];

async function load() {
  const role   = $("filterRole").value   || null;
  const status = $("filterStatus").value || null;
  setMsg("Loading…");
  try {
    const qs = new URLSearchParams();
    if (role)   qs.set("role", role);
    if (status) qs.set("status", status);
    allRows = await fetchJson(`${API_BASE}/sysadmin/instructors?${qs}`) || [];
    render();
    setMsg("");
  } catch(e) { setMsg("Error: " + e.message, "err"); }
}

function render() {
  const q = ($("filterSearch").value || "").toLowerCase();
  const rows = q
    ? allRows.filter(r => (r.fullName + " " + r.email).toLowerCase().includes(q))
    : allRows;

  $("statTotal").textContent = allRows.length;
  $("statAdmins").textContent = allRows.filter(r => r.roleName === "Admin").length;
  $("statCM").textContent     = allRows.filter(r => r.roleName === "CourseManager").length;
  $("statInst").textContent   = allRows.filter(r => r.roleName === "Instructor").length;
  $("statSys").textContent    = allRows.filter(r => r.roleName === "SystemAdmin").length;
  $("summaryLine").textContent = `${rows.length} users`;

  const tbody = $("tableBody");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">No users found.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const roleOpts = ROLES.map(ro =>
      `<option value="${ro}" ${ro === r.roleName ? "selected" : ""}>${ro}</option>`
    ).join("");
    const stOpts = STATUSES.map(st =>
      `<option value="${st}" ${st === r.status ? "selected" : ""}>${st}</option>`
    ).join("");
    return `<tr id="row-${r.instructorId}">
      <td style="font-size:11px;color:var(--muted)">${r.instructorId}</td>
      <td><b>${escHtml(r.fullName)}</b></td>
      <td style="font-size:12px">${escHtml(r.email)}</td>
      <td>
        <select class="role-select" id="role-${r.instructorId}" onchange="markChanged(${r.instructorId})">
          ${roleOpts}
        </select>
      </td>
      <td>
        <select class="status-select" id="status-${r.instructorId}" onchange="markChanged(${r.instructorId})">
          ${stOpts}
        </select>
      </td>
      <td style="font-size:12px;color:var(--muted)">${escHtml(r.department || "—")}</td>
      <td>
        <button class="btn btn-primary save-btn" type="button" onclick="saveUser(${r.instructorId})">Save</button>
        <span id="saved-${r.instructorId}" style="font-size:11px;color:var(--green);display:none;margin-left:4px">✓</span>
      </td>
    </tr>`;
  }).join("");
}

function markChanged(id) {
  const row = $(`row-${id}`);
  if (row) row.classList.add("changed");
  const ok = $(`saved-${id}`);
  if (ok) ok.style.display = "none";
}

async function saveUser(id) {
  const role   = $(`role-${id}`)?.value;
  const status = $(`status-${id}`)?.value;
  if (!role || !status) return;

  const btn = document.querySelector(`#row-${id} .save-btn`);
  if (btn) { btn.disabled = true; btn.textContent = "…"; }

  try {
    await fetchJson(`${API_BASE}/sysadmin/instructors/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, status })
    });
    const row = $(`row-${id}`);
    if (row) row.classList.remove("changed");
    const ok = $(`saved-${id}`);
    if (ok) { ok.style.display = "inline"; setTimeout(() => { ok.style.display = "none"; }, 3000); }
    // update local data
    const r = allRows.find(x => x.instructorId === id);
    if (r) { r.roleName = role; r.status = status; }
    // refresh stats
    $("statAdmins").textContent = allRows.filter(r => r.roleName === "Admin").length;
    $("statCM").textContent     = allRows.filter(r => r.roleName === "CourseManager").length;
    $("statInst").textContent   = allRows.filter(r => r.roleName === "Instructor").length;
    $("statSys").textContent    = allRows.filter(r => r.roleName === "SystemAdmin").length;
  } catch(e) {
    setMsg(`Error saving user ${id}: ${e.message}`, "err");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Save"; }
  }
}

// expose to inline onclick
window.saveUser    = saveUser;
window.markChanged = markChanged;

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
  $("filterSearch").addEventListener("input", render);
  await load();
});

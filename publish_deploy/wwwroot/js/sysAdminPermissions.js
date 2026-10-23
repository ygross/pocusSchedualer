const _dir    = window.location.pathname.replace(/\/[^\/]*$/, "");
const API_BASE = `${window.location.origin}${_dir}/api/api`;
const $ = id => document.getElementById(id);

// ─── helpers ────────────────────────────────────────────────────────────────
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

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, c =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function roleBadge(role) {
  const cls = role === "SystemAdmin" ? "rbg-sysadmin"
            : role === "Admin"        ? "rbg-admin"
            : role === "CourseManager"? "rbg-cm"
            : "rbg-inst";
  return `<span class="role-badge ${cls}">${esc(role || "Instructor")}</span>`;
}

// ─── state ───────────────────────────────────────────────────────────────────
let allUsers = [];
let myId     = null;

// ─── load ─────────────────────────────────────────────────────────────────────
async function load() {
  setMsg("טוען…");
  try {
    allUsers = await fetchJson(`${API_BASE}/sysadmin/instructors`) || [];
    updateStats();
    renderTable();
    setMsg("");
  } catch(e) { setMsg("שגיאה בטעינה: " + e.message, "err"); }
}

function updateStats() {
  $("statTotal").textContent = allUsers.length;
  $("statSys").textContent   = allUsers.filter(u => u.roleName === "SystemAdmin").length;
  $("statAdmin").textContent  = allUsers.filter(u => u.roleName === "Admin").length;
  $("statCM").textContent     = allUsers.filter(u => u.roleName === "CourseManager").length;
  $("statInst").textContent   = allUsers.filter(u => u.roleName === "Instructor").length;
}

// ─── render ──────────────────────────────────────────────────────────────────
function renderTable() {
  const q       = ($("searchInput").value || "").toLowerCase().trim();
  const roleFilter = $("filterRole").value || "";

  const rows = allUsers.filter(u => {
    if (roleFilter && u.roleName !== roleFilter) return false;
    if (q && !(u.fullName || "").toLowerCase().includes(q)
          && !(u.email    || "").toLowerCase().includes(q)) return false;
    return true;
  });

  $("summaryLine").textContent = `${rows.length} ממשתמשים`;

  if (!rows.length) {
    $("tableBody").innerHTML = `<tr><td colspan="5" class="empty-row">לא נמצאו משתמשים</td></tr>`;
    return;
  }

  $("tableBody").innerHTML = rows.map(u => {
    const role = u.roleName || "Instructor";
    const isSelf = (myId !== null && u.instructorId === myId);

    // Build action buttons based on current role
    let actions = "";
    if (isSelf) {
      actions = `<span style="font-size:12px;color:var(--muted)">— זה אתה —</span>`;
    } else if (role === "SystemAdmin") {
      actions = `
        <div class="action-group">
          <button class="btn btn-sm btn-grant-admin" type="button"
            data-id="${u.instructorId}" data-status="${esc(u.status)}"
            data-role="Admin" onclick="confirmGrant(this)">
            ▼ הפחת ל-Admin
          </button>
          <button class="btn btn-sm btn-revoke" type="button"
            data-id="${u.instructorId}" data-status="${esc(u.status)}"
            data-role="Instructor" onclick="confirmGrant(this)">
            ✕ בטל הרשאות
          </button>
        </div>`;
    } else if (role === "Admin") {
      actions = `
        <div class="action-group">
          <button class="btn btn-sm btn-grant-sys" type="button"
            data-id="${u.instructorId}" data-status="${esc(u.status)}"
            data-role="SystemAdmin" onclick="confirmGrant(this)">
            ▲ הרם ל-SysAdmin
          </button>
          <button class="btn btn-sm btn-revoke" type="button"
            data-id="${u.instructorId}" data-status="${esc(u.status)}"
            data-role="Instructor" onclick="confirmGrant(this)">
            ✕ בטל הרשאות
          </button>
        </div>`;
    } else {
      // Instructor or CourseManager
      actions = `
        <div class="action-group">
          <button class="btn btn-sm btn-grant-admin" type="button"
            data-id="${u.instructorId}" data-status="${esc(u.status)}"
            data-role="Admin" onclick="confirmGrant(this)">
            ★ הפוך ל-Admin
          </button>
          <button class="btn btn-sm btn-grant-sys" type="button"
            data-id="${u.instructorId}" data-status="${esc(u.status)}"
            data-role="SystemAdmin" onclick="confirmGrant(this)">
            ⚑ הפוך ל-SysAdmin
          </button>
          ${role !== "CourseManager" ? `
          <button class="btn btn-sm btn-grant-cm" type="button"
            data-id="${u.instructorId}" data-status="${esc(u.status)}"
            data-role="CourseManager" onclick="confirmGrant(this)">
            ◈ מרכז קורס
          </button>` : `
          <button class="btn btn-sm btn-revoke" type="button"
            data-id="${u.instructorId}" data-status="${esc(u.status)}"
            data-role="Instructor" onclick="confirmGrant(this)">
            ✕ בטל CourseManager
          </button>`}
        </div>`;
    }

    return `<tr id="urow-${u.instructorId}">
      <td><b>${esc(u.fullName)}</b></td>
      <td style="font-size:12px;color:var(--muted)">${esc(u.email)}</td>
      <td style="font-size:12px;color:var(--muted)">${esc(u.department || "—")}</td>
      <td id="role-cell-${u.instructorId}">${roleBadge(role)}</td>
      <td>${actions}</td>
    </tr>
    <tr id="confirm-row-${u.instructorId}" style="display:none">
      <td colspan="5">
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;font-size:13px;color:var(--red)">
          <span id="confirm-text-${u.instructorId}"></span>
          <button class="btn btn-sm btn-danger" type="button"
            id="confirm-yes-${u.instructorId}" onclick="applyGrant(${u.instructorId})">אישור</button>
          <button class="btn btn-sm btn-revoke" type="button"
            onclick="cancelConfirm(${u.instructorId})">ביטול</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

// ─── confirm flow ─────────────────────────────────────────────────────────────
let pendingGrant = {}; // { [id]: { role, status } }

function confirmGrant(btn) {
  const id     = parseInt(btn.dataset.id);
  const role   = btn.dataset.role;
  const status = btn.dataset.status || "active";

  pendingGrant[id] = { role, status };

  const roleLabel = { SystemAdmin:"SysAdmin", Admin:"Admin",
    CourseManager:"CourseManager", Instructor:"Instructor (ביטול הרשאות)" };

  $(`confirm-text-${id}`).textContent =
    `האם לשנות תפקיד ל-${roleLabel[role] || role}? (המשתמש יצטרך להתחבר מחדש)`;
  $(`confirm-row-${id}`).style.display = "";
}

function cancelConfirm(id) {
  delete pendingGrant[id];
  $(`confirm-row-${id}`).style.display = "none";
}

async function applyGrant(id) {
  const p = pendingGrant[id];
  if (!p) return;

  const yesBtn = $(`confirm-yes-${id}`);
  if (yesBtn) { yesBtn.disabled = true; yesBtn.textContent = "…"; }

  try {
    await fetchJson(`${API_BASE}/sysadmin/instructors/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: p.role, status: p.status })
    });

    // Update local data
    const u = allUsers.find(x => x.instructorId === id);
    if (u) u.roleName = p.role;

    // Update stats and role cell without full re-render
    updateStats();
    const cell = $(`role-cell-${id}`);
    if (cell) cell.innerHTML = roleBadge(p.role);

    $(`confirm-row-${id}`).style.display = "none";
    delete pendingGrant[id];

    // Flash the row green
    const row = $(`urow-${id}`);
    if (row) {
      row.classList.add("changed-row");
      setTimeout(() => row.classList.remove("changed-row"), 2500);
    }

    setMsg(`✓ תפקיד עודכן ל-${p.role}`, "ok");
    setTimeout(() => setMsg(""), 4000);

    // Re-render only that row's action buttons
    renderTable();

  } catch(e) {
    setMsg(`שגיאה: ${e.message}`, "err");
    if (yesBtn) { yesBtn.disabled = false; yesBtn.textContent = "אישור"; }
  }
}

// expose to inline onclick
window.confirmGrant  = confirmGrant;
window.cancelConfirm = cancelConfirm;
window.applyGrant    = applyGrant;
window.renderTable   = renderTable;
window.load          = load;

// ─── init ─────────────────────────────────────────────────────────────────────
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
    if (me) {
      $("meName").textContent = me.fullName || me.email || "—";
      $("meRole").textContent = me.roleName || "—";
      myId = me.instructorId ?? null;
    }
  } catch { /* non-fatal */ }

  await load();
});

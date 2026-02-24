// adminPendingApprovals.js
// =====================================================
// CONFIG
// =====================================================
const _appPath = new URL(".", window.location.href).pathname;
const API_BASE = (window.API_BASE || "").trim() || `${window.location.origin}${_appPath}api`;
document.getElementById("apiBaseLabel").textContent = API_BASE;

// =====================================================
// AUTH (display only)
// =====================================================
function getOtpName() {
  return localStorage.getItem("otp_name") || sessionStorage.getItem("otp_name") || "ADMIN";
}
function getOtpRole() {
  return localStorage.getItem("otp_role") || sessionStorage.getItem("otp_role") || "Admin";
}
function setHeaderIdentity() {
  const name = getOtpName();
  const role = getOtpRole();
  const meLine = document.getElementById("meLine");
  const roleLine = document.getElementById("roleLine");
  if (meLine) meLine.textContent = `משתמש: ${name}`;
  if (roleLine) roleLine.textContent = `תפקיד: ${role}`;
}
setHeaderIdentity();

// =====================================================
// HELPERS
// =====================================================
const $ = (id) => document.getElementById(id);

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function normalizeStr(v) {
  return safeText(v).toLowerCase().trim();
}

function formatDate(v) {
  if (!v) return "-";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return safeText(v);
    // ISO-ish, readable
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch {
    return safeText(v);
  }
}

async function fetchJson(url, options) {
  const r = await fetch(url, { credentials: "include", ...options });
  const ct = r.headers.get("content-type") || "";
  const data = ct.includes("application/json")
    ? await r.json().catch(() => null)
    : await r.text().catch(() => null);
  return { r, data };
}

function setTopMsg(text, kind = "muted") {
  const el = $("topMsg");
  if (!el) return;
  el.textContent = text || "";
  el.className = `msg ${kind}`;
}

function setListMsg(text, kind = "muted") {
  const el = $("listMsg");
  if (!el) return;
  el.textContent = text || "";
  el.className = `msg ${kind}`;
}

function setErr(text) {
  const el = $("errMsg");
  if (!el) return;
  if (!text) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.style.display = "block";
  el.textContent = text;
}

function setBadges(count) {
  const countBadge = $("countBadge");
  if (countBadge) countBadge.textContent = `סה״כ: ${count}`;

  const modeBadge = $("modeBadge");
  if (modeBadge) modeBadge.textContent = "מצב: צפייה";
}

function setDbHealth(ok) {
  const el = $("healthLine");
  if (!el) return;
  el.textContent = `DB: ${ok ? "תקין" : "שגיאה"}`;
  el.style.opacity = "0.95";
}

// =====================================================
// DATA + RENDER
// =====================================================
let allItems = [];

function getItemField(x, ...keys) {
  for (const k of keys) {
    if (x && x[k] !== undefined && x[k] !== null) return x[k];
  }
  return "";
}

function renderTable(items) {
  const tbody = $("tblBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!items || !items.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:18px;">
          אין בקשות ממתינות
        </td>
      </tr>`;
    setBadges(0);
    return;
  }

  let idx = 0;
  for (const x of items) {
    idx++;

    const id = getItemField(x, "instructorId", "id", "InstructorId");
    const email = getItemField(x, "email", "Email");
    const fullName = getItemField(x, "fullName", "name", "FullName");
    const phone = getItemField(x, "phone", "Phone");
    const department = getItemField(x, "department", "Department");
    const status = getItemField(x, "status", "Status") || "Pending";
    const createdAt =
      getItemField(x, "createdAt", "created_at", "created", "CreatedAt", "createdOn") || "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="width:70px">${safeText(id) || safeText(idx)}</td>
      <td>${safeText(email)}</td>
      <td>${safeText(fullName)}</td>
      <td>${safeText(phone)}</td>
      <td>${safeText(department)}</td>
      <td><span class="badgePending">${safeText(status)}</span></td>
      <td style="width:170px">${formatDate(createdAt)}</td>
      <td style="width:260px">
        <button class="primary" style="padding:7px 10px;border-radius:10px" data-act="approve" data-id="${safeText(
          id
        )}">אשר</button>
        <button class="danger" style="padding:7px 10px;border-radius:10px" data-act="decline" data-id="${safeText(
          id
        )}">דחה</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  setBadges(items.length);
}

function applyFilterAndRender() {
  const q = normalizeStr($("q")?.value || "");
  if (!q) {
    renderTable(allItems);
    setListMsg(allItems.length ? "" : "אין בקשות ממתינות", "muted");
    return;
  }

  const filtered = allItems.filter((x) => {
    const email = normalizeStr(getItemField(x, "email", "Email"));
    const name = normalizeStr(getItemField(x, "fullName", "name", "FullName"));
    const dept = normalizeStr(getItemField(x, "department", "Department"));
    const phone = normalizeStr(getItemField(x, "phone", "Phone"));
    const id = normalizeStr(getItemField(x, "instructorId", "id", "InstructorId"));
    return (
      email.includes(q) ||
      name.includes(q) ||
      dept.includes(q) ||
      phone.includes(q) ||
      id.includes(q)
    );
  });

  renderTable(filtered);
  setListMsg(`מציג ${filtered.length} מתוך ${allItems.length}`, "muted");
}

// =====================================================
// API CALLS
// =====================================================
async function checkDbHealth() {
  const { r } = await fetchJson(`${API_BASE}/health/db`);
  return r.ok;
}

async function loadPending() {
  const { r, data } = await fetchJson(`${API_BASE}/admin/pending-approvals`);
  if (!r.ok) {
    const msg =
      (data && typeof data === "object" && (data.message || data.error)) ||
      (typeof data === "string" ? data : "");
    throw new Error(`loadPending failed: HTTP ${r.status}${msg ? ` | ${msg}` : ""}`);
  }
  if (!Array.isArray(data)) return [];
  return data;
}

async function approve(id) {
  const { r, data } = await fetchJson(`${API_BASE}/admin/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instructorId: Number(id) })
  });
  if (!r.ok) {
    const msg =
      (data && typeof data === "object" && (data.message || data.error)) ||
      (typeof data === "string" ? data : "");
    throw new Error(`approve failed: HTTP ${r.status}${msg ? ` | ${msg}` : ""}`);
  }
}

async function decline(id) {
  const { r, data } = await fetchJson(`${API_BASE}/admin/decline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instructorId: Number(id) })
  });
  if (!r.ok) {
    const msg =
      (data && typeof data === "object" && (data.message || data.error)) ||
      (typeof data === "string" ? data : "");
    throw new Error(`decline failed: HTTP ${r.status}${msg ? ` | ${msg}` : ""}`);
  }
}

// =====================================================
// UI EVENTS
// =====================================================
document.addEventListener("click", async (e) => {
  const btn = e.target?.closest("button[data-act]");
  if (!btn) return;

  const act = btn.getAttribute("data-act");
  const id = btn.getAttribute("data-id");
  if (!id) return;

  try {
    setErr("");
    setTopMsg("מעדכן…", "muted");
    btn.disabled = true;

    if (act === "approve") await approve(id);
    if (act === "decline") await decline(id);

    setTopMsg("עודכן בהצלחה. מרענן רשימה…", "ok");
    allItems = await loadPending();
    applyFilterAndRender();
    setTopMsg("נטען בהצלחה", "ok");
  } catch (err) {
    setTopMsg("שגיאה", "err");
    setErr(err?.message || "שגיאה");
  } finally {
    btn.disabled = false;
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  // wire search + refresh
  const q = $("q");
  if (q) q.addEventListener("input", applyFilterAndRender);

  const btnRefresh = $("btnRefresh");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", async () => {
      try {
        setErr("");
        setTopMsg("מרענן…", "muted");
        allItems = await loadPending();
        applyFilterAndRender();
        setTopMsg("עודכן", "ok");
      } catch (err) {
        setTopMsg("שגיאה", "err");
        setErr(err?.message || "שגיאה");
      }
    });
  }

  // initial load
  try {
    setErr("");
    setTopMsg("בודק חיבור DB…", "muted");
    const ok = await checkDbHealth();
    setDbHealth(ok);
    if (!ok) {
      setTopMsg("health/db נכשל – בדוק חיבור DB/שרת", "err");
      setErr("health/db נכשל – בדוק חיבור DB/שרת");
      renderTable([]);
      return;
    }

    setTopMsg("טוען בקשות ממתינות…", "muted");
    allItems = await loadPending();
    applyFilterAndRender();
    setTopMsg("נטען בהצלחה", "ok");
  } catch (err) {
    setDbHealth(false);
    setTopMsg("שגיאה בטעינה", "err");
    setErr(err?.message || "שגיאה בטעינה");
    renderTable([]);
  }
});
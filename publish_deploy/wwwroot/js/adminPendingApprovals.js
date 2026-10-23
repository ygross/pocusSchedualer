const API_BASE = `${window.location.pathname.replace(/\/[^\/]*$/, "")}/api`;
document.getElementById("apiBaseLabel").textContent = API_BASE;

const $ = (id) => document.getElementById(id);

function setStatus(message, ok = true) {
  const top = $("topMsg");
  const err = $("errMsg");
  if (ok) {
    top.textContent = message;
    err.style.display = "none";
    err.textContent = "";
  } else {
    err.style.display = "block";
    err.textContent = message;
  }
}

async function fetchJson(url, options = {}) {
  const r = await fetch(url, { credentials: "include", cache: "no-cache", ...options });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { r, data, text };
}

async function loadMe() {
  const { r, data } = await fetchJson(`${API_BASE}/me`);
  if (!r.ok) return;
  $("meLine").textContent = `משתמש: ${data.fullName || data.email || "—"}`;
  $("roleLine").textContent = `תפקיד: ${data.roleName || "—"}`;
}

async function checkDbHealth() {
  const { r, data } = await fetchJson(`${API_BASE}/health/db`);
  const ok = r.ok && (data?.ok === true || data?.status === "ok" || data?.healthy === true);
  $("healthLine").textContent = `DB: ${ok ? "תקין" : "שגיאה"}`;
  return ok;
}

async function loadPending() {
  const { r, data, text } = await fetchJson(`${API_BASE}/admin/pending-approvals`);
  if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
  return Array.isArray(data) ? data : [];
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("he-IL");
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTable(items) {
  const q = $("q").value.trim().toLowerCase();
  const filtered = items.filter(x => {
    if (!q) return true;
    return [x.email, x.fullName, x.department, x.phone, x.status]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q));
  });

  $("countBadge").textContent = `סה״כ: ${filtered.length}`;
  $("tblBody").innerHTML = filtered.map((x, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(x.email)}</td>
      <td>${esc(x.fullName)}</td>
      <td>${esc(x.phone || "—")}</td>
      <td>${esc(x.department || "—")}</td>
      <td>${esc(x.status || "PendingApproval")}</td>
      <td>${esc(fmtDate(x.createdAtUtc))}</td>
      <td>
        <button data-act="approve" data-id="${x.instructorId}">אשר</button>
        <button data-act="decline" data-id="${x.instructorId}" class="secondary">דחה</button>
      </td>
    </tr>`).join("");

  $("listMsg").textContent = filtered.length ? "" : "אין רשומות להצגה";
}

async function approve(instructorId) {
  const { r, text } = await fetchJson(`${API_BASE}/admin/pending-approvals/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instructorId: Number(instructorId) })
  });
  if (!r.ok) throw new Error(text || `approve failed (${r.status})`);
}

async function decline(instructorId) {
  const { r, text } = await fetchJson(`${API_BASE}/admin/pending-approvals/decline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instructorId: Number(instructorId) })
  });
  if (!r.ok) throw new Error(text || `decline failed (${r.status})`);
}

let currentItems = [];

async function reload() {
  currentItems = await loadPending();
  renderTable(currentItems);
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;

  const act = btn.dataset.act;
  const id = btn.dataset.id;
  btn.disabled = true;
  try {
    if (act === "approve") await approve(id);
    if (act === "decline") await decline(id);
    setStatus("עודכן בהצלחה", true);
    await reload();
  } catch (err) {
    setStatus(err?.message || "שגיאה", false);
  } finally {
    btn.disabled = false;
  }
});

$("btnRefresh").addEventListener("click", async () => {
  try {
    setStatus("מרענן…", true);
    await reload();
  } catch (err) {
    setStatus(err?.message || "שגיאה", false);
  }
});

$("q").addEventListener("input", () => renderTable(currentItems));

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadMe();
    await checkDbHealth();
    await reload();
    setStatus("נטען בהצלחה", true);
  } catch (err) {
    setStatus(err?.message || "שגיאה בטעינה", false);
  }
});

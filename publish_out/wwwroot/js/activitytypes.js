// ActivityTypes JS (fixed)
const APP_BASE = (() => {
  const p = window.location.pathname;
  return p.substring(0, p.lastIndexOf("/") + 1);
})();
const API_BASE = APP_BASE + "api";

const EP = {
  activityTypes: `${API_BASE}/api/activity-types`,
  me: `${API_BASE}/api/me`,
  healthDb: `${API_BASE}/api/health/db`
};

const elTypeName = document.getElementById("typeName");
const elBtnSave = document.getElementById("btnSave");
const elBtnClear = document.getElementById("btnClear");
const elBtnRefresh = document.getElementById("btnRefresh");
const elQ = document.getElementById("q");
const elTblBody = document.getElementById("tblBody");
const elCountBadge = document.getElementById("countBadge");
const elModeBadge = document.getElementById("modeBadge");
const elFormMsg = document.getElementById("formMsg");
const elListMsg = document.getElementById("listMsg");
const elMeLine = document.getElementById("meLine");
const elRoleLine = document.getElementById("roleLine");
const elHealthLine = document.getElementById("healthLine");
const elApiBaseLabel = document.getElementById("apiBaseLabel");
elApiBaseLabel.textContent = API_BASE;

let all = [];
let editId = null;

function setMsg(el, text, kind = "muted") { el.textContent = text || ""; el.className = `msg ${kind}`; }
function esc(s) { return (s ?? "").toString().replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function setMode() {
  if (editId) { elModeBadge.textContent = `מצב: עריכה (#${editId})`; elBtnSave.textContent = "עדכן"; }
  else { elModeBadge.textContent = "מצב: חדש"; elBtnSave.textContent = "שמור"; }
}
function resetForm() { editId = null; elTypeName.value = ""; setMode(); setMsg(elFormMsg, "", "muted"); }

async function httpJson(url, opts = {}) {
  const res = await fetch(url, { credentials: "include", headers: { "Accept": "application/json", ...(opts.headers || {}) }, ...opts });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${res.status} ${t}`.trim());
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  return null;
}

async function loadMe() {
  try { const me = await httpJson(EP.me); elMeLine.textContent = `משתמש: ${me?.fullName || me?.email || "לא ידוע"}`; elRoleLine.textContent = `תפקיד: ${me?.roleName || "לא ידוע"}`; }
  catch { elMeLine.textContent = "משתמש: לא מחובר"; elRoleLine.textContent = "תפקיד: -"; }
}
async function loadHealth() {
  try { const h = await httpJson(EP.healthDb); elHealthLine.textContent = `DB: ${h?.ok ? "תקין ✅" : "לא תקין ❌"}`; }
  catch { elHealthLine.textContent = "DB: לא זמין ❌"; }
}
function render() {
  const q = (elQ.value || "").trim().toLowerCase();
  const filtered = all.filter(x => !q || String(x.typeName || "").toLowerCase().includes(q));
  elCountBadge.textContent = String(filtered.length);
  elTblBody.innerHTML = filtered.length ? filtered.map((x, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${esc(x.typeName)}</td>
      <td>
        <button class="secondary" onclick="editType(${x.activityTypeId})">ערוך</button>
        <button class="danger" onclick="deleteType(${x.activityTypeId})">מחק</button>
      </td>
    </tr>`).join("") : `<tr><td colspan="3" class="muted">אין נתונים</td></tr>`;
}
async function loadList() {
  setMsg(elListMsg, "טוען רשימה...", "muted");
  all = await httpJson(EP.activityTypes).catch(() => []);
  if (!Array.isArray(all)) all = [];
  render();
  setMsg(elListMsg, `נטענו ${all.length} סוגים`, "ok");
}
window.editType = function(id) {
  const row = all.find(x => Number(x.activityTypeId) === Number(id));
  if (!row) return;
  editId = id;
  elTypeName.value = row.typeName || "";
  setMode();
  setMsg(elFormMsg, `עריכת סוג פעילות #${id}`, "ok");
}
window.deleteType = async function(id) {
  if (!confirm("למחוק את סוג הפעילות?")) return;
  try {
    await httpJson(`${EP.activityTypes}/${id}`, { method: "DELETE" });
    await loadList();
    resetForm();
  } catch (err) { setMsg(elListMsg, err.message, "err"); }
}
async function saveType() {
  const name = (elTypeName.value || "").trim();
  if (!name) { setMsg(elFormMsg, "יש למלא שם", "err"); return; }
  try {
    if (editId) {
      await httpJson(`${EP.activityTypes}/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typeName: name }) });
    } else {
      await httpJson(EP.activityTypes, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typeName: name }) });
    }
    resetForm();
    await loadList();
    setMsg(elFormMsg, "נשמר בהצלחה", "ok");
  } catch (err) { setMsg(elFormMsg, err.message, "err"); }
}
document.addEventListener("DOMContentLoaded", async () => {
  setMode();
  elBtnSave?.addEventListener("click", saveType);
  elBtnClear?.addEventListener("click", resetForm);
  elBtnRefresh?.addEventListener("click", loadList);
  elQ?.addEventListener("input", render);
  await loadMe();
  await loadHealth();
  await loadList();
});
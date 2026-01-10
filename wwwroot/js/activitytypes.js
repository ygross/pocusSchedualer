// =====================================
// ActivityTypes JS
// FIX: no "api/api" + supports virtual directory
// API endpoints:
//   GET    {API_BASE}/activity-types
//   POST   {API_BASE}/activity-types
//   PUT    {API_BASE}/activity-types/{id}
//   DELETE {API_BASE}/activity-types/{id}
//   GET    {API_BASE}/me
//   GET    {API_BASE}/health/db
// =====================================

// מחשב את בסיס התיקייה הנוכחית: /simcenter/PocusSchedualer/
const APP_BASE = (() => {
    const p = window.location.pathname;
    return p.substring(0, p.lastIndexOf("/") + 1);
  })();
  
  // בסיס API תקין בתוך אותה אפליקציה: /simcenter/PocusSchedualer/api
  const API_BASE = APP_BASE + "api";
  
  // Endpoints
  const EP = {
    activityTypes: `${API_BASE}/api/activity-types`,
    me: `${API_BASE}/me`,
    healthDb: `${API_BASE}/health/db`
  };
  
  // UI
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
  
  // State
  let all = [];
  let editId = null;
  
  // Helpers
  function setMsg(el, text, kind = "muted") {
    el.textContent = text || "";
    el.className = `msg ${kind}`;
  }
  
  function esc(s) {
    return (s ?? "").toString()
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
  
  function setMode() {
    if (editId) {
      elModeBadge.textContent = `מצב: עריכה (#${editId})`;
      elBtnSave.textContent = "עדכן";
    } else {
      elModeBadge.textContent = "מצב: חדש";
      elBtnSave.textContent = "שמור";
    }
  }
  
  function resetForm() {
    editId = null;
    elTypeName.value = "";
    setMode();
    setMsg(elFormMsg, "", "muted");
  }
  
  // API wrappers
  async function httpJson(url, opts = {}) {
    const res = await fetch(url, {
      credentials: "include",
      headers: { "Accept": "application/json", ...(opts.headers || {}) },
      ...opts
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`${res.status} ${t}`.trim());
    }
    // ייתכן NoContent
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
    return null;
  }
  
  async function loadMe() {
    try {
      const me = await httpJson(EP.me);
      elMeLine.textContent = `משתמש: ${me?.fullName || me?.email || "לא ידוע"}`;
      elRoleLine.textContent = `תפקיד: ${me?.roleName || "לא ידוע"}`;
    } catch {
      // אם אין סשן/OTP -> Unauthorized
      elMeLine.textContent = "משתמש: לא מחובר";
      elRoleLine.textContent = "תפקיד: -";
    }
  }
  
  async function loadHealth() {
    try {
      const h = await httpJson(EP.healthDb);
      elHealthLine.textContent = `DB: ${h?.ok ? "תקין ✅" : "לא תקין ❌"}`;
    } catch {
      elHealthLine.textContent = "DB: לא זמין ❌";
    }
  }
  
  async function loadAll() {
    setMsg(elListMsg, "טוען נתונים…", "muted");
    try {
      const data = await httpJson(EP.activityTypes);
      all = Array.isArray(data) ? data : [];
      render();
      setMsg(elListMsg, "", "muted");
    } catch (e) {
      setMsg(elListMsg, `שגיאה בטעינה: ${e.message}`, "err");
    }
  }
  
  function filtered() {
    const q = (elQ.value || "").trim().toLowerCase();
    if (!q) return all.slice();
    return all.filter(x => (x.typeName || "").toLowerCase().includes(q));
  }
  
  function render() {
    const rows = filtered();
    elTblBody.innerHTML = "";
  
    rows.forEach((x, idx) => {
      const id = x.activityTypeId;
      const name = x.typeName || "";
  
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${esc(name)} <span class="mono" style="color:#6b7280">(#${id})</span></td>
        <td>
          <button class="secondary" data-act="edit" data-id="${id}" data-name="${esc(name)}">✏️ עריכה</button>
          <button class="danger" data-act="del" data-id="${id}" data-name="${esc(name)}">🗑️ מחיקה</button>
        </td>
      `;
      elTblBody.appendChild(tr);
    });
  
    elCountBadge.textContent = `סה״כ: ${rows.length}`;
  }
  
  async function save() {
    const name = (elTypeName.value || "").trim();
    if (!name) {
      setMsg(elFormMsg, "יש להזין שם סוג פעילות.", "err");
      return;
    }
  
    elBtnSave.disabled = true;
    setMsg(elFormMsg, "שומר…", "muted");
  
    try {
      if (editId) {
        await httpJson(`${EP.activityTypes}/${encodeURIComponent(editId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activityTypeId: editId, typeName: name })
        });
        setMsg(elFormMsg, "עודכן בהצלחה ✅", "ok");
      } else {
        await httpJson(EP.activityTypes, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ typeName: name })
        });
        setMsg(elFormMsg, "נוצר בהצלחה ✅", "ok");
      }
  
      resetForm();
      await loadAll();
    } catch (e) {
      // אם עדיין אין POST/PUT בשרת -> תקבל 405/404
      setMsg(elFormMsg, `שגיאה בשמירה: ${e.message}`, "err");
    } finally {
      elBtnSave.disabled = false;
    }
  }
  
  async function del(id, name) {
    if (!confirm(`למחוק את סוג הפעילות:\n"${name}" ?`)) return;
  
    setMsg(elListMsg, "מוחק…", "muted");
    try {
      await httpJson(`${EP.activityTypes}/${encodeURIComponent(id)}`, { method: "DELETE" });
      setMsg(elListMsg, "נמחק בהצלחה ✅", "ok");
      if (editId === id) resetForm();
      await loadAll();
    } catch (e) {
      setMsg(elListMsg, `שגיאה במחיקה: ${e.message}`, "err");
    }
  }
  
  // Events
  elBtnSave.addEventListener("click", save);
  elBtnClear.addEventListener("click", resetForm);
  elBtnRefresh.addEventListener("click", loadAll);
  elQ.addEventListener("input", render);
  
  elTblBody.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;
  
    const act = btn.dataset.act;
    const id = Number(btn.dataset.id);
    const name = btn.dataset.name || "";
  
    if (act === "edit") {
      editId = id;
      elTypeName.value = name;
      setMode();
      setMsg(elFormMsg, `מצב עריכה פעיל עבור #${id}`, "ok");
    }
    if (act === "del") del(id, name);
  });
  
  // Init
  resetForm();
  loadMe();
  loadHealth();
  loadAll();
  
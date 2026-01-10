// activities-list.js
// List + filters + click to load instances (using /activities/edit/{id} that includes instances)

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);

function setMsg(text, kind = "") {
  const el = $("msg");
  el.className = "msg" + (kind ? " " + kind : "");
  el.textContent = text || "";
}

function esc(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function pad2(n){ return String(n).padStart(2,"0"); }
function fmtNice(dt){
  if(!dt) return "-";
  const d = new Date(dt);
  return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ---------- API base auto-detect (api vs api/api) ----------
const APP_PATH = new URL(".", window.location.href).pathname; // ends with '/'
const API_CANDIDATES = [
  `${window.location.origin}${APP_PATH}api`,
  `${window.location.origin}${APP_PATH}api/api`
];
let API_BASE = API_CANDIDATES[0];

function EP(){
  return {
    me: `${API_BASE}/me`,
    activityTypes: `${API_BASE}/activity-types`,
    search: (qs) => `${API_BASE}/activities/search?${qs}`,
    getEdit: (id) => `${API_BASE}/activities/edit/${encodeURIComponent(id)}`
  };
}

async function fetchTry(url, opts = {}){
  return await fetch(url, { credentials: "include", ...opts });
}

async function httpJson(url, opts = {}){
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Accept":"application/json", ...(opts.headers || {}) },
    ...opts
  });
  if(!res.ok){
    const t = await res.text().catch(()=> "");
    throw new Error(`${res.status} ${t}`.trim());
  }
  const ct = res.headers.get("content-type") || "";
  if(ct.includes("application/json")) return await res.json();
  return null;
}

async function detectApiBase(){
  for(const cand of API_CANDIDATES){
    const res = await fetchTry(`${cand}/activity-types`);
    if(res.ok){
      API_BASE = cand;
      $("apiBase").textContent = API_BASE;
      return;
    }
  }
  $("apiBase").textContent = API_BASE;
  setMsg(`לא נמצא API תקין. ניסיתי: ${API_CANDIDATES.join(" , ")}`, "err");
}

// ---------- UI: fill types ----------
async function loadTypes(){
  const types = await httpJson(EP().activityTypes);
  const sel = $("fType");
  sel.innerHTML = "";

  // "הכל"
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "הכל";
  sel.appendChild(all);

  for(const t of types){
    const opt = document.createElement("option");
    opt.value = t.activityTypeId;
    opt.textContent = t.typeName;
    sel.appendChild(opt);
  }
}

// ---------- Load user ----------
async function loadMe(){
  try{
    const me = await httpJson(EP().me);
    const name = me.fullName || me.email || "לא ידוע";
    const role = me.roleName || "-";
    $("topUser").textContent = `${name} • ${role}`;
  }catch{
    $("topUser").textContent = "לא מחובר";
  }
}

// ---------- Render list ----------
const instCache = new Map(); // activityId -> instances array
const openSet = new Set();   // currently expanded ids

function renderRows(rows){
  const tb = $("tbody");
  tb.innerHTML = rows.map(r => {
    const isOpen = openSet.has(r.activityId);
    return `
      <tr class="rowClick" data-id="${r.activityId}">
        <td>${r.activityId}</td>
        <td>${esc(r.activityName)}</td>
        <td>${esc(r.typeName)}</td>
        <td>${esc(r.courseName || "-")}</td>
        <td>${r.nextStartUtc ? esc(fmtNice(r.nextStartUtc)) : "-"}</td>
        <td>${isOpen ? '<span class="pill">פתוח</span>' : '<span class="pill">הצג</span>'}</td>
      </tr>
      <tr id="inst_${r.activityId}" style="display:${isOpen ? "table-row" : "none"}">
        <td colspan="6">
          <div class="instWrap">
            <div class="instTitle">
              <div>
                <b>מופעים לפעילות #${r.activityId}</b>
                <span class="small"> • לחץ שוב כדי לסגור</span>
              </div>
              <div id="instState_${r.activityId}" class="loadingInline"></div>
            </div>
            <div id="instBody_${r.activityId}"></div>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// ---------- Fetch list ----------
async function searchOrAll(showAll){
  setMsg(showAll ? "טוען את כל הפעילויות…" : "מחפש…");
  const qs = new URLSearchParams();

  if(!showAll){
    const id = Number($("fId").value || "0") || null;
    const name = ($("fName").value || "").trim();
    const typeId = $("fType").value ? Number($("fType").value) : null;

    if(id) qs.set("activityId", String(id));
    if(name) qs.set("name", name);
    if(typeId) qs.set("activityTypeId", String(typeId));
  }

  qs.set("take", "200");

  const rows = await httpJson(EP().search(qs.toString()));
  renderRows(Array.isArray(rows) ? rows : []);
  setMsg(`מוצגות ${rows.length} פעילויות`, "ok");
}

// ---------- Instances (click to expand) ----------
function renderInstances(activityId, instances){
  const wrap = $(`instBody_${activityId}`);
  if(!instances || instances.length === 0){
    wrap.innerHTML = `<div class="small">אין מופעים לפעילות זו.</div>`;
    return;
  }

  // טבלה קטנה למופעים (Start/End/Rooms/Required)
  wrap.innerHTML = `
    <div style="overflow:auto;border-radius:12px">
      <table class="table">
        <thead>
          <tr>
            <th>התחלה</th>
            <th>סיום</th>
            <th style="width:140px">כמות חדרים</th>
            <th style="width:160px">נדרשים מדריכים</th>
          </tr>
        </thead>
        <tbody>
          ${instances.map(x => `
            <tr>
              <td>${esc(fmtNice(x.startUtc))}</td>
              <td>${esc(fmtNice(x.endUtc))}</td>
              <td>${x.roomsCount ?? 0}</td>
              <td>${x.requiredInstructors ?? 0}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function toggleInstances(activityId){
  const row = $(`inst_${activityId}`);
  if(!row) return;

  // close
  if(openSet.has(activityId)){
    openSet.delete(activityId);
    row.style.display = "none";
    return;
  }

  // open
  openSet.add(activityId);
  row.style.display = "table-row";

  const state = $(`instState_${activityId}`);
  const body = $(`instBody_${activityId}`);
  state.textContent = "טוען מופעים…";
  body.innerHTML = "";

  try{
    // cache: מביאים דרך getEdit שמחזיר Instances
    if(!instCache.has(activityId)){
      const dto = await httpJson(EP().getEdit(activityId));
      instCache.set(activityId, dto.instances || []);
    }
    const instances = instCache.get(activityId);
    state.textContent = `סה"כ מופעים: ${instances.length}`;
    renderInstances(activityId, instances);
  }catch(e){
    state.textContent = "";
    body.innerHTML = `<div class="msg err">שגיאה בטעינת מופעים: ${esc(e.message)}</div>`;
  }
}

// ---------- Bind events ----------
function bind(){
  $("btnShowAll").addEventListener("click", () => searchOrAll(true).catch(e => setMsg(e.message, "err")));
  $("btnSearch").addEventListener("click", () => searchOrAll(false).catch(e => setMsg(e.message, "err")));
  $("btnClear").addEventListener("click", () => {
    $("fId").value = "";
    $("fName").value = "";
    $("fType").value = "";
    $("tbody").innerHTML = "";
    setMsg("");
  });

  // click row delegation
  $("tbody").addEventListener("click", (ev) => {
    const tr = ev.target.closest("tr.rowClick");
    if(!tr) return;
    const id = Number(tr.dataset.id);
    toggleInstances(id);
  });

  // optional: enter key triggers search
  $("fName").addEventListener("keydown", (e) => { if(e.key === "Enter") $("btnSearch").click(); });
  $("fId").addEventListener("keydown", (e) => { if(e.key === "Enter") $("btnSearch").click(); });
}

// ---------- Init ----------
(async function init(){
  await detectApiBase();
  await loadMe();
  await loadTypes();
  bind();

  // Auto show all on open
  await searchOrAll(true);
})().catch(e => setMsg(e.message, "err"));

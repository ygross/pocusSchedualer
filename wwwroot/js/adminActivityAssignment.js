// AdminAssignment.js
const APP_BASE = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
const API_BASE = APP_BASE + "api/api";
const $ = (id) => document.getElementById(id);

function pad2(n){ return String(n).padStart(2,"0"); }
function fmtDate(utcIso){ const d = new Date(utcIso); return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }
function fmtTimeRange(a,b){ const s = new Date(a), e = new Date(b); return `${pad2(s.getHours())}:${pad2(s.getMinutes())}–${pad2(e.getHours())}:${pad2(e.getMinutes())}`; }
function esc(s){ return (s ?? "").toString().replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function setMsg(elId, text, kind=""){ const el = $(elId); if(!el) return; el.className = "msg" + (kind ? " " + kind : ""); el.textContent = text || ""; }

async function fetchTry(url, opts={}){ return await fetch(url, { credentials:"include", headers:{ "Accept":"application/json", ...(opts.headers||{}) }, ...opts }); }
async function httpJson(url, opts={}){ const res = await fetchTry(url, opts); if(!res.ok){ const t = await res.text().catch(()=> ""); throw new Error(`${res.status} ${t}`); } const ct = res.headers.get("content-type") || ""; if(ct.includes("application/json")) return await res.json(); return null; }

function EP(){
  return {
    me: `${API_BASE}/me`,
    types: `${API_BASE}/activity-types`,
    leadActivities: (typeId)=> `${API_BASE}/lead/activities?take=400${typeId?`&activityTypeId=${encodeURIComponent(typeId)}`:""}`,
    leadActivity: (activityId)=> `${API_BASE}/lead/activities/${encodeURIComponent(activityId)}`,
    eligible: (activityId)=> `${API_BASE}/lead/activities/${encodeURIComponent(activityId)}/eligible-instructors`,
    availability: (instanceId)=> `${API_BASE}/lead/instances/${encodeURIComponent(instanceId)}/availability`,
    reminder: (instanceId)=> `${API_BASE}/lead/instances/${encodeURIComponent(instanceId)}/send-availability-reminder`,
    approve: (instanceId)=> `${API_BASE}/lead/instances/${encodeURIComponent(instanceId)}/approve`,
    fairness: (instanceId)=> `${API_BASE}/lead/instances/${encodeURIComponent(instanceId)}/fairness`,
  };
}

async function loadHeader(){
  if($("apiBaseLabel")) $("apiBaseLabel").textContent = API_BASE;
  try{
    const me = await httpJson(EP().me);
    if($("meLine")) $("meLine").textContent = "משתמש: " + (me.fullName || me.email || "לא ידוע");
    if($("roleLine")) $("roleLine").textContent = "תפקיד: " + (me.roleName || "-");
  }catch{
    if($("meLine")) $("meLine").textContent = "משתמש: לא מחובר";
    if($("roleLine")) $("roleLine").textContent = "תפקיד: -";
  }
}

// ----- State -----
let types = [];
let activities = [];
let selectedActivityId = null;
let activityDetails = null;
let eligibleList = [];
let instanceStats = new Map();
let modal = { instanceId: null, required: 0, assigned: 0, activityId: null, fairness: new Map(), availability: new Map() };

function availabilityRank(status){
  const s = (status||"").toUpperCase();
  if(s==="APPROVED" || s==="AVAILABLE") return 0;
  if(s==="MAYBE" || s==="SUBMITTED" || s==="REQUESTED") return 1;
  if(s==="NOT_AVAILABLE") return 3;
  if(s==="REJECTED") return 4;
  return 2;
}
function availabilityLabel(status){
  const s = (status||"").toUpperCase();
  if(s==="AVAILABLE") return "זמין";
  if(s==="MAYBE") return "אולי";
  if(s==="NOT_AVAILABLE") return "לא זמין";
  if(s==="SUBMITTED") return "הוגש";
  if(s==="REQUESTED") return "התבקש";
  if(s==="APPROVED") return "אושר";
  if(s==="REJECTED") return "נדחה";
  return !s ? "לא הוגש" : status;
}
function isAssignedRow(r){ return Number(r?.isAssigned ?? r?.IsAssigned ?? 0) === 1; }

async function loadTypes(){
  types = await httpJson(EP().types).catch(()=>[]);
  if($("typeSel")){
    $("typeSel").innerHTML = `<option value="">הכל</option>` + types.map(t=>`<option value="${t.activityTypeId}">${esc(t.typeName)}</option>`).join("");
    $("typeSel").addEventListener("change", ()=> loadActivities());
  }
}

async function loadActivities(){
  setMsg("activityMsg", "טוען פעילויות…");
  if($("activitySel")) $("activitySel").innerHTML = `<option value="">טוען…</option>`;
  resetInstancesUI();
  const typeId = $("typeSel")?.value ? Number($("typeSel").value) : null;
  activities = await httpJson(EP().leadActivities(typeId)).catch(()=>[]);
  if(!Array.isArray(activities)) activities = [];
  if($("activitySel")){
    $("activitySel").innerHTML = `<option value="">בחר פעילות…</option>` + activities.map(a=>{
      const txt = `#${a.activityId} • ${a.activityName} • ${a.typeName}${a.courseName ? " • " + a.courseName : ""}`;
      return `<option value="${a.activityId}">${esc(txt)}</option>`;
    }).join("");
  }
  setMsg("activityMsg", `נטענו ${activities.length} פעילויות`, "ok");
}
function resetInstancesUI(){ if($("instancesBody")) $("instancesBody").innerHTML = `<tr><td colspan="8" class="muted">בחר פעילות כדי לראות מופעים.</td></tr>`; setMsg("instancesMsg",""); }
if($("activitySel")) $("activitySel").addEventListener("change", onPickActivity);
if($("btnReload")) $("btnReload").addEventListener("click", loadActivities);

async function onPickActivity(){
  const id = Number($("activitySel")?.value || "0") || null;
  selectedActivityId = id; activityDetails = null; eligibleList = []; instanceStats.clear();
  resetInstancesUI();
  if(!id){ setMsg("activityMsg", "בחר פעילות.", ""); return; }
  setMsg("activityMsg", "טוען פעילות ומופעים…");
  const [details, eligible] = await Promise.all([ httpJson(EP().leadActivity(id)), httpJson(EP().eligible(id)) ]);
  activityDetails = details; eligibleList = Array.isArray(eligible) ? eligible : [];
  const inst = Array.isArray(activityDetails?.instances) ? activityDetails.instances : [];
  if(inst.length===0){ if($("instancesBody")) $("instancesBody").innerHTML = `<tr><td colspan="8" class="muted">אין מופעים לפעילות זו.</td></tr>`; setMsg("activityMsg", "נטען. אין מופעים.", "ok"); return; }
  const promises = inst.map(async x=>{
    const rows = await httpJson(EP().availability(x.instanceId)).catch(()=>[]);
    const required = Number(x.requiredInstructors || 0);
    const availCount = Array.isArray(rows) ? rows.length : 0;
    const assignedCount = Array.isArray(rows) ? rows.filter(isAssignedRow).length : 0;
    instanceStats.set(x.instanceId, { required, availCount, assignedCount, rows });
  });
  await Promise.all(promises); renderInstances(); setMsg("activityMsg", "נטען.", "ok");
}

function renderInstances(){
  const inst = Array.isArray(activityDetails?.instances) ? activityDetails.instances : [];
  if(inst.length===0){ if($("instancesBody")) $("instancesBody").innerHTML = `<tr><td colspan="8" class="muted">אין מופעים.</td></tr>`; return; }
  if($("instancesBody")){
    $("instancesBody").innerHTML = inst.map((x, idx)=>{
      const st = instanceStats.get(x.instanceId) || {required:0,availCount:0,assignedCount:0,rows:[]};
      const missing = Math.max(0, st.required - st.assignedCount);
      const pillCls = missing>0 ? "bad" : "ok";
      return `<tr>
        <td>${idx+1}</td>
        <td>${esc(fmtDate(x.startsAtUtc))}</td>
        <td>${esc(fmtTimeRange(x.startsAtUtc, x.endsAtUtc))}</td>
        <td>${esc(x.location || "-")}</td>
        <td>${st.required}</td>
        <td>${st.assignedCount}</td>
        <td><span class="pill ${pillCls}">${missing>0?`חסר ${missing}`:"מלא"}</span></td>
        <td><button class="btn primary" onclick="openAssignModal(${x.instanceId}, ${st.required}, ${st.assignedCount})">פתח שיבוץ</button></td>
      </tr>`;
    }).join("");
  }
}

window.openAssignModal = async function(instanceId, required, assigned){
  modal.instanceId = instanceId; modal.required = required; modal.assigned = assigned; modal.fairness = new Map(); modal.availability = new Map();
  setMsg("modalMsg", "טוען נתוני שיבוץ…");
  $("assignOverlay").style.display = "flex";
  const [fair, avail] = await Promise.all([ httpJson(EP().fairness(instanceId)).catch(()=>[]), httpJson(EP().availability(instanceId)).catch(()=>[]) ]);
  (Array.isArray(fair) ? fair : []).forEach(x=> modal.fairness.set(Number(x.instructorId), Number(x.approvedInMonth || 0)));
  (Array.isArray(avail) ? avail : []).forEach(x=> modal.availability.set(Number(x.instructorId), x));
  renderCandidates();
  setMsg("modalMsg", "");
}

window.closeAssignModal = function(){ $("assignOverlay").style.display = "none"; }

function renderCandidates(){
  const q = ($("candQ")?.value || "").trim().toLowerCase();
  const rows = [...eligibleList].map(x=>{
    const row = modal.availability.get(Number(x.instructorId)) || {};
    return { ...x, availabilityStatus: row.status || "", isAssigned: isAssignedRow(row), approvedInMonth: modal.fairness.get(Number(x.instructorId)) ?? 0 };
  }).filter(x=>{
    if(!q) return true;
    return [x.fullName, x.email, x.department].filter(Boolean).some(v=> String(v).toLowerCase().includes(q));
  }).sort((a,b)=> (a.approvedInMonth - b.approvedInMonth) || (availabilityRank(a.availabilityStatus) - availabilityRank(b.availabilityStatus)) || String(a.fullName||"").localeCompare(String(b.fullName||""),"he"));
  $("candBody").innerHTML = rows.map(x=>`<tr>
    <td>${esc(x.fullName)}</td>
    <td>${esc(x.email || "-")}</td>
    <td>${esc(availabilityLabel(x.availabilityStatus))}</td>
    <td>${x.approvedInMonth}</td>
    <td>${x.isAssigned ? '<span class="pill ok">כבר שובץ</span>' : `<button class="btn primary" onclick="approveInstructor(${x.instructorId})">שבץ</button>`}</td>
  </tr>`).join("");
}

window.approveInstructor = async function(instructorId){
  setMsg("modalMsg", "שומר שיבוץ…");
  await httpJson(EP().approve(modal.instanceId), { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ instructorIds:[Number(instructorId)] }) });
  await onPickActivity();
  await openAssignModal(modal.instanceId, modal.required, modal.assigned + 1);
  setMsg("activityMsg", "השיבוץ נשמר.", "ok");
  setMsg("modalMsg", "השיבוץ נשמר.", "ok");
}

document.addEventListener("DOMContentLoaded", async ()=>{
  await loadHeader();
  await loadTypes();
  await loadActivities();
  $("candQ")?.addEventListener("input", renderCandidates);
});
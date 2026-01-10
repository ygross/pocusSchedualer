// AdminAssignment.js
// ADMIN: can assign eligible instructors even without availability.
// Uses fairness endpoint (NEW) to sort by "least approved assignments in month" first.
// FIX: Force API_BASE to /simcenter/PocusSchedualer/api/api (no auto-detection)

const API_BASE = `${window.location.origin}/simcenter/PocusSchedualer/api/api`;

const $ = (id) => document.getElementById(id);

function pad2(n){ return String(n).padStart(2,"0"); }
function fmtDate(utcIso){
  const d = new Date(utcIso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
}
function fmtTimeRange(a,b){
  const s = new Date(a), e = new Date(b);
  return `${pad2(s.getHours())}:${pad2(s.getMinutes())}–${pad2(e.getHours())}:${pad2(e.getMinutes())}`;
}
function esc(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function setMsg(elId, text, kind=""){
  const el = $(elId);
  if(!el) return;
  el.className = "msg" + (kind ? " " + kind : "");
  el.textContent = text || "";
}

async function fetchTry(url, opts={}){
  return await fetch(url, {
    credentials:"include",
    headers:{ "Accept":"application/json", ...(opts.headers||{}) },
    ...opts
  });
}
async function httpJson(url, opts={}){
  const res = await fetchTry(url, opts);
  if(!res.ok){
    const t = await res.text().catch(()=> "");
    throw new Error(`${res.status} ${t}`);
  }
  const ct = res.headers.get("content-type") || "";
  if(ct.includes("application/json")) return await res.json();
  return null;
}

function EP(){
  return {
    me: `${API_BASE}/me`,
    types: `${API_BASE}/activity-types`,

    // Activities list (admin)
    leadActivities: (typeId)=> `${API_BASE}/lead/activities?take=400${typeId?`&activityTypeId=${encodeURIComponent(typeId)}`:""}`,
    leadActivity: (activityId)=> `${API_BASE}/lead/activities/${encodeURIComponent(activityId)}`,
    eligible: (activityId)=> `${API_BASE}/lead/activities/${encodeURIComponent(activityId)}/eligible-instructors`,
    availability: (instanceId)=> `${API_BASE}/lead/instances/${encodeURIComponent(instanceId)}/availability`,
    reminder: (instanceId)=> `${API_BASE}/lead/instances/${encodeURIComponent(instanceId)}/send-availability-reminder`,
    approve: (instanceId)=> `${API_BASE}/lead/instances/${encodeURIComponent(instanceId)}/approve`,

    // NEW:
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
let activityDetails = null;   // includes instances
let eligibleList = [];        // all eligible by course (instructors)
let instanceStats = new Map();// instanceId -> { required, availCount, assignedCount, rows }

let modal = {
  instanceId: null,
  required: 0,
  assigned: 0,
  activityId: null,
  fairness: new Map(),      // instructorId -> approvedInMonth
  availability: new Map(),  // instructorId -> {status,isAssigned}
};

function availabilityRank(status){
  const s = (status||"").toUpperCase();
  if(s==="APPROVED") return 0;
  if(s==="AVAILABLE") return 0;
  if(s==="MAYBE") return 1;
  if(s==="SUBMITTED") return 1;
  if(s==="REQUESTED") return 1;
  if(s==="NOT_AVAILABLE") return 3;
  if(s==="REJECTED") return 4;
  if(!s) return 2;
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
  if(!s) return "לא הוגש";
  return status;
}
function isAssignedRow(r){
  return Number(r?.isAssigned ?? r?.IsAssigned ?? 0) === 1;
}

// ----- Load types + activities -----
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
    $("activitySel").innerHTML =
      `<option value="">בחר פעילות…</option>` +
      activities.map(a=>{
        const txt = `#${a.activityId} • ${a.activityName} • ${a.typeName}${a.courseName ? " • " + a.courseName : ""}`;
        return `<option value="${a.activityId}">${esc(txt)}</option>`;
      }).join("");
  }

  setMsg("activityMsg", `נטענו ${activities.length} פעילויות`, "ok");
}

function resetInstancesUI(){
  if($("instancesBody")) $("instancesBody").innerHTML = `<tr><td colspan="8" class="muted">בחר פעילות כדי לראות מופעים.</td></tr>`;
  setMsg("instancesMsg","");
}

if($("activitySel")) $("activitySel").addEventListener("change", onPickActivity);
if($("btnReload")) $("btnReload").addEventListener("click", loadActivities);

async function onPickActivity(){
  const id = Number($("activitySel")?.value || "0") || null;
  selectedActivityId = id;
  activityDetails = null;
  eligibleList = [];
  instanceStats.clear();

  resetInstancesUI();
  if(!id){
    setMsg("activityMsg", "בחר פעילות.", "");
    return;
  }

  setMsg("activityMsg", "טוען פעילות ומופעים…");
  const [details, eligible] = await Promise.all([
    httpJson(EP().leadActivity(id)),
    httpJson(EP().eligible(id))
  ]);

  activityDetails = details;
  eligibleList = Array.isArray(eligible) ? eligible : [];

  const inst = Array.isArray(activityDetails?.instances) ? activityDetails.instances : [];
  if(inst.length===0){
    if($("instancesBody")) $("instancesBody").innerHTML = `<tr><td colspan="8" class="muted">אין מופעים לפעילות זו.</td></tr>`;
    setMsg("activityMsg", "נטען. אין מופעים.", "ok");
    return;
  }

  // For each instance: pull availability rows and compute counts
  const promises = inst.map(async x=>{
    const rows = await httpJson(EP().availability(x.instanceId)).catch(()=>[]);
    const required = Number(x.requiredInstructors || 0);
    const availCount = Array.isArray(rows) ? rows.length : 0;
    const assignedCount = Array.isArray(rows) ? rows.filter(isAssignedRow).length : 0;

    instanceStats.set(x.instanceId, { required, availCount, assignedCount, rows });
  });

  await Promise.all(promises);
  renderInstances();
  setMsg("activityMsg", "נטען.", "ok");
}

function renderInstances(){
  const inst = Array.isArray(activityDetails?.instances) ? activityDetails.instances : [];
  if(inst.length===0){
    if($("instancesBody")) $("instancesBody").innerHTML = `<tr><td colspan="8" class="muted">אין מופעים.</td></tr>`;
    return;
  }

  if($("instancesBody")){
    $("instancesBody").innerHTML = inst.map((x, idx)=>{
      const st = instanceStats.get(x.instanceId) || {required:0,availCount:0,assignedCount:0,rows:[]};
      const missing = Math.max(0, st.required - st.assignedCount);
      const pillCls = missing>0 ? "bad" : "ok";

      return `
        <tr>
          <td>#${idx+1} • ${x.instanceId}</td>
          <td>${esc(fmtDate(x.startUtc))}</td>
          <td>${esc(fmtTimeRange(x.startUtc, x.endUtc))}</td>
          <td>${st.required}</td>
          <td>${st.assignedCount}</td>
          <td><span class="pill warn">${st.availCount}</span></td>
          <td><span class="pill ${pillCls}">${missing}</span></td>
          <td>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
              <button class="btn" onclick="sendReminder(${x.instanceId})">בקש זמינות</button>
              <button class="btn primary" onclick="openAssign(${x.instanceId})">שבץ (גם בלי זמינות)</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }
}

window.sendReminder = async function(instanceId){
  setMsg("instancesMsg", "שולח בקשת זמינות…");
  try{
    const res = await fetchTry(EP().reminder(instanceId), {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ onlyNotResponded:true })
    });
    if(!res.ok){
      const t = await res.text().catch(()=> "");
      throw new Error(`${res.status} ${t}`);
    }
    const j = await res.json().catch(()=> ({}));
    setMsg("instancesMsg", `נשלח. sent=${j.sent ?? "?"}`, "ok");
  }catch(e){
    setMsg("instancesMsg", "שגיאה: " + e.message, "err");
  }
}

window.openAssign = async function(instanceId){
  const st = instanceStats.get(instanceId) || {required:0,assignedCount:0,rows:[]};
  const missing = Math.max(0, st.required - st.assignedCount);

  modal.instanceId = instanceId;
  modal.required = st.required;
  modal.assigned = st.assignedCount;
  modal.activityId = selectedActivityId;

  $("mTitle").textContent = `שיבוץ למופע ${instanceId}`;
  $("mSub").textContent = `נדרש ${st.required} • שובצו ${st.assignedCount} • חסר ${missing} • רלוונטיים לקורס: ${eligibleList.length}`;
  $("mSearch").value = "";
  $("mNote").value = "";
  $("mLimit").value = "1";
  setMsg("mMsg","טוען טבלת צדק…");

  // build availability map (including assigned flag)
  modal.availability.clear();
  (st.rows || []).forEach(r=>{
    modal.availability.set(Number(r.instructorId ?? r.InstructorId), {
      status: r.status ?? r.Status ?? "",
      isAssigned: isAssignedRow(r)
    });
  });

  // fairness (NEW endpoint)
  modal.fairness.clear();
  try{
    const fairRows = await httpJson(EP().fairness(instanceId));
    (fairRows || []).forEach(fr=>{
      const id = Number(fr.instructorId ?? fr.InstructorId);
      const cnt = Number(fr.approvedInMonth ?? fr.ApprovedInMonth ?? 0);
      modal.fairness.set(id, cnt);
    });
    setMsg("mMsg", "נטען. ניתן לבחור מדריכים / לבחור אוטומטי לפי צדק.", "ok");
  }catch(e){
    setMsg("mMsg", "לא הצלחתי לטעון צדק. עדיין אפשר לשבץ ידנית. ("+e.message+")", "err");
  }

  renderModalList();
  openModal(true);
}

function openModal(on){
  $("overlay").style.display = on ? "flex" : "none";
}

$("btnClose").addEventListener("click", ()=> openModal(false));
$("overlay").addEventListener("click", (e)=>{ if(e.target.id==="overlay") openModal(false); });

$("mSearch").addEventListener("input", renderModalList);
$("mLimit").addEventListener("change", renderModalList);

$("btnAutoPick").addEventListener("click", ()=>{
  const st = instanceStats.get(modal.instanceId) || {required:0,assignedCount:0};
  const missing = Math.max(0, st.required - st.assignedCount);

  // clear
  Array.from(document.querySelectorAll(".pickIns")).forEach(x=> x.checked=false);

  // pick top N in current order
  const boxes = Array.from(document.querySelectorAll(".pickIns"));
  boxes.slice(0, missing).forEach(x=> x.checked=true);
});

$("btnApprove").addEventListener("click", approveSelected);

function renderModalList(){
  const st = instanceStats.get(modal.instanceId) || {required:0,assignedCount:0};
  const missing = Math.max(0, st.required - st.assignedCount);
  const limitOnly = $("mLimit").value === "1";
  const q = ($("mSearch").value || "").trim().toLowerCase();

  // merge eligible + availability + fairness
  const merged = eligibleList.map(ins=>{
    const id = Number(ins.instructorId ?? ins.InstructorId);
    const name = ins.fullName ?? ins.FullName ?? "";
    const email = ins.email ?? ins.Email ?? "";
    const av = modal.availability.get(id) || {status:"", isAssigned:false};
    const fair = modal.fairness.has(id) ? modal.fairness.get(id) : 999999;
    return { id, name, email, status: av.status, isAssigned: av.isAssigned, fair };
  })
  .filter(x=>{
    if(q && !(x.name.toLowerCase().includes(q) || (x.email||"").toLowerCase().includes(q))) return false;
    return true;
  })
  .sort((a,b)=>{
    // already assigned go last
    if(a.isAssigned !== b.isAssigned) return a.isAssigned ? 1 : -1;
    // fairness asc
    if(a.fair !== b.fair) return a.fair - b.fair;
    // availability rank
    const ra = availabilityRank(a.status);
    const rb = availabilityRank(b.status);
    if(ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, "he");
  });

  const list = $("mList");
  if(merged.length===0){
    list.innerHTML = `<div class="muted">אין מדריכים תואמים.</div>`;
    return;
  }

  list.innerHTML = `
    <div class="muted" style="margin:6px 0 10px">
      ${limitOnly ? `בחר עד ${missing} מדריכים (חסר)` : "בחר כל כמות (המערכת עדיין תבדוק מול Required)"}
    </div>
    ${merged.map(x=>{
      const lab = availabilityLabel(x.status);
      const fairTxt = (x.fair===999999) ? "—" : String(x.fair);
      const dis = x.isAssigned ? "disabled" : "";
      const note = x.isAssigned ? `<span class="pill ok">כבר שובץ</span>` : "";
      return `
        <label class="cand">
          <input type="checkbox" class="pickIns" value="${x.id}" ${dis}>
          <b>${esc(x.name)}</b>
          <span class="muted">${esc(x.email||"")}</span>
          <span class="pill warn">זמינות: ${esc(lab)}</span>
          <span class="pill">צדק: ${esc(fairTxt)}</span>
          ${note}
        </label>
      `;
    }).join("")}
  `;
}

async function approveSelected(){
  const st = instanceStats.get(modal.instanceId) || {required:0,assignedCount:0,rows:[]};
  const missing = Math.max(0, st.required - st.assignedCount);
  const limitOnly = $("mLimit").value === "1";

  const picked = Array.from(document.querySelectorAll(".pickIns:checked"))
    .map(x=> Number(x.value))
    .filter(x=> x>0);

  if(picked.length===0){
    setMsg("mMsg","לא נבחרו מדריכים.","err");
    return;
  }
  if(limitOnly && picked.length > missing){
    setMsg("mMsg",`בחרת יותר מהמותר. חסר=${missing}.`,"err");
    return;
  }

  setMsg("mMsg","מאשר שיבוץ…");
  try{
    const res = await fetchTry(EP().approve(modal.instanceId), {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ instructorIds: picked, note: ($("mNote").value||"").trim() || null })
    });
    if(!res.ok){
      const t = await res.text().catch(()=> "");
      throw new Error(`${res.status} ${t}`);
    }

    setMsg("mMsg","אושר! מרענן נתונים…","ok");

    // refresh this instance availability -> recompute counts
    const rows = await httpJson(EP().availability(modal.instanceId)).catch(()=>[]);
    const assignedCount = Array.isArray(rows) ? rows.filter(isAssignedRow).length : 0;
    instanceStats.set(modal.instanceId, {
      required: st.required,
      availCount: Array.isArray(rows)? rows.length : 0,
      assignedCount,
      rows
    });

    renderInstances();
    openModal(false);
    setMsg("instancesMsg","שיבוץ עודכן.","ok");
  }catch(e){
    setMsg("mMsg","שגיאה: "+e.message,"err");
  }
}

(async function init(){
  if($("apiBaseLabel")) $("apiBaseLabel").textContent = API_BASE;
  await loadHeader();
  await loadTypes();
  await loadActivities();
})();

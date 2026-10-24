// lead-assignment.js v3 — flat table layout

const KEY_API_BASE = 'pocus_api_base';
const basePath = new URL(".", window.location.href).pathname.replace(/\/+$/, "/");
const API_CANDIDATES = [
  sessionStorage.getItem(KEY_API_BASE),
  `${window.location.origin}${basePath}api/api`,
  `${window.location.origin}${basePath}api`
].filter(Boolean);
let API_BASE = API_CANDIDATES[0] ?? `${window.location.origin}${basePath}api/api`;

const $ = id => document.getElementById(id);

function pad2(n) { return String(n).padStart(2, "0"); }
function fmtDate(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
}
function fmtTime(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function esc(s) {
  return (s ?? "").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

async function fetchJ(url, opts={}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Accept": "application/json", ...(opts.headers||{}) },
    ...opts
  });
  if (!res.ok) { const t = await res.text().catch(()=>""); throw new Error(`${res.status} ${t}`); }
  const ct = res.headers.get("content-type")||"";
  return ct.includes("application/json") ? res.json() : null;
}

function EP() { return {
  me:          `${API_BASE}/me`,
  activities:  `${API_BASE}/lead/activities?take=400`,
  activity:    id => `${API_BASE}/lead/activities/${id}`,
  eligible:    id => `${API_BASE}/lead/activities/${id}/eligible-instructors`,
  avail:       id => `${API_BASE}/lead/instances/${id}/availability`,
  reminder:    id => `${API_BASE}/lead/instances/${id}/send-availability-reminder`,
  reqAvail:    id => `${API_BASE}/lead/instances/${id}/request-availability`,
  approve:     id => `${API_BASE}/lead/instances/${id}/approve`,
  fairness:    id => `${API_BASE}/lead/instances/${id}/fairness`,
};}

async function detectApi() {
  for (const c of API_CANDIDATES) {
    try {
      const r = await fetch(`${c}/me`,{credentials:"include"});
      if(r.ok||r.status===401||r.status===403){API_BASE=c;return;}
    } catch {}
  }
}

// ─── state ───────────────────────────────────────────────────────────────────
// allRows[i] = { actId, actName, typeName, courseName, instanceId, startUtc, endUtc,
//                required, requested, submitted, rejected, assigned }
let allRows = [];
// eligibleCache[actId] = array of eligible instructors
const eligibleCache = {};

function isAssigned(r) { return Number(r?.isAssigned ?? r?.IsAssigned ?? 0) === 1; }
function byStatus(arr, s) { return arr.filter(r => (r.status ?? r.Status ?? "").toUpperCase() === s).length; }

// ─── load all ────────────────────────────────────────────────────────────────
async function loadAll() {
  $("statusLabel").className = "pill muted";
  $("statusLabel").textContent = "טוען…";
  $("mainBody").innerHTML = `<tr><td colspan="10" class="muted" style="text-align:center;padding:20px">טוען…</td></tr>`;
  $("mainMsg").textContent = "";

  const raw = await fetchJ(EP().activities);
  const acts = (Array.isArray(raw) ? raw : []).filter(a => a.nextStartUtc != null);

  // load details for each activity in parallel
  const details = await Promise.all(acts.map(a =>
    fetchJ(EP().activity(a.activityId)).catch(() => null)
  ));

  // flatten
  const flatInst = [];
  acts.forEach((a, i) => {
    const d = details[i];
    const insts = Array.isArray(d?.instances) ? d.instances : [];
    insts.forEach(inst => flatInst.push({ a, inst }));
  });

  // load avail for each instance in parallel
  const availResults = await Promise.all(
    flatInst.map(({inst}) => fetchJ(EP().avail(inst.instanceId)).catch(() => []))
  );

  allRows = flatInst.map(({a, inst}, i) => {
    const arr = Array.isArray(availResults[i]) ? availResults[i] : [];
    return {
      actId:      a.activityId,
      actName:    a.activityName,
      typeName:   a.typeName || "",
      courseName: a.courseName || "",
      instanceId: inst.instanceId,
      startUtc:   inst.startUtc,
      endUtc:     inst.endUtc,
      required:   Number(inst.requiredInstructors || 0),
      requested:  byStatus(arr, "REQUESTED"),
      submitted:  byStatus(arr, "SUBMITTED"),
      rejected:   byStatus(arr, "REJECTED"),
      assigned:   arr.filter(isAssigned).length,
    };
  });

  renderTable();
  const total = allRows.length;
  const missing = allRows.filter(r => Math.max(0, r.required - r.assigned) > 0).length;
  $("statusLabel").className = "pill ok";
  $("statusLabel").textContent = `${total} מופעים | ${missing} עם חסרים`;
}

// ─── render table ────────────────────────────────────────────────────────────
function renderTable() {
  const search = ($("searchInp").value || "").trim().toLowerCase();
  const onlyMissing = $("chkOnlyMissing").checked;

  const rows = allRows.filter(r => {
    if (onlyMissing && (r.required - r.assigned) <= 0) return false;
    if (search) {
      const hay = `${r.actName} ${r.typeName} ${r.courseName} ${fmtDate(r.startUtc)}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  if (!rows.length) {
    $("mainBody").innerHTML = `<tr><td colspan="10" class="muted" style="text-align:center;padding:16px">אין תוצאות</td></tr>`;
    return;
  }

  $("mainBody").innerHTML = rows.map(r => {
    const missing = Math.max(0, r.required - r.assigned);
    const mc = missing > 0 ? "bad" : "ok";
    return `<tr>
      <td><div class="act-name">${esc(r.actName)}</div><div class="small muted">${esc(r.typeName)}${r.courseName ? " · "+esc(r.courseName):""}</div></td>
      <td>${esc(fmtDate(r.startUtc))}</td>
      <td>${esc(fmtTime(r.startUtc))}–${esc(fmtTime(r.endUtc))}</td>
      <td><span class="pill">${r.required}</span></td>
      <td><span class="pill" style="background:rgba(139,92,246,.2)">${r.requested}</span></td>
      <td><span class="pill warn">${r.submitted}</span></td>
      <td><span class="pill bad">${r.rejected}</span></td>
      <td><span class="pill ok">${r.assigned}</span></td>
      <td><span class="pill ${mc}">${missing}</span></td>
      <td>
        <button class="btn small" data-act="remind" data-iid="${r.instanceId}" data-aid="${r.actId}" type="button">בקש זמינות</button>
        <button class="btn primary small" data-act="assign" data-iid="${r.instanceId}" data-aid="${r.actId}" type="button">שבץ</button>
      </td>
    </tr>`;
  }).join("");

  $("mainBody").querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const act = btn.dataset.act;
      const iid = Number(btn.dataset.iid);
      const aid = Number(btn.dataset.aid);
      if (act === "remind") await sendReminder(iid, aid);
      if (act === "assign") await openModal(iid, aid);
    });
  });
}

// ─── send reminder ───────────────────────────────────────────────────────────
async function sendReminder(instanceId, actId) {
  $("mainMsg").textContent = "שולח בקשות זמינות…";
  try {
    const elig = await getEligible(actId);
    const ids = elig.map(x => Number(x.instructorId ?? x.InstructorId)).filter(Boolean);
    if (ids.length) {
      const res = await fetchJ(EP().reqAvail(instanceId), {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ instructorIds: ids, sendEmail: true })
      });
      $("mainMsg").textContent = `נשלחו ${res?.emailsSent??0} מיילים, נוצרו ${res?.inserted??0} בקשות ✅`;
    } else {
      const res = await fetchJ(EP().reminder(instanceId), {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ onlyNotResponded: true })
      });
      $("mainMsg").textContent = `נשלחו ${res?.sent??0} תזכורות ✅`;
    }
    await refreshRow(instanceId);
    renderTable();
  } catch(e) { $("mainMsg").textContent = "שגיאה: "+e.message; }
}

async function refreshRow(instanceId) {
  const idx = allRows.findIndex(r => r.instanceId === instanceId);
  if (idx < 0) return;
  const arr = await fetchJ(EP().avail(instanceId)).catch(()=>[]);
  const a = Array.isArray(arr) ? arr : [];
  allRows[idx].requested = byStatus(a,"REQUESTED");
  allRows[idx].submitted = byStatus(a,"SUBMITTED");
  allRows[idx].rejected  = byStatus(a,"REJECTED");
  allRows[idx].assigned  = a.filter(isAssigned).length;
}

async function getEligible(actId) {
  if (!eligibleCache[actId]) {
    eligibleCache[actId] = await fetchJ(EP().eligible(actId)).catch(()=>[]);
  }
  return Array.isArray(eligibleCache[actId]) ? eligibleCache[actId] : [];
}

// ─── modal ────────────────────────────────────────────────────────────────────
let modalInstanceId = null;
let modalActId = null;
let modalRequired = 0;
let modalAssigned = 0;
let modalCandidates = [];  // sorted
let modalSelected = new Set();
let modalFairness = new Map();

function availRank(s) {
  s = (s||"").toUpperCase();
  if (s==="AVAILABLE"||s==="APPROVED") return 0;
  if (s==="MAYBE"||s==="SUBMITTED"||s==="REQUESTED") return 1;
  return 2;
}
function availLabel(s) {
  s=(s||"").toUpperCase();
  const m={AVAILABLE:"זמין",MAYBE:"אולי",NOT_AVAILABLE:"לא זמין",SUBMITTED:"הוגש",REQUESTED:"התבקש",APPROVED:"אושר",REJECTED:"נדחה"};
  return m[s]||s||"-";
}

async function openModal(instanceId, actId) {
  modalInstanceId = instanceId;
  modalActId = actId;
  modalSelected.clear();

  const row = allRows.find(r => r.instanceId === instanceId);
  if (!row) return;
  modalRequired = row.required;
  modalAssigned = row.assigned;
  const missing = Math.max(0, modalRequired - modalAssigned);

  $("modalTitle").textContent = `שיבוץ מדריכים — ${esc(row.actName)}`;
  $("modalSub").textContent = `${fmtDate(row.startUtc)} ${fmtTime(row.startUtc)}–${fmtTime(row.endUtc)}${row.courseName ? " · "+esc(row.courseName) : ""}`;
  $("mReq").textContent = `נדרש: ${modalRequired}`;
  $("mAssigned").textContent = `שובצו: ${modalAssigned}`;
  $("mMissing").textContent = `חסרים: ${missing}`;
  $("mMissing").className = "pill "+(missing>0?"bad":"ok");
  $("candWrap").innerHTML = `<div class="muted">טוען…</div>`;
  $("btnApprove").disabled = true;
  $("btnAutoPick").disabled = true;
  setMsg("modalMsg","");
  showModal(true);

  const [avail, fair] = await Promise.all([
    fetchJ(EP().avail(instanceId)).catch(()=>[]),
    fetchJ(EP().fairness(instanceId)).catch(()=>[])
  ]);

  const arr = Array.isArray(avail) ? avail : [];
  modalFairness = new Map(Array.isArray(fair) ? fair.map(x=>[Number(x.instructorId),Number(x.approvedCount||0)]) : []);

  modalCandidates = arr
    .filter(r => !isAssigned(r))
    .sort((a,b)=>{
      const fa = modalFairness.get(Number(a.instructorId)) ?? 999;
      const fb = modalFairness.get(Number(b.instructorId)) ?? 999;
      if (fa!==fb) return fa-fb;
      if (availRank(a.status)!==availRank(b.status)) return availRank(a.status)-availRank(b.status);
      return (a.fullName||"").localeCompare(b.fullName||"","he");
    });

  renderModalTable();
  setMsg("modalMsg", missing<=0
    ? "אין חסרים — אין צורך בשיבוץ"
    : `${modalCandidates.length} מועמדים זמינים לשיבוץ`);
}

function renderModalTable() {
  if (!modalCandidates.length) {
    $("candWrap").innerHTML = `<div class="pill bad">אין מגישי זמינות למופע זה</div>`;
    return;
  }
  $("candWrap").innerHTML = `
    <table class="cand-table">
      <thead><tr>
        <th></th>
        <th>שם מדריך</th>
        <th>אימייל</th>
        <th>זמינות</th>
        <th>שיבוצים (צדק)</th>
      </tr></thead>
      <tbody>${modalCandidates.map(r => {
        const rank = availRank(r.status);
        const lbl  = availLabel(r.status);
        const pc   = rank===0?"ok":rank===1?"warn":"bad";
        const fair = modalFairness.get(Number(r.instructorId));
        const fairTxt = fair==null ? "—" : String(fair);
        const checked = modalSelected.has(Number(r.instructorId)) ? "checked" : "";
        return `<tr>
          <td><input type="checkbox" class="candPick" data-id="${r.instructorId}" ${checked}></td>
          <td><b>${esc(r.fullName)}</b></td>
          <td class="small muted">${esc(r.email||"")}</td>
          <td><span class="pill ${pc}">${esc(lbl)}</span></td>
          <td>${fairTxt}</td>
        </tr>`;
      }).join("")}</tbody>
    </table>`;

  $("candWrap").querySelectorAll(".candPick").forEach(cb => {
    cb.addEventListener("change", () => {
      const id = Number(cb.dataset.id);
      cb.checked ? modalSelected.add(id) : modalSelected.delete(id);
      refreshApprove();
    });
  });

  const missing = Math.max(0, modalRequired - modalAssigned);
  $("btnAutoPick").disabled = missing <= 0;
  refreshApprove();
}

function refreshApprove() {
  const missing = Math.max(0, modalRequired - modalAssigned);
  $("btnApprove").disabled = modalSelected.size === 0 || modalSelected.size > missing;
}

function autoPick() {
  const missing = Math.max(0, modalRequired - modalAssigned);
  modalSelected.clear();
  $("candWrap").querySelectorAll(".candPick").forEach((cb,i) => {
    cb.checked = i < missing;
    if (cb.checked) modalSelected.add(Number(cb.dataset.id));
  });
  refreshApprove();
}

async function approveAssign() {
  const ids = [...modalSelected].filter(n => n>0);
  if (!ids.length) { setMsg("modalMsg","לא נבחרו מדריכים","err"); return; }
  const missing = Math.max(0, modalRequired - modalAssigned);
  if (ids.length > missing) { setMsg("modalMsg",`בחרת ${ids.length}, חסרים רק ${missing}`,"err"); return; }

  setMsg("modalMsg","מאשר שיבוץ…");
  try {
    await fetchJ(EP().approve(modalInstanceId), {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ instructorIds: ids, note:"Assigned via Lead-Assignment", sendEmail:true })
    });
    try {
      await fetchJ(`${API_BASE}/lead/instances/${modalInstanceId}/notify-assigned`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ instructorIds: ids })
      });
    } catch {}
    setMsg("modalMsg","שובץ ✅ מרענן…","ok");
    await refreshRow(modalInstanceId);
    renderTable();
    setTimeout(closeModal, 1800);
  } catch(e) { setMsg("modalMsg","שגיאה: "+e.message,"err"); }
}

function setMsg(id, text, kind="") {
  const el=$(id); if(!el) return;
  el.className="msg"+(kind?" "+kind:"");
  el.textContent=text||"";
}
function showModal(v) {
  const bd=$("backdrop");
  bd.style.display=v?"flex":"none";
  bd.setAttribute("aria-hidden",v?"false":"true");
}
function closeModal() {
  modalInstanceId=null; modalActId=null;
  modalSelected.clear(); modalCandidates=[];
  showModal(false);
}

// ─── init ─────────────────────────────────────────────────────────────────────
(function init() {
  $("btnReload").addEventListener("click", ()=>loadAll().catch(e=>{$("mainMsg").textContent=e.message;}));
  $("searchInp").addEventListener("input", renderTable);
  $("chkOnlyMissing").addEventListener("change", renderTable);
  $("btnClose").addEventListener("click", closeModal);
  $("backdrop").addEventListener("click", e=>{ if(e.target===$("backdrop")) closeModal(); });
  window.addEventListener("keydown", e=>{ if(e.key==="Escape") closeModal(); });
  $("btnAutoPick").addEventListener("click", autoPick);
  $("btnApprove").addEventListener("click", ()=>approveAssign().catch(e=>setMsg("modalMsg",e.message,"err")));

  (async()=>{
    await detectApi();
    await loadAll();
  })().catch(e=>{ $("mainMsg").textContent=e.message; });
})();

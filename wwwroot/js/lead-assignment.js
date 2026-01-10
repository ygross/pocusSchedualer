// LEAD-ASSIGNMENT.js
// דרישות:
// 1) מציג רק פעילויות (Lead) -> GET /api/lead/activities
// 2) בבחירת פעילות מציג מופעים עם counts (required / availability / assigned)
// 3) לכל מופע: "בקש זמינות" -> POST /api/lead/instances/{id}/send-availability-reminder
// 4) "שבץ" -> מודל עם מדריכים שהציעו זמינות, ממוינים לפי צדק + זמינות
// 5) אישור -> POST /api/lead/instances/{id}/approve + שליחת מייל למי ששובץ

// ✅ FIX: build basePath safely (exactly ONE trailing '/')
const basePath = new URL(".", window.location.href).pathname.replace(/\/+$/, "/");

// ✅ FIX: candidates ordered with the working one first: .../api/api
const API_CANDIDATES = [
  `${window.location.origin}${basePath}api/api`,
  `${window.location.origin}${basePath}api`
];

let API_BASE = API_CANDIDATES[0];

const $ = (id) => document.getElementById(id);

function setMsg(elId, text, kind = "") {
  const el = $(elId);
  el.className = "msg" + (kind ? " " + kind : "");
  el.textContent = text || "";
}

function pad2(n) { return String(n).padStart(2, "0"); }
function fmtNice(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function esc(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function fetchTry(url, opts = {}) {
  return await fetch(url, {
    credentials: "include",
    headers: { "Accept": "application/json", ...(opts.headers || {}) },
    ...opts
  });
}
async function httpJson(url, opts = {}) {
  const res = await fetchTry(url, opts);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${res.status} ${t}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  return null;
}

function EP() {
  return {
    me: `${API_BASE}/me`,
    leadActivities: `${API_BASE}/lead/activities?take=400`,
    leadActivity: (activityId) => `${API_BASE}/lead/activities/${encodeURIComponent(activityId)}`,
    eligible: (activityId) => `${API_BASE}/lead/activities/${encodeURIComponent(activityId)}/eligible-instructors`,
    availability: (instanceId) => `${API_BASE}/lead/instances/${encodeURIComponent(instanceId)}/availability`,
    reminder: (instanceId) => `${API_BASE}/lead/instances/${encodeURIComponent(instanceId)}/send-availability-reminder`,
    approve: (instanceId) => `${API_BASE}/lead/instances/${encodeURIComponent(instanceId)}/approve`,

    // אופציונלי (מומלץ) – צדק:
    fairness: (instanceId) => `${API_BASE}/lead/instances/${encodeURIComponent(instanceId)}/fairness`,

    // אופציונלי (מומלץ) – מייל אחרי שיבוץ (אם לא שולחים בתוך approve):
    notifyAssigned: (instanceId) => `${API_BASE}/lead/instances/${encodeURIComponent(instanceId)}/notify-assigned`
  };
}

// ✅ FIX: probe must match EP().me => `${cand}/me` (NOT `${cand}/api/me`)
async function detectApiBase() {
  for (const cand of API_CANDIDATES) {
    try {
      const res = await fetchTry(`${cand}/me`);
      if (res.ok) {
        API_BASE = cand;
        $("apiBaseLabel").textContent = API_BASE;
        return;
      }
    } catch { }
  }
  $("apiBaseLabel").textContent = API_BASE;
  setMsg("activityMsg", `לא נמצא API תקין. ניסיתי: ${API_CANDIDATES.join(" , ")}`, "err");
}

// ----- Header -----
async function loadHeader() {
  $("apiBaseLabel").textContent = API_BASE;
  try {
    const me = await httpJson(EP().me);
    $("meLine").textContent = "משתמש: " + (me.fullName || me.email || "לא ידוע");
    $("roleLine").textContent = "תפקיד: " + (me.roleName || "-");
  } catch {
    $("meLine").textContent = "משתמש: לא מחובר";
    $("roleLine").textContent = "תפקיד: -";
  }
}

// ----- State -----
let activities = [];
let selectedActivityId = null;
let activityDetails = null;   // includes instances
let eligibleList = [];
let instanceStats = new Map(); // instanceId -> {required, availCount, assignedCount}

function availabilityRank(status) {
  const s = (status || "").toUpperCase();
  if (s === "AVAILABLE") return 0;
  if (s === "MAYBE") return 1;
  if (s === "NOT_AVAILABLE") return 2;
  if (s === "SUBMITTED") return 1;
  if (s === "REQUESTED") return 1;
  if (s === "APPROVED") return 0;
  if (s === "REJECTED") return 3;
  return 2;
}
function availabilityLabel(status) {
  const s = (status || "").toUpperCase();
  if (s === "AVAILABLE") return "זמין";
  if (s === "MAYBE") return "אולי";
  if (s === "NOT_AVAILABLE") return "לא זמין";
  if (s === "SUBMITTED") return "הוגש";
  if (s === "REQUESTED") return "התבקש";
  if (s === "APPROVED") return "אושר";
  if (s === "REJECTED") return "נדחה";
  return status || "-";
}
function isAssigned(row) {
  return Number(row?.isAssigned ?? row?.IsAssigned ?? 0) === 1;
}

// ----- Load activities only -----
async function loadActivities() {
  setMsg("activityMsg", "טוען פעילויות…");
  $("activitySel").innerHTML = `<option value="">טוען…</option>`;
  resetInstancesUI();

  activities = await httpJson(EP().leadActivities);
  if (!Array.isArray(activities)) activities = [];

  $("activitySel").innerHTML =
    `<option value="">בחר פעילות…</option>` +
    activities.map(a => {
      const txt = `#${a.activityId} • ${a.activityName} • ${a.typeName}${a.courseName ? " • " + a.courseName : ""}`;
      return `<option value="${a.activityId}">${esc(txt)}</option>`;
    }).join("");

  setMsg("activityMsg", `נטענו ${activities.length} פעילויות`, "ok");
}

function resetInstancesUI() {
  $("kpiInstances").textContent = "מופעים: -";
  $("kpiEligible").textContent = "מדריכים רלוונטיים: -";
  $("instancesHint").textContent = "בחר פעילות כדי לראות מופעים.";
  $("instancesBody").innerHTML = `<tr><td colspan="6" class="muted">—</td></tr>`;
  setMsg("instancesMsg", "");
}

// ----- On activity change: load instances and compute stats -----
async function onPickActivity() {
  const id = Number($("activitySel").value || "0") || null;
  selectedActivityId = id;
  activityDetails = null;
  eligibleList = [];
  instanceStats.clear();
  resetInstancesUI();

  if (!id) {
    setMsg("activityMsg", "בחר פעילות.", "");
    return;
  }

  setMsg("activityMsg", "טוען פעילות ומופעים…");
  $("instancesHint").textContent = "טוען מופעים + סטטיסטיקה…";

  // load activity + eligible in parallel
  const [details, eligible] = await Promise.all([
    httpJson(EP().leadActivity(id)),
    httpJson(EP().eligible(id))
  ]);

  activityDetails = details;
  eligibleList = Array.isArray(eligible) ? eligible : [];
  $("kpiEligible").textContent = `מדריכים רלוונטיים: ${eligibleList.length}`;

  const inst = Array.isArray(activityDetails?.instances) ? activityDetails.instances : [];
  $("kpiInstances").textContent = `מופעים: ${inst.length}`;

  if (inst.length === 0) {
    $("instancesHint").textContent = "אין מופעים לפעילות זו.";
    $("instancesBody").innerHTML = `<tr><td colspan="6" class="muted">אין מופעים</td></tr>`;
    setMsg("activityMsg", "נטען. אין מופעים.", "ok");
    return;
  }

  // compute per-instance counts:
  // availabilityCount: rows length
  // assignedCount: sum(IsAssigned==1)
  const promises = inst.map(async x => {
    const rows = await httpJson(EP().availability(x.instanceId)).catch(() => []);
    const availCount = Array.isArray(rows) ? rows.length : 0;
    const assignedCount = Array.isArray(rows) ? rows.filter(isAssigned).length : 0;
    instanceStats.set(x.instanceId, {
      required: Number(x.requiredInstructors || 0),
      availCount,
      assignedCount
    });
  });

  await Promise.all(promises);

  renderInstancesTable();
  $("instancesHint").textContent = "בחר פעולה ליד מופע: בקש זמינות / שבץ.";
  setMsg("activityMsg", "נטען ✅", "ok");
}

function renderInstancesTable() {
  const inst = activityDetails.instances || [];

  $("instancesBody").innerHTML = inst.map(x => {
    const s = instanceStats.get(x.instanceId) || { required: Number(x.requiredInstructors || 0), availCount: 0, assignedCount: 0 };
    const missing = Math.max(0, s.required - s.assignedCount);
    const missingClass = missing > 0 ? "bad" : "ok";

    return `
      <tr>
        <td class="mono">#${x.instanceId}</td>
        <td>${esc(fmtNice(x.startUtc))} – ${esc(fmtNice(x.endUtc))}</td>
        <td><span class="pill">${s.required}</span></td>
        <td><span class="pill warn">${s.availCount}</span></td>
        <td><span class="pill ${missingClass}">${s.assignedCount}</span></td>
        <td>
          <div class="right">
            <button class="btn" data-act="remind" data-id="${x.instanceId}" type="button">בקש זמינות</button>
            <button class="btn primary" data-act="assign" data-id="${x.instanceId}" type="button">שבץ</button>
          </div>
          <div class="small muted">חסרים: ${missing}</div>
        </td>
      </tr>
    `;
  }).join("");

  $("instancesBody").querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const act = btn.dataset.act;
      const instanceId = Number(btn.dataset.id);
      if (act === "remind") await sendReminder(instanceId);
      if (act === "assign") await openAssignModal(instanceId);
    });
  });
}

// ----- Request availability (email) -----
async function sendReminder(instanceId) {
  setMsg("instancesMsg", "שולח בקשת זמינות במייל…");
  try {
    // default: רק מי שטרם הגיש
    const res = await httpJson(EP().reminder(instanceId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onlyNotResponded: true })
    });
    setMsg("instancesMsg", `נשלחו ${res?.sent ?? 0} מיילים ✅`, "ok");
  } catch (e) {
    setMsg("instancesMsg", e.message, "err");
  }
}

// ===================== MODAL ASSIGN =====================
let modalInstanceId = null;
let modalAvailability = [];
let modalFairness = new Map(); // instructorId -> approvedCount
let modalSelected = new Set();

function showModal(show) {
  const bd = $("backdrop");
  bd.style.display = show ? "flex" : "none";
  bd.setAttribute("aria-hidden", show ? "false" : "true");
}
function closeModal() {
  modalInstanceId = null;
  modalAvailability = [];
  modalFairness.clear();
  modalSelected.clear();
  setMsg("modalMsg", "");
  $("candWrap").innerHTML = `<div class="muted">—</div>`;
  $("btnAutoPick").disabled = true;
  $("btnApprove").disabled = true;
  showModal(false);
}

async function openAssignModal(instanceId) {
  modalInstanceId = instanceId;
  modalSelected.clear();

  const inst = (activityDetails.instances || []).find(x => Number(x.instanceId) === Number(instanceId));
  const st = instanceStats.get(instanceId) || { required: Number(inst?.requiredInstructors || 0), availCount: 0, assignedCount: 0 };
  const missing = Math.max(0, st.required - st.assignedCount);

  $("modalTitle").textContent = `שיבוץ מדריכים • מופע #${instanceId}`;
  $("modalSub").textContent = `${fmtNice(inst?.startUtc)} – ${fmtNice(inst?.endUtc)}`;

  $("mReq").textContent = `נדרש: ${st.required}`;
  $("mAssigned").textContent = `שובצו: ${st.assignedCount}`;
  $("mMissing").textContent = `חסרים: ${missing}`;
  $("mMissing").className = "pill " + (missing > 0 ? "bad" : "ok");

  showModal(true);
  setMsg("modalMsg", "טוען רשימת מגישי זמינות + טבלת צדק…");

  // load availability (who offered) + fairness (optional)
  const avail = await httpJson(EP().availability(instanceId)).catch(() => []);
  modalAvailability = Array.isArray(avail) ? avail : [];

  // fairness optional endpoint: { instructorId, approvedCount }
  try {
    const f = await httpJson(EP().fairness(instanceId));
    if (Array.isArray(f)) {
      modalFairness = new Map(f.map(x => [Number(x.instructorId), Number(x.approvedCount || 0)]));
    }
  } catch {
    modalFairness = new Map(); // fallback
  }

  // candidates = offered + not already assigned
  const candidates = modalAvailability
    .filter(r => !isAssigned(r))
    .slice();

  // sort: fairness asc -> availability rank -> name
  candidates.sort((a, b) => {
    const fa = modalFairness.get(Number(a.instructorId)) ?? 999999;
    const fb = modalFairness.get(Number(b.instructorId)) ?? 999999;
    if (fa !== fb) return fa - fb;

    const ra = availabilityRank(a.status);
    const rb = availabilityRank(b.status);
    if (ra !== rb) return ra - rb;

    return (a.fullName || "").localeCompare(b.fullName || "", "he");
  });

  if (missing <= 0) {
    $("candWrap").innerHTML = `<span class="pill ok">אין חסרים — אין צורך בשיבוץ</span>`;
    $("btnAutoPick").disabled = true;
    $("btnApprove").disabled = true;
    setMsg("modalMsg", "אין חסרים.", "ok");
    return;
  }

  if (candidates.length === 0) {
    $("candWrap").innerHTML = `<span class="pill bad">אין מגישי זמינות למופע הזה</span>`;
    $("btnAutoPick").disabled = true;
    $("btnApprove").disabled = true;
    setMsg("modalMsg", "אין מועמדים.", "err");
    return;
  }

  $("candWrap").innerHTML = candidates.map(r => {
    const fair = modalFairness.get(Number(r.instructorId));
    const fairText = (fair == null) ? "לא זמין" : String(fair);
    const availLbl = availabilityLabel(r.status);
    const pClass = availabilityRank(r.status) === 0 ? "ok" : availabilityRank(r.status) === 1 ? "warn" : "bad";
    return `
      <label class="cand">
        <input type="checkbox" class="candPick" data-id="${r.instructorId}">
        <b>${esc(r.fullName)}</b>
        <span class="pill ${pClass}">זמינות: ${esc(availLbl)}</span>
        <span class="pill">צדק: ${esc(fairText)}</span>
        ${r.email ? `<span class="pill">${esc(r.email)}</span>` : ""}
      </label>
    `;
  }).join("");

  $("candWrap").querySelectorAll(".candPick").forEach(cb => {
    cb.addEventListener("change", () => {
      const id = Number(cb.dataset.id);
      if (cb.checked) modalSelected.add(id);
      else modalSelected.delete(id);
      refreshApproveEnabled();
    });
  });

  $("btnAutoPick").disabled = false;
  $("btnApprove").disabled = true;

  setMsg("modalMsg", "בחר מדריכים לשיבוץ (הסדר לפי צדק+זמינות).", "ok");
  refreshApproveEnabled();
}

function refreshApproveEnabled() {
  const inst = (activityDetails.instances || []).find(x => Number(x.instanceId) === Number(modalInstanceId));
  const st = instanceStats.get(modalInstanceId) || { required: Number(inst?.requiredInstructors || 0), assignedCount: 0 };
  const missing = Math.max(0, st.required - st.assignedCount);

  $("btnApprove").disabled = modalSelected.size === 0 || modalSelected.size > missing;
}

function autoPick() {
  const inst = (activityDetails.instances || []).find(x => Number(x.instanceId) === Number(modalInstanceId));
  const st = instanceStats.get(modalInstanceId) || { required: Number(inst?.requiredInstructors || 0), assignedCount: 0 };
  const missing = Math.max(0, st.required - st.assignedCount);

  // clear
  modalSelected.clear();
  $("candWrap").querySelectorAll(".candPick").forEach(cb => cb.checked = false);

  // pick first N in DOM order (already sorted)
  const boxes = Array.from($("candWrap").querySelectorAll(".candPick"));
  boxes.slice(0, missing).forEach(cb => {
    cb.checked = true;
    modalSelected.add(Number(cb.dataset.id));
  });

  refreshApproveEnabled();
}

async function approveAndNotify() {
  const ids = Array.from(modalSelected.values()).filter(n => Number.isFinite(n) && n > 0);
  if (ids.length === 0) {
    setMsg("modalMsg", "לא נבחרו מדריכים.", "err");
    return;
  }

  // compute missing
  const inst = (activityDetails.instances || []).find(x => Number(x.instanceId) === Number(modalInstanceId));
  const st = instanceStats.get(modalInstanceId) || { required: Number(inst?.requiredInstructors || 0), assignedCount: 0 };
  const missing = Math.max(0, st.required - st.assignedCount);

  if (ids.length > missing) {
    setMsg("modalMsg", `בחרת ${ids.length} אבל חסרים רק ${missing}.`, "err");
    return;
  }

  setMsg("modalMsg", "מאשר שיבוץ…");

  // ✅ אופציה 1 (מומלץ): השרת שולח מייל בתוך approve אם sendEmail=true
  await httpJson(EP().approve(modalInstanceId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instructorIds: ids,
      note: "Assigned via Lead-Assignment",
      sendEmail: true
    })
  });

  // ✅ אופציה 2: אם יש endpoint נפרד למייל אחרי שיבוץ (מומלץ), ננסה לקרוא לו
  try {
    await httpJson(EP().notifyAssigned(modalInstanceId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructorIds: ids })
    });
  } catch {
    // אם לא קיים – מתעלמים. (או שהמייל כבר נשלח באופציה 1)
  }

  setMsg("modalMsg", "שובץ ונשלחו מיילים (אם מופעל בשרת) ✅ מרענן…", "ok");

  // refresh stats for this instance
  const rows = await httpJson(EP().availability(modalInstanceId)).catch(() => []);
  const availCount = Array.isArray(rows) ? rows.length : 0;
  const assignedCount = Array.isArray(rows) ? rows.filter(isAssigned).length : 0;

  // required
  const required = Number(inst?.requiredInstructors || 0);
  instanceStats.set(modalInstanceId, { required, availCount, assignedCount });

  renderInstancesTable();
  closeModal();
}

// ----- Modal events -----
function wireModal() {
  $("btnClose").addEventListener("click", closeModal);
  $("backdrop").addEventListener("click", (e) => {
    if (e.target === $("backdrop")) closeModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("backdrop").style.display === "flex") closeModal();
  });

  $("btnAutoPick").addEventListener("click", autoPick);
  $("btnApprove").addEventListener("click", () => approveAndNotify().catch(err => setMsg("modalMsg", err.message, "err")));
}

// ----- Init -----
(function init() {
  $("btnReload").addEventListener("click", () => loadActivities().catch(e => setMsg("activityMsg", e.message, "err")));
  $("activitySel").addEventListener("change", () => onPickActivity().catch(e => setMsg("activityMsg", e.message, "err")));
  wireModal();

  (async () => {
    await detectApiBase();
    await loadHeader();
    await loadActivities();
  })().catch(e => setMsg("activityMsg", e.message, "err"));
})();

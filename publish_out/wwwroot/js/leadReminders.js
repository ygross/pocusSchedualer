const API_BASE = "/simcenter/PocusSchedualer/api";
const $ = id => document.getElementById(id);

let allActivities = []; // cache: all lead activities loaded once

// ─── helpers ──────────────────────────────────────────────────────────────────
async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Accept": "application/json", ...(opts.headers || {}) },
    ...opts
  });
  if (res.status === 401) { window.top.location.href = "/simcenter/PocusSchedualer/login-otp.html"; return null; }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${res.status} ${t}`.trim());
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : null;
}

function fmtDate(utcStr) {
  if (!utcStr) return "";
  return new Date(utcStr).toLocaleDateString("he-IL", {
    day:"2-digit", month:"2-digit", year:"numeric",
    hour:"2-digit", minute:"2-digit", timeZone:"Asia/Jerusalem"
  });
}

function showResult(text, kind, bullets) {
  const el = $("resultBox");
  el.className = "msg " + (kind === "ok" ? "ok" : kind === "warn" ? "warn" : "err");
  let html = text;
  if (bullets && bullets.length)
    html += `<ul style="margin:6px 0 0;padding-right:18px;font-size:12px">${bullets.map(b=>`<li>${b}</li>`).join("")}</ul>`;
  el.innerHTML = html;
  el.style.display = "block";
}

// ─── load courses (only mine) ─────────────────────────────────────────────────
async function loadCourses() {
  try {
    const courses = await fetchJson(`${API_BASE}/lead/my-courses`) || [];
    const sel = $("courseSelect");
    sel.innerHTML = `<option value="">— בחר קורס —</option>`;
    courses.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.courseId;
      opt.textContent = c.courseName;
      sel.appendChild(opt);
    });
    if (!courses.length)
      sel.innerHTML = `<option value="">אין קורסים מוגדרים עבורך</option>`;
  } catch(e) {
    showResult("שגיאה בטעינת קורסים: " + e.message, "err");
  }
}

// load all lead activities once (filtered server-side to lead own)
async function loadAllActivities() {
  try {
    allActivities = await fetchJson(`${API_BASE}/activities/search?take=200`) || [];
  } catch(e) {
    allActivities = [];
    console.warn("Could not load activities:", e);
  }
}

// ─── on course change ─────────────────────────────────────────────────────────
function onCourseChange() {
  const courseId = +$("courseSelect").value || 0;
  const actSel = $("activitySelect");
  const instSel = $("instanceSelect");
  $("instanceInfo").style.display = "none";
  $("resultBox").style.display = "none";

  instSel.innerHTML = `<option value="">— קודם בחר פעילות —</option>`;
  instSel.disabled = true;

  if (!courseId) {
    actSel.innerHTML = `<option value="">— קודם בחר קורס —</option>`;
    actSel.disabled = true;
    return;
  }

  const forCourse = allActivities.filter(a => (a.courseId ?? a.CourseId) === courseId);
  actSel.innerHTML = `<option value="">— בחר פעילות —</option>`;
  forCourse.forEach(a => {
    const opt = document.createElement("option");
    opt.value = a.activityId ?? a.ActivityId;
    opt.textContent = a.activityName ?? a.ActivityName;
    actSel.appendChild(opt);
  });
  if (!forCourse.length) {
    actSel.innerHTML = `<option value="">אין פעילויות בקורס זה</option>`;
    actSel.disabled = true;
  } else {
    actSel.disabled = false;
  }
}

// ─── on activity change ───────────────────────────────────────────────────────
async function onActivityChange() {
  const activityId = +$("activitySelect").value || 0;
  const instSel = $("instanceSelect");
  $("instanceInfo").style.display = "none";
  $("resultBox").style.display = "none";

  instSel.innerHTML = `<option value="">טוען מופעים…</option>`;
  instSel.disabled = true;

  if (!activityId) {
    instSel.innerHTML = `<option value="">— קודם בחר פעילות —</option>`;
    return;
  }

  try {
    const instances = await fetchJson(`${API_BASE}/leadcalendar/activities/${activityId}/instances`) || [];
    instSel.innerHTML = `<option value="">— בחר מופע —</option>`;
    instances.forEach(i => {
      const opt = document.createElement("option");
      opt.value = i.instanceId;
      const start = fmtDate(i.startUtc);
      const loc   = i.location ? ` | ${i.location}` : "";
      const cnt   = i.assignedCount > 0 ? ` (${i.assignedCount} מדריכים)` : " (אין שיבוצים)";
      opt.textContent = `${start}${loc}${cnt}`;
      opt.dataset.info = JSON.stringify(i);
      instSel.appendChild(opt);
    });
    if (!instances.length) {
      instSel.innerHTML = `<option value="">אין מופעים לפעילות זו</option>`;
    } else {
      instSel.disabled = false;
    }
  } catch(e) {
    instSel.innerHTML = `<option value="">שגיאה בטעינת מופעים</option>`;
    showResult("שגיאה בטעינת מופעים: " + e.message, "err");
  }
}

// ─── on instance change ───────────────────────────────────────────────────────
function onInstanceChange() {
  const sel  = $("instanceSelect");
  const info = $("instanceInfo");
  const opt  = sel.options[sel.selectedIndex];
  $("resultBox").style.display = "none";

  if (!sel.value || !opt?.dataset?.info) { info.style.display = "none"; return; }

  try {
    const d = JSON.parse(opt.dataset.info);
    const start = fmtDate(d.startUtc), end = fmtDate(d.endUtc);
    const loc = d.location || "—", cnt = d.assignedCount;
    info.innerHTML = `<b>מופע:</b> ${start} עד ${end} | <b>מיקום:</b> ${loc} | <b>מדריכים:</b> ${cnt}`;
    info.style.display = "block";

    if (cnt === 0)
      showResult("⚠ לא קיימים מדריכים משובצים למופע זה.", "warn");
  } catch { info.style.display = "none"; }
}

// ─── send ─────────────────────────────────────────────────────────────────────
async function sendMessage() {
  const instanceId = +$("instanceSelect").value || 0;
  const message    = ($("msgBody").value || "").trim();
  const subject    = ($("msgSubject").value || "").trim();
  const channel    = document.querySelector('input[name="channel"]:checked')?.value || "email";

  if (!instanceId) { showResult("נא לבחור מופע.", "err"); return; }
  if (!message)    { showResult("נא להזין תוכן הודעה.", "err"); return; }

  const btn = $("sendBtn");
  btn.disabled = true; btn.textContent = "שולח…";
  $("resultBox").style.display = "none";

  try {
    const result = await fetchJson(
      `${API_BASE}/leadcalendar/instances/${instanceId}/send-custom-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, subject: subject || undefined, channel })
      });

    if (!result) { showResult("לא התקבלה תשובה מהשרת.", "err"); return; }

    if (result.status === "no-recipients") {
      showResult("לא נמצאו מדריכים משובצים למופע.", "warn");
    } else if (result.status === "whatsapp-not-configured") {
      showResult("ווטסאפ אינו מוגדר במערכת. פנה לאדמין.", "warn");
    } else if (result.ok) {
      const ch = channel === "email" ? "מייל" : "ווטסאפ";
      let txt = `✓ ההודעה נשלחה ב-${ch} ל-${result.sent} מתוך ${result.total} מדריכים.`;
      if (result.failed > 0) txt += ` ${result.failed} נכשלו.`;
      showResult(txt, result.failed === 0 ? "ok" : "warn", result.errors || []);
    } else {
      showResult("שגיאה בשליחה: " + (result.error || result.status), "err");
    }
  } catch(e) {
    showResult("שגיאה: " + e.message, "err");
  } finally {
    btn.disabled = false; btn.textContent = "שלח הודעה";
  }
}

// ─── init ─────────────────────────────────────────────────────────────────────
$("courseSelect").addEventListener("change", onCourseChange);
$("activitySelect").addEventListener("change", onActivityChange);
$("instanceSelect").addEventListener("change", onInstanceChange);
$("sendBtn").addEventListener("click", sendMessage);

// Load user info
fetch(`${API_BASE}/me`, { credentials: "include" })
  .then(r => r.ok ? r.json() : null)
  .then(u => { if (u) $("meLabel").textContent = u.fullName || u.email || "—"; })
  .catch(() => {});

// Load data
Promise.all([loadCourses(), loadAllActivities()]);


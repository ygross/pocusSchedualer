const APP_BASE = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
const API_CANDIDATES = [APP_BASE + "api/api", APP_BASE + "api"];
let API_BASE = API_CANDIDATES[0];
let occurrences = [];

document.addEventListener("DOMContentLoaded", initPage);

async function initPage() {
  setText("apiBase", "בודק…");
  initThemeToggle();

  byId("btnPreview")?.addEventListener("click", buildOccurrences);
  byId("btnClearInstances")?.addEventListener("click", clearOccurrences);
  byId("btnSave")?.addEventListener("click", saveActivityAndInstances);
  byId("activityType")?.addEventListener("change", loadCourses);
  byId("course")?.addEventListener("change", loadInstructors);
  byId("multiPerWeek")?.addEventListener("change", toggleMultiDaysPanel);
  byId("startDate")?.addEventListener("change", () => {
    if (byId("multiPerWeek")?.checked) syncStartDateToMultiDays();
  });

  API_BASE = await resolveApiBase();
  setText("apiBase", API_BASE);

  await loadHeader();
  await loadActivityTypes();
  renderOccurrences();
}

function byId(id){ return document.getElementById(id); }
function setText(id, value){ const el = byId(id); if (el) el.textContent = value ?? ""; }
function esc(v){ return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;"); }

function setDot(id, state){
  const el = byId(id);
  if (!el) return;
  el.classList.remove("is-ok","is-err","is-warn");
  if (state === "ok") el.classList.add("is-ok");
  else if (state === "err") el.classList.add("is-err");
  else el.classList.add("is-warn");
}

function setMsg(type, text){
  const ok = byId("msgOk");
  const err = byId("msgErr");
  if (ok){ ok.style.display = "none"; ok.textContent = ""; }
  if (err){ err.style.display = "none"; err.textContent = ""; }
  if (!text) return;
  if (type === "ok" && ok){ ok.textContent = text; ok.style.display = "block"; }
  if (type === "err" && err){ err.textContent = text; err.style.display = "block"; }
}
function showOk(text){ setMsg("ok", text); }
function showErr(text){ setMsg("err", text); }

function initThemeToggle(){
  const btn = byId("themeToggle");
  const key = "adminAddActivitiesTheme";
  const saved = localStorage.getItem(key) || "dark";
  document.body.classList.toggle("theme-dark", saved === "dark");
  if (btn){
    btn.textContent = saved === "dark" ? "☀️" : "🌙";
    btn.addEventListener("click", () => {
      const dark = !document.body.classList.contains("theme-dark");
      document.body.classList.toggle("theme-dark", dark);
      localStorage.setItem(key, dark ? "dark" : "light");
      btn.textContent = dark ? "☀️" : "🌙";
    });
  }
}

async function apiJson(url, options = {}, tolerateNonJson = false){
  const res = await fetch(url, {
    credentials: "include",
    headers: {"Content-Type":"application/json", ...(options.headers || {})},
    ...options
  });

  const text = await res.text();
  let data = null;
  if (text){
    try { data = JSON.parse(text); }
    catch(e){
      if (tolerateNonJson) data = text;
      else throw e;
    }
  }

  if (!res.ok){
    const msg = (data && typeof data === "object" && (data.error || data.message || data.title)) || (typeof data === "string" ? data : "") || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function resolveApiBase(){
  setDot("dotSession", "warn");
  setDot("dotApi", "warn");
  setDot("dotDb", "warn");

  for (const candidate of API_CANDIDATES){
    try{
      await apiJson(candidate + "/activity-types", {}, true);
      setDot("dotApi", "ok");
      setDot("dotDb", "ok");
      return candidate;
    }catch(e){}
  }

  setDot("dotApi", "err");
  setDot("dotDb", "err");
  showErr("לא נמצא נתיב API תקין. נבדקו: " + API_CANDIDATES.join(" | "));
  return API_CANDIDATES[0];
}

async function loadHeader(){
  try{
    const me = await apiJson(`${API_BASE}/me`, {}, true);
    const role = me?.roleName || me?.role || "-";
    setText("meName", me?.fullName || me?.email || "מחובר");
    setText("meRole", role);
    setText("otpRoleInline", role);
    setDot("dotSession", "ok");
  }catch(e){
    setText("meName", "לא מחובר");
    setText("meRole", "-");
    setText("otpRoleInline", "-");
    setDot("dotSession", "warn");
  }
}

async function loadActivityTypes(){
  const sel = byId("activityType");
  if (!sel) return;

  try{
    const list = await apiJson(`${API_BASE}/activity-types`);
    const rows = Array.isArray(list) ? list : [];
    sel.innerHTML = `<option value="">בחר סוג פעילות…</option>` + rows.map(x => `<option value="${x.activityTypeId}">${esc(x.typeName || x.name || "")}</option>`).join("");
    setDot("dotApi", "ok");
  }catch(err){
    sel.innerHTML = `<option value="">שגיאה בטעינה</option>`;
    setDot("dotApi", "err");
    showErr(`שגיאה בטעינת סוגי פעילות: ${err.message}`);
  }
}

async function loadCourses(){
  const typeId = Number(byId("activityType")?.value || 0);
  const sel = byId("course");
  const instructorSel = byId("instructor");
  if (!sel) return;

  if (instructorSel){
    instructorSel.disabled = true;
    instructorSel.innerHTML = `<option value="">בחר קורס קודם…</option>`;
  }

  if (!typeId){
    sel.disabled = true;
    sel.innerHTML = `<option value="">בחר רמה קודם…</option>`;
    return;
  }

  sel.disabled = true;
  sel.innerHTML = `<option value="">טוען…</option>`;

  try{
    const list = await apiJson(`${API_BASE}/courses/by-type/${typeId}`);
    const rows = Array.isArray(list) ? list : [];
    sel.innerHTML = `<option value="">בחר קורס…</option>` + rows.map(x => `<option value="${x.courseId}">${esc(x.courseName || x.name || "")}</option>`).join("");
    sel.disabled = false;
  }catch(err){
    sel.innerHTML = `<option value="">שגיאה בטעינה</option>`;
    showErr(`שגיאה בטעינת קורסים: ${err.message}`);
  }
}

async function loadInstructors(){
  const courseId = Number(byId("course")?.value || 0);
  const sel = byId("instructor");
  if (!sel) return;

  if (!courseId){
    sel.disabled = true;
    sel.innerHTML = `<option value="">בחר קורס קודם…</option>`;
    return;
  }

  sel.disabled = true;
  sel.innerHTML = `<option value="">טוען…</option>`;

  try{
    const all = await apiJson(`${API_BASE}/instructors`);
    const rows = (Array.isArray(all) ? all : [])
      .filter(x => (x.roleName || x.role || "").toLowerCase() === "coursemanager");
    sel.innerHTML = `<option value="">ללא מדריך מרכז</option>` + rows.map(x => {
      const name = x.fullName || x.name || "";
      const email = x.email ? ` (${esc(x.email)})` : "";
      return `<option value="${x.instructorId}">${esc(name)}${email}</option>`;
    }).join("");
    sel.disabled = false;
  }catch(err){
    sel.innerHTML = `<option value="">שגיאה בטעינה</option>`;
    showErr(`שגיאה בטעינת מרכזי קורסים: ${err.message}`);
  }
}

function toggleMultiDaysPanel(){
  const checked = !!byId("multiPerWeek")?.checked;
  const panel = byId("multiDaysPanel");
  if (panel) panel.style.display = checked ? "block" : "none";
  if (checked) syncStartDateToMultiDays();
}

function syncStartDateToMultiDays(){
  const startDate = byId("startDate")?.value;
  if (!startDate) return;
  const d = new Date(`${startDate}T00:00:00`);
  const day = d.getDay();
  document.querySelectorAll(".multi-day").forEach(cb => {
    cb.checked = Number(cb.value) === day;
  });
}

function toLocalDateInputValue(d){
  const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function combineLocal(dateStr, timeStr){ return new Date(`${dateStr}T${timeStr}:00`); }
function getCheckedDays(){
  return Array.from(document.querySelectorAll(".multi-day:checked")).map(x => Number(x.value)).filter(Number.isFinite);
}
function getDayNameHe(dateObj){ return ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"][dateObj.getDay()]; }

function buildOccurrences(){
  showOk("");

  const startDate = byId("startDate")?.value;
  const startHour = byId("startHour")?.value;
  const endHour = byId("endHour")?.value;
  const repeatMode = byId("repeatMode")?.value || "none";
  const repeatCount = Number(byId("repeatCount")?.value || 1);
  const roomsCount = Number(byId("roomsCount")?.value || 1);
  const reqInstructors = Number(byId("reqInstructors")?.value || 1);
  const multi = !!byId("multiPerWeek")?.checked;

  if (!startDate || !startHour || !endHour){
    showErr("יש למלא תאריך התחלה, שעת התחלה ושעת סיום.");
    return;
  }

  const baseStart = combineLocal(startDate, startHour);
  const baseEnd = combineLocal(startDate, endHour);

  if (baseEnd <= baseStart){
    showErr("שעת הסיום חייבת להיות אחרי שעת ההתחלה.");
    return;
  }

  if (repeatCount < 1){
    showErr("מספר חזרות חייב להיות לפחות 1.");
    return;
  }

  occurrences = [];

  function addOccurrence(dateObj){
    const localDate = toLocalDateInputValue(dateObj);
    const start = combineLocal(localDate, startHour);
    const end = combineLocal(localDate, endHour);

    occurrences.push({
      date: localDate,
      dayName: getDayNameHe(start),
      startLocal: startHour,
      endLocal: endHour,
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
      requiredInstructors: reqInstructors,
      roomsCount: roomsCount
    });
  }

  if (!multi){
    for (let i = 0; i < repeatCount; i++){
      const current = new Date(`${startDate}T00:00:00`);
      if (repeatMode === "weekly") current.setDate(current.getDate() + i * 7);
      else if (repeatMode === "monthly") current.setMonth(current.getMonth() + i);
      else if (i > 0) break;
      addOccurrence(current);
    }
  }else{
    const days = getCheckedDays();
    if (!days.length){
      showErr("יש לבחור לפחות יום אחד כאשר מסומן מספר מופעים באותו שבוע.");
      return;
    }

    const base = new Date(`${startDate}T00:00:00`);
    for (let cycle = 0; cycle < repeatCount; cycle++){
      for (const weekday of days){
        const current = new Date(base);
        if (repeatMode === "monthly"){
          current.setMonth(current.getMonth() + cycle);
          const diff = weekday - current.getDay();
          current.setDate(current.getDate() + diff);
        }else{
          const diff = weekday - base.getDay() + cycle * 7;
          current.setDate(base.getDate() + diff);
        }
        addOccurrence(current);
      }
      if (repeatMode === "none") break;
    }
    occurrences.sort((a,b) => new Date(a.startUtc) - new Date(b.startUtc));
  }

  renderOccurrences();
  showOk(`נוצרו ${occurrences.length} מופעים בתצוגה מקדימה.`);
}

function renderOccurrences(){
  const body = byId("instancesBody");
  const badge = byId("instancesCounter");
  if (!body) return;

  if (badge) badge.textContent = `${occurrences.length} מופעים`;

  if (!occurrences.length){
    body.innerHTML = `<tr><td colspan="7" class="empty-cell">אין מופעים להצגה</td></tr>`;
    return;
  }

  body.innerHTML = occurrences.map((x, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(x.date)}</td>
      <td>${esc(x.dayName)}</td>
      <td>${esc(x.startLocal)} - ${esc(x.endLocal)}</td>
      <td>${x.roomsCount}</td>
      <td>${x.requiredInstructors}</td>
      <td><button type="button" class="table-btn" data-remove-index="${i}">מחק</button></td>
    </tr>
  `).join("");

  body.querySelectorAll("[data-remove-index]").forEach(btn => {
    btn.addEventListener("click", () => {
      const index = Number(btn.getAttribute("data-remove-index"));
      occurrences.splice(index, 1);
      renderOccurrences();
    });
  });
}

function clearOccurrences(){
  occurrences = [];
  renderOccurrences();
  showOk("רשימת המופעים נוקתה.");
}

async function saveActivityAndInstances(){
  const activityName = byId("activityName")?.value?.trim();
  const activityTypeId = Number(byId("activityType")?.value || 0);
  const courseId = Number(byId("course")?.value || 0);
  const leadInstructorId = Number(byId("instructor")?.value || 0) || null;
  const deadline = byId("deadline")?.value || null;

  if (!activityName || !activityTypeId || !courseId){
    showErr("יש למלא שם פעילות, סוג פעילות וקורס.");
    return;
  }

  if (!leadInstructorId){
    showErr("יש לבחור מדריך מוביל.");
    return;
  }

  if (!occurrences.length){
    showErr("אין מופעים לשמירה. יש לבצע Preview קודם.");
    return;
  }

  const dto = {
    activityName,
    activityTypeId,
    courseId,
    leadInstructorId,
    applicationDeadlineUtc: deadline ? new Date(deadline).toISOString() : null,
    instances: occurrences.map(x => ({
      startUtc: x.startUtc,
      endUtc: x.endUtc,
      requiredInstructors: x.requiredInstructors,
      roomsCount: x.roomsCount
    }))
  };

  try{
    await apiJson(`${API_BASE}/activities`, {
      method:"POST",
      body: JSON.stringify(dto)
    });
    showOk("הפעילות והמופעים נשמרו בהצלחה.");
    occurrences = [];
    renderOccurrences();
  }catch(err){
    showErr(`שגיאה בשמירה: ${err.message}`);
  }
}

/**
 * activitiesList.js
 * ------------------------------------------------------------
 * ייעוד:
 * - מציג רשימה חודשית של מופעי פעילות (instances)
 * - ברירת מחדל: רק מה שקשור אליי (HasAvailability או IsAssignedToMe)
 * - בראש הדף: ההסמכות שלי (courses + course-instructors)
 * - כפתור "שלח קלנדר": הורדת ICS של השיבוצים שלי באותו חודש
 *
 * דרישות מהשרת:
 * - GET {base}/activities/calendar?from&to&activityTypeId&mode=instructor
 *   מחזיר לכל instance:
 *     ActivityInstanceId, ActivityName, StartUtc/EndUtc,
 *     HasAvailability, IsAssignedToMe, LeadInstructorName, CourseId, RoomsCount, RequiredInstructors...
 * - GET {base}/me מחזיר InstructorId (או instructorId)
 * - GET {base}/courses  + GET {base}/course-instructors?instructorId=#
 */

const $ = (id) => document.getElementById(id);
const origin = window.location.origin;

function setStatus(text, kind = "") {
  const el = $("status");
  if (!el) return;
  el.className = "msg" + (kind ? ` ${kind}` : "");
  el.textContent = text || "";
}

function pad2(n){ return String(n).padStart(2,"0"); }
function esc(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function fmtDateTimeLocal(utc){
  const d = new Date(utc);
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth()+1);
  const yyyy = d.getFullYear();
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}
function fmtTime(utc){
  const d = new Date(utc);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function getBaseDir() {
  const u = new URL(".", window.location.href);
  return u.pathname.endsWith("/") ? u.pathname : (u.pathname + "/");
}
async function http(url, opts = {}) {
  return fetch(url, { credentials:"include", ...opts });
}
async function httpJson(url, opts = {}) {
  const res = await http(url, {
    headers: { "Accept":"application/json", ...(opts.headers||{}) },
    ...opts
  });
  if (!res.ok) {
    const t = await res.text().catch(()=> "");
    throw new Error(`${res.status} ${t}`.trim());
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return null;
}
async function probe(url){
  try{
    const r = await http(url, { method:"GET", headers:{ "Accept":"application/json" }});
    if (r.status === 404) return false;
    return [200,201,204,400,401,403,405].includes(r.status);
  }catch{ return false; }
}

// -------- API discovery
const baseDir = getBaseDir();
const _storedBase = sessionStorage.getItem('pocus_api_base');
const ROOTS = [
  _storedBase,
  `${origin}${baseDir}api/api`,
  `${origin}${baseDir}api`,
].filter(Boolean);

const EP = {
  base: null,
  me: null,
  calendar: null,
  activityTypes: null,
  courses: null,
};

function setApiBaseLine(){
  $("apiBase").textContent = EP.base || "(לא נמצא)";
}

async function discoverApi(){
  const now = new Date();
  const fromIso = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}T00:00:00`;
  const toD = new Date(now.getTime()+24*60*60*1000);
  const toIso = `${toD.getFullYear()}-${pad2(toD.getMonth()+1)}-${pad2(toD.getDate())}T00:00:00`;

  for (const r of ROOTS) {
    const cal1 = `${r}/activities/calendar?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&mode=instructor`;
    const cal2 = `${r}/api/activities/calendar?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&mode=instructor`;
    if (await probe(cal1)) { EP.base=r; EP.calendar=`${r}/activities/calendar`; break; }
    if (await probe(cal2)) { EP.base=r; EP.calendar=`${r}/api/activities/calendar`; break; }
  }
  if (!EP.base) throw new Error("לא נמצא endpoint של activities/calendar.");

  // me
  const me1 = `${EP.base}/me`;
  const me2 = `${EP.base}/api/me`;
  EP.me = (await probe(me1)) ? me1 : ((await probe(me2)) ? me2 : null);

  // activity types (optional)
  const t1 = `${EP.base}/activity-types`;
  const t2 = `${EP.base}/api/activity-types`;
  EP.activityTypes = (await probe(t1)) ? t1 : ((await probe(t2)) ? t2 : null);

  // certifications: prefer existing ones you already use in app
  const c1 = `${EP.base}/courses`;
  const c2 = `${EP.base}/api/courses`;
  EP.courses = (await probe(c1)) ? c1 : ((await probe(c2)) ? c2 : null);

  setApiBaseLine();
}

// -------- Date range
function setMonthToToday(){
  const t = new Date();
  $("monthPicker").value = `${t.getFullYear()}-${pad2(t.getMonth()+1)}`;
}
function monthRangeLocal(ym){
  const [y,m] = ym.split("-").map(Number);
  const start = new Date(y, m-1, 1, 0,0,0,0);
  const end = new Date(y, m,   1, 0,0,0,0);
  const toIsoLocal = (d)=>{
    const yyyy=d.getFullYear(), mm=pad2(d.getMonth()+1), dd=pad2(d.getDate());
    const hh=pad2(d.getHours()), mi=pad2(d.getMinutes()), ss=pad2(d.getSeconds());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
  };
  return { fromIso: toIsoLocal(start), toIso: toIsoLocal(end), y, mIndex:m-1 };
}
function calendarUrl(fromIso,toIso,activityTypeId){
  const qs = new URLSearchParams();
  qs.set("from", fromIso);
  qs.set("to", toIso);
  qs.set("mode", "instructor");
  if (activityTypeId) qs.set("activityTypeId", activityTypeId);
  return `${EP.calendar}?${qs.toString()}`;
}

// -------- normalize
function normalize(raw){
  return {
    activityInstanceId: raw.activityInstanceId ?? raw.ActivityInstanceId,
    activityId: raw.activityId ?? raw.ActivityId,
    activityName: raw.activityName ?? raw.ActivityName,
    courseId: raw.courseId ?? raw.CourseId,
    leadInstructorName: raw.leadInstructorName ?? raw.LeadInstructorName,
    startUtc: raw.startUtc ?? raw.StartUtc,
    endUtc: raw.endUtc ?? raw.EndUtc,
    roomsCount: raw.roomsCount ?? raw.RoomsCount,
    requiredInstructors: raw.requiredInstructors ?? raw.RequiredInstructors,
    assignedInstructors: raw.assignedInstructors ?? raw.AssignedInstructors,

    hasAvailability: !!(raw.hasAvailability ?? raw.HasAvailability),
    isAssignedToMe: !!(raw.isAssignedToMe ?? raw.IsAssignedToMe),
    availabilityId: raw.availabilityId ?? raw.AvailabilityId ?? null,
    availabilityStatus: (raw.availabilityStatus ?? raw.AvailabilityStatus ?? null),
    myAssignmentId: raw.myAssignmentId ?? raw.MyAssignmentId ?? null,
  };
}

function stateOf(it){
  if (it.isAssignedToMe) return "assigned";
  if ((it.availabilityStatus || "").toUpperCase() === "REQUESTED") return "requested";
  if (it.hasAvailability) return "availability";
  return "new";
}

function buildBadges(it){
  const badges = [];
  // status badges
  const st = stateOf(it);
  if (st === "assigned")    badges.push({ cls:"b-green",  text:"שובצת" });
  else if (st === "requested")  badges.push({ cls:"b-purple", text:"התבקשת – ממתין לתגובתך" });
  else if (st === "availability") badges.push({ cls:"b-orange", text:"זמינות הוצעה" });
  else badges.push({ cls:"b-blue", text:"חדש" });

  if (it.leadInstructorName) badges.push({ cls:"b-blue", text:`מרכז: ${it.leadInstructorName}` });
  if (it.roomsCount != null) badges.push({ cls:"b-blue", text:`חדרים: ${Number(it.roomsCount)}` });
  if (it.requiredInstructors != null) badges.push({ cls:"b-blue", text:`נדרשים: ${Number(it.requiredInstructors)}` });
  if (it.assignedInstructors != null) badges.push({ cls:"b-blue", text:`שובצו: ${Number(it.assignedInstructors)}` });

  return badges;
}

// -------- render list
function renderList(items, showAll){
  const list = $("list");
  list.innerHTML = "";

  // default: only mine (availability OR assigned OR requested)
  const filtered = showAll
    ? items
    : items.filter(x => x.hasAvailability || x.isAssignedToMe || (x.availabilityStatus || "").toUpperCase() === "REQUESTED");

  filtered.sort((a,b)=> new Date(a.startUtc) - new Date(b.startUtc));

  $("countLine").textContent = `מוצגים ${filtered.length} מתוך ${items.length} מופעים בחודש`;

  if (filtered.length === 0){
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = showAll
      ? "אין מופעים בחודש שנבחר."
      : "אין לך זמינויות/שיבוצים בחודש שנבחר. (אפשר לסמן 'הצג גם מופעים חדשים')";
    list.appendChild(empty);
    return;
  }

  for (const it of filtered){
    const row = document.createElement("div");
    row.className = "row";

    const top = document.createElement("div");
    top.className = "rowTop";

    const title = document.createElement("div");
    title.className = "rowTitle";
    title.title = it.activityName || "";
    title.textContent = it.activityName || "ללא שם";

    const time = document.createElement("div");
    time.className = "rowTime";
    time.textContent = `${fmtDateTimeLocal(it.startUtc)}–${fmtTime(it.endUtc)}`;

    top.appendChild(title);
    top.appendChild(time);

    const badgesWrap = document.createElement("div");
    badgesWrap.className = "badges";
    for (const b of buildBadges(it)){
      const badge = document.createElement("div");
      badge.className = `badge ${b.cls}`;
      badge.textContent = b.text;
      badgesWrap.appendChild(badge);
    }

    const meta = document.createElement("div");
    meta.className = "rowMeta";
    const stNow = stateOf(it);
    const stHint = stNow === "assigned" ? "ללא פעולות"
      : stNow === "requested" ? "יש לאשר או לדחות את הבקשה"
      : stNow === "availability" ? "ניתן להסיר זמינות"
      : "ניתן להציע זמינות";
    meta.innerHTML = `
      <div>מופע #${it.activityInstanceId} · פעילות #${it.activityId} · קורס #${it.courseId}</div>
      <div>${esc(stHint)}</div>
    `;

    // actions only if not assigned
    const actions = document.createElement("div");
    actions.className = "rowActions";

    const left = document.createElement("div");
    left.className = "sub";
    left.textContent = "";

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "10px";
    right.style.flexWrap = "wrap";

    const btnOffer = document.createElement("button");
    btnOffer.className = "btn-mini primary";
    btnOffer.textContent = "הצע זמינות";

    const btnRemove = document.createElement("button");
    btnRemove.className = "btn-mini warn";
    btnRemove.textContent = "הסר זמינות";

    const btnAccept = document.createElement("button");
    btnAccept.className = "btn-mini primary";
    btnAccept.textContent = "אשר זמינות";

    const btnDecline = document.createElement("button");
    btnDecline.className = "btn-mini danger";
    btnDecline.textContent = "דחה";

    const btnCancel = document.createElement("button");
    btnCancel.className = "btn-mini danger";
    btnCancel.textContent = "בטל שיבוץ";

    // determine which buttons to show
    const st = stateOf(it);
    if (st === "assigned") {
      if (it.myAssignmentId) {
        right.appendChild(btnCancel);
        left.textContent = "שובצת למופע זה. ניתן לבטל לפני תחילת האירוע.";
      }
    } else if (st === "requested") {
      right.appendChild(btnAccept);
      right.appendChild(btnDecline);
      left.textContent = "התבקשת – אשר/י או דחה/י את הבקשה.";
    } else if (st === "availability") {
      right.appendChild(btnRemove);
      left.textContent = "זמינות הוצעה למופע זה.";
    } else {
      right.appendChild(btnOffer);
      left.textContent = "מופע חדש – ניתן להציע זמינות.";
    }

    // availability endpoint is the one you already use in calendar page
    async function callAvailability(instanceId, method){
      const tries = [
        `${EP.base}/instructors/instances/${instanceId}/availability`,
        `${EP.base}/activity-instances/${instanceId}/availability`,
        `${EP.base}/activities/activity-instances/${instanceId}/availability`,
        `${EP.base}/activities/instances/${instanceId}/availability`,
      ];

      let lastErr = "";
      for (const url of tries){
        try{
          const res = await http(url, { method, headers:{ "Accept":"application/json" } });
          if (res.status === 404) { lastErr = `404 ${url}`; continue; }
          if (res.ok) return;
          const t = await res.text().catch(()=> "");
          throw new Error(`${res.status} ${t}`.trim());
        }catch(e){
          lastErr = e?.message || String(e);
        }
      }
      throw new Error(`לא נמצא Route לזמינות (${method}). ${lastErr}`);
    }

    async function callRespond(availabilityId, accept){
      const url = `${EP.base}/availability-requests/${availabilityId}/respond`;
      const res = await http(url, {
        method: "POST",
        headers: { "Content-Type":"application/json", "Accept":"application/json" },
        body: JSON.stringify({ accept })
      });
      if (!res.ok){
        const t = await res.text().catch(()=>"");
        throw new Error(`${res.status} ${t}`.trim());
      }
    }

    btnOffer.onclick = async ()=>{
      btnOffer.disabled = true;
      try{
        await callAvailability(it.activityInstanceId, "POST");
        it.hasAvailability = true;
        it.availabilityStatus = "Submitted";

        row.classList.add("anim-pop","anim-pulse");
        setTimeout(()=>row.classList.remove("anim-pop","anim-pulse"), 750);

        setStatus(`זמינות הוצעה למופע ${it.activityInstanceId}.`, "ok");
        renderList(items, $("chkShowAll").checked);
      }catch(e){
        setStatus(`שגיאה בהצעת זמינות: ${e.message}`, "err");
      }finally{
        btnOffer.disabled = false;
      }
    };

    btnRemove.onclick = async ()=>{
      btnRemove.disabled = true;
      try{
        await callAvailability(it.activityInstanceId, "DELETE");
        it.hasAvailability = false;
        it.availabilityStatus = null;

        row.classList.add("anim-pop","anim-pulse");
        setTimeout(()=>row.classList.remove("anim-pop","anim-pulse"), 750);

        setStatus(`הזמינות הוסרה למופע ${it.activityInstanceId}.`, "ok");
        renderList(items, $("chkShowAll").checked);
      }catch(e){
        setStatus(`שגיאה בהסרת זמינות: ${e.message}`, "err");
      }finally{
        btnRemove.disabled = false;
      }
    };

    btnAccept.onclick = async ()=>{
      btnAccept.disabled = true;
      btnDecline.disabled = true;
      try{
        await callRespond(it.availabilityId, true);
        it.hasAvailability = true;
        it.availabilityStatus = "Submitted";

        row.classList.add("anim-pop","anim-pulse");
        setTimeout(()=>row.classList.remove("anim-pop","anim-pulse"), 750);

        setStatus(`אישרת זמינות למופע ${it.activityInstanceId}.`, "ok");
        renderList(items, $("chkShowAll").checked);
      }catch(e){
        setStatus(`שגיאה באישור בקשה: ${e.message}`, "err");
        btnAccept.disabled = false;
        btnDecline.disabled = false;
      }
    };

    btnDecline.onclick = async ()=>{
      btnDecline.disabled = true;
      btnAccept.disabled = true;
      try{
        await callRespond(it.availabilityId, false);
        it.hasAvailability = false;
        it.availabilityStatus = "Rejected";

        row.classList.add("anim-pop","anim-pulse");
        setTimeout(()=>row.classList.remove("anim-pop","anim-pulse"), 750);

        setStatus(`דחית את הבקשה למופע ${it.activityInstanceId}.`, "ok");
        renderList(items, $("chkShowAll").checked);
      }catch(e){
        setStatus(`שגיאה בדחיית בקשה: ${e.message}`, "err");
        btnDecline.disabled = false;
        btnAccept.disabled = false;
      }
    };

    btnCancel.onclick = async ()=>{
      if (!confirm(`לבטל את השיבוץ למופע ${it.activityInstanceId}?`)) return;
      btnCancel.disabled = true;
      try{
        const url = `${EP.base}/instructor/assignments/${it.myAssignmentId}/cancel`;
        const res = await http(url, { method:"POST", headers:{"Accept":"application/json"} });
        if(!res.ok){ const t=await res.text().catch(()=>""); throw new Error(`${res.status} ${t}`.trim()); }
        it.isAssignedToMe = false;
        it.myAssignmentId = null;

        row.classList.add("anim-pop","anim-pulse");
        setTimeout(()=>row.classList.remove("anim-pop","anim-pulse"), 750);

        setStatus(`השיבוץ למופע ${it.activityInstanceId} בוטל.`, "ok");
        renderList(items, $("chkShowAll").checked);
      }catch(e){
        setStatus(`שגיאה בביטול שיבוץ: ${e.message}`, "err");
        btnCancel.disabled = false;
      }
    };

    actions.appendChild(left);
    actions.appendChild(right);

    row.appendChild(top);
    row.appendChild(badgesWrap);
    row.appendChild(meta);
    row.appendChild(actions);

    list.appendChild(row);
  }
}

// -------- certifications
let ME = null;
let COURSES = null;
let COURSE_INSTRUCTORS = null;

async function loadMe(){
  if (!EP.me) {
    $("meName").textContent = "לא ידוע";
    $("meRole").textContent = "-";
    return null;
  }
  try{
    const me = await httpJson(EP.me);
    $("meName").textContent = me.fullName || me.email || "לא ידוע";
    $("meRole").textContent = me.roleName || me.role || "-";
    return me;
  }catch{
    $("meName").textContent = "לא מחובר";
    $("meRole").textContent = "-";
    return null;
  }
}

async function loadActivityTypes(){
  const sel = $("activityTypeId");
  if (!sel || !EP.activityTypes) return;
  try{
    const items = await httpJson(EP.activityTypes);
    for (const raw of (items||[])){
      const id = raw.activityTypeId ?? raw.ActivityTypeId;
      const name = raw.typeName ?? raw.TypeName ?? `סוג #${id}`;
      if (id == null) continue;
      const opt = document.createElement("option");
      opt.value = String(id);
      opt.textContent = name;
      sel.appendChild(opt);
    }
  }catch{}
}

function renderCerts(courseNames){
  const box = $("certChips");
  box.innerHTML = "";
  if (!courseNames || courseNames.length === 0){
    const chip = document.createElement("div");
    chip.className = "chip muted";
    chip.textContent = "לא נמצאו הסמכות (או שאין endpoints).";
    box.appendChild(chip);
    return;
  }
  for (const name of courseNames){
    const chip = document.createElement("div");
    chip.className = "chip ok";
    chip.textContent = name;
    box.appendChild(chip);
  }
}

async function loadCertifications(me){
  if (!EP.base) { renderCerts([]); return; }
  try{
    const courses = await httpJson(`${EP.base}/instructors/courses`);
    const names = (Array.isArray(courses) ? courses : [])
      .map(c => c.courseName ?? c.CourseName ?? `Course #${c.courseId ?? c.CourseId}`)
      .sort((a,b)=> a.localeCompare(b, "he"));
    renderCerts(names);
  }catch(e){
    renderCerts([]);
    setStatus(`אזהרה: לא הצלחתי לטעון הסמכות. ${e.message}`, "err");
  }
}

// -------- calendar + list loader
let _lastMonthItems = [];

async function refresh(){
  const ym = $("monthPicker").value;
  if (!ym) return setStatus("בחר חודש.", "err");

  const { fromIso, toIso } = monthRangeLocal(ym);
  const activityTypeId = $("activityTypeId").value || "";
  const showAll = $("chkShowAll").checked;

  try{
    setStatus("טוען מופעים לחודש…");
    const data = await httpJson(calendarUrl(fromIso,toIso,activityTypeId));
    if (!Array.isArray(data)) throw new Error("תגובה לא תקינה מהשרת (ציפיתי למערך).");

    const items = data.map(normalize);
    _lastMonthItems = items;

    renderList(items, showAll);
    setStatus(`נטענו ${items.length} מופעים מהשרת.`, "ok");
  }catch(e){
    setStatus(`שגיאה בטעינת רשימה: ${e.message}`, "err");
  }
}

// -------- ICS (Assignments only)
function toIcsUtc(dt){
  const d = new Date(dt);
  const yyyy = d.getUTCFullYear();
  const mm = pad2(d.getUTCMonth()+1);
  const dd = pad2(d.getUTCDate());
  const hh = pad2(d.getUTCHours());
  const mi = pad2(d.getUTCMinutes());
  const ss = pad2(d.getUTCSeconds());
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}
function icsEscape(s){
  return (s ?? "").toString()
    .replaceAll("\\","\\\\")
    .replaceAll("\n","\\n")
    .replaceAll(",","\\,")
    .replaceAll(";","\\;");
}

function downloadIcsForMonth(){
  const ym = $("monthPicker").value || "";
  const assigned = _lastMonthItems.filter(x => x.isAssignedToMe === true);

  if (assigned.length === 0){
    setStatus("אין שיבוצים בחודש הנבחר כדי ליצור קלנדר.", "err");
    return;
  }

  const meName = $("meName")?.textContent || "instructor";
  const lines = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//simCenter//InstructorAssignments//HE");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");

  for (const it of assigned){
    const uid = `inst-${it.activityInstanceId}@simcenter`;
    const summary = icsEscape(it.activityName || "Activity");
    const desc = icsEscape(`מופע #${it.activityInstanceId} | פעילות #${it.activityId} | קורס #${it.courseId} | מרכז: ${it.leadInstructorName || "-"}`);
    const dtStart = toIcsUtc(it.startUtc);
    const dtEnd = toIcsUtc(it.endUtc);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${toIcsUtc(new Date())}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${desc}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], { type:"text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `InstructorAssignments_${icsEscape(meName)}_${ym || "month"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
  setStatus(`נוצר קובץ ICS (${assigned.length} שיבוצים) והורד למחשב.`, "ok");
}

// -------- init
(async function init(){
  setMonthToToday();

  try{
    await discoverApi();
  }catch(e){
    setApiBaseLine();
    setStatus(e.message, "err");
    return;
  }

  ME = await loadMe();
  await loadActivityTypes();
  if (ME) await loadCertifications(ME);

  function shiftMonth(delta){
    const val = $("monthPicker").value;
    if (!val) return;
    const [y,m] = val.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    $("monthPicker").value = `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
    refresh();
  }

  $("btnPrevMonth")?.addEventListener("click", ()=> shiftMonth(-1));
  $("btnThisMonth")?.addEventListener("click", ()=>{ setMonthToToday(); refresh(); });
  $("btnNextMonth")?.addEventListener("click", ()=> shiftMonth(+1));
  $("btnReload")?.addEventListener("click", refresh);
  $("monthPicker")?.addEventListener("change", refresh);
  $("activityTypeId")?.addEventListener("change", refresh);
  $("chkShowAll")?.addEventListener("change", ()=> renderList(_lastMonthItems, $("chkShowAll").checked));
  $("btnIcs")?.addEventListener("click", downloadIcsForMonth);

  // Theme toggle
  const themeBtn = $("themeToggle");
  if (themeBtn){
    const isDark = document.body.classList.contains("theme-dark");
    themeBtn.textContent = isDark ? "🌞" : "🌙";
    themeBtn.addEventListener("click", ()=>{
      const dark = document.body.classList.toggle("theme-dark");
      localStorage.setItem("theme", dark ? "dark" : "light");
      themeBtn.textContent = dark ? "🌞" : "🌙";
    });
  }

  await refresh();
})();

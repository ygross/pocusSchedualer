/**
 * activitiesCalendar.js (INSTRUCTOR PAGE)
 * ------------------------------------------------------------
 * State logic (STRICT priority):
 * 1) IsAssignedToMe => GREEN + no buttons
 * 2) HasAvailability => ORANGE + "הסר זמינות" + note
 * 3) default => BLUE + "הצע זמינות"
 *
 * Works even if user is Admin/Lead, because we NEVER use role to color.
 *
 * Requires calendar API to return:
 * - HasAvailability / hasAvailability
 * - IsAssignedToMe / isAssignedToMe
 */

const $ = (id) => document.getElementById(id);

function setStatus(text, kind = "") {
  const el = $("status");
  if (!el) return;
  el.className = "msg" + (kind ? ` ${kind}` : "");
  el.textContent = text || "";
}

function pad2(n) { return String(n).padStart(2, "0"); }
function fmtTime(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function formatMonthYear(year, monthIndex) {
  const monthsHe = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  return `${monthsHe[monthIndex]} ${year}`;
}
function daysInMonth(year, monthIndex) { return new Date(year, monthIndex + 1, 0).getDate(); }
function firstDow(year, monthIndex) { return new Date(year, monthIndex, 1).getDay(); }
function esc(s) {
  return (s ?? "").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

async function http(url, opts = {}) {
  return fetch(url, { credentials: "include", ...opts });
}
async function httpJson(url, opts = {}) {
  const res = await http(url, {
    headers: { "Accept": "application/json", ...(opts.headers || {}) },
    ...opts
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${res.status} ${t}`.trim());
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  return null;
}
async function probe(url) {
  try {
    const r = await http(url, { method: "GET", headers: { "Accept": "application/json" } });
    if (r.status === 404) return false;
    return [200, 201, 204, 400, 401, 403, 405].includes(r.status);
  } catch {
    return false;
  }
}

function getBaseDir() {
  const u = new URL(".", window.location.href);
  return u.pathname.endsWith("/") ? u.pathname : (u.pathname + "/");
}

const origin = window.location.origin;
const baseDir = getBaseDir();

// ---- Page mode (Instructor menu page)
const CALENDAR_MODE = "instructor";

// ---- API roots (try to find calendar endpoint)
const ROOTS = [
  `${origin}${baseDir}api/api`,
  `${origin}${baseDir}api`,
  `${origin}${baseDir}api/api/api`,
];

const EP = {
  base: null,
  me: null,
  activityTypes: null,
  calBase: null, // no query
};

function setApiDebug() {
  const el = $("apiBase");
  if (el) el.textContent = EP.base || "(API לא זוהה)";
}

async function discoverBase() {
  const now = new Date();
  const fromIso = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}T00:00:00`;
  const toD = new Date(now.getTime() + 24*60*60*1000);
  const toIso = `${toD.getFullYear()}-${pad2(toD.getMonth()+1)}-${pad2(toD.getDate())}T00:00:00`;

  for (const r of ROOTS) {
    const urlA = `${r}/activities/calendar?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&mode=${encodeURIComponent(CALENDAR_MODE)}`;
    const urlB = `${r}/api/activities/calendar?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&mode=${encodeURIComponent(CALENDAR_MODE)}`;

    if (await probe(urlA)) { EP.base = r; EP.calBase = `${r}/activities/calendar`; break; }
    if (await probe(urlB)) { EP.base = r; EP.calBase = `${r}/api/activities/calendar`; break; }
  }

  if (!EP.base) throw new Error("לא נמצא endpoint של Calendar (404). בדוק מיפוי ב-Program.cs");

  // optional me
  const me1 = `${EP.base}/me`;
  const me2 = `${EP.base}/api/me`;
  EP.me = (await probe(me1)) ? me1 : ((await probe(me2)) ? me2 : null);

  // optional activity-types
  const t1 = `${EP.base}/activity-types`;
  const t2 = `${EP.base}/api/activity-types`;
  EP.activityTypes = (await probe(t1)) ? t1 : ((await probe(t2)) ? t2 : null);

  setApiDebug();
}

function calendarUrl(fromIso, toIso, activityTypeId) {
  const qs = new URLSearchParams();
  qs.set("from", fromIso);
  qs.set("to", toIso);
  if (activityTypeId) qs.set("activityTypeId", activityTypeId);
  qs.set("mode", CALENDAR_MODE);
  return `${EP.calBase}?${qs.toString()}`;
}

/* ----------------------------
   Availability route auto-fix
----------------------------- */

let _availabilityBaseWorking = null;

function availabilityCandidates(instanceId) {
  const b = EP.base;

  const basePrefixes = [
    _availabilityBaseWorking,
    `${b}/api`,
    `${b}`,
    b.endsWith("/api") ? b.replace(/\/api$/, "/api/api") : `${b}/api/api`,
    b.endsWith("/api/api") ? b.replace(/\/api\/api$/, "/api") : `${b}/api`,
    b.replace(/\/api\/api$/, "/api"),
    b.replace(/\/api$/, ""),
  ].filter(Boolean);

  const paths = [
    // newer instructor routes (if you have them):
    `/instructors/instances/${instanceId}/availability`,

    // older routes:
    `/activity-instances/${instanceId}/availability`,
    `/activities/activity-instances/${instanceId}/availability`,
    `/activities/instances/${instanceId}/availability`,
    `/availability/activity-instances/${instanceId}`,
    `/availability/${instanceId}`,
  ];

  const urls = [];
  for (const prefix of basePrefixes) {
    for (const p of paths) urls.push(`${prefix}${p}`);
  }
  return [...new Set(urls)];
}

async function callAvailability(instanceId, method) {
  const tries = availabilityCandidates(instanceId);
  let lastErr = null;

  for (const url of tries) {
    try {
      const res = await http(url, { method, headers: { "Accept": "application/json" } });
      if (res.status === 404) { lastErr = new Error(`404 ${url}`); continue; }
      if (res.ok) return { ok: true, usedUrl: url };

      const t = await res.text().catch(() => "");
      throw new Error(`${res.status} ${t}`.trim());
    } catch (e) {
      lastErr = e;
    }
  }

  throw new Error(`לא נמצא Route לזמינות (${method}).\nדוגמה: ${tries[0]}\nאחרון: ${lastErr?.message || "unknown"}`);
}

/* ----------------------------
   Loaders
----------------------------- */

async function loadMe() {
  if (!EP.me) {
    $("meName").textContent = "לא ידוע";
    $("meRole").textContent = "-";
    return;
  }
  try {
    const me = await httpJson(EP.me);
    $("meName").textContent = me.fullName || me.email || "לא ידוע";
    $("meRole").textContent = me.roleName || me.role || "-";
  } catch {
    $("meName").textContent = "לא מחובר";
    $("meRole").textContent = "-";
  }
}

async function loadActivityTypes() {
  const sel = $("activityTypeId");
  if (!sel || !EP.activityTypes) return;
  try {
    const items = await httpJson(EP.activityTypes);
    for (const raw of (items || [])) {
      const id = raw.activityTypeId ?? raw.ActivityTypeId;
      const name = raw.typeName ?? raw.TypeName ?? `סוג #${id}`;
      if (id == null) continue;
      const opt = document.createElement("option");
      opt.value = String(id);
      opt.textContent = name;
      sel.appendChild(opt);
    }
  } catch {
    // optional
  }
}

function setPickerToToday() {
  const t = new Date();
  $("monthPicker").value = `${t.getFullYear()}-${pad2(t.getMonth() + 1)}`;
}

/** local-like ISO without Z */
function monthRangeLocal(ym) {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0);

  const toIsoLocal = (d) => {
    const yyyy = d.getFullYear();
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mi = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
  };

  return { fromIso: toIsoLocal(start), toIso: toIsoLocal(end), y, monthIndex: m - 1 };
}

function groupByDay(instances) {
  const map = new Map();
  for (const it of instances) {
    const d = new Date(it.startUtc);
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  }
  for (const [k, arr] of map.entries()) {
    arr.sort((a, b) => new Date(a.startUtc) - new Date(b.startUtc));
  }
  return map;
}

function normalizeInstance(raw) {
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

    // the only two fields that control coloring/buttons:
    hasAvailability: !!(raw.hasAvailability ?? raw.HasAvailability),
    isAssignedToMe: !!(raw.isAssignedToMe ?? raw.IsAssignedToMe),
  };
}

/* ----------------------------
   State logic (THE FIX)
----------------------------- */

function resolveInstanceState(it) {
  // strict priority
  if (it.isAssignedToMe === true) return "assigned"; // green
  if (it.hasAvailability === true) return "proposed"; // orange
  return "default"; // blue
}

function applyState(instEl, state) {
  instEl.classList.remove("default", "proposed", "assigned");
  instEl.classList.add(state);
}

function animate(instEl) {
  instEl.classList.remove("anim-pop", "anim-pulse");
  void instEl.offsetWidth; // restart animation
  instEl.classList.add("anim-pop", "anim-pulse");
  setTimeout(() => instEl.classList.remove("anim-pop", "anim-pulse"), 750);
}

function renderInstanceActions(it, instEl, actionsEl, noteEl) {
  // clear previous buttons area (keep meta already inserted outside if needed)
  // Here actionsEl is dedicated to buttons area in our renderer
  actionsEl.innerHTML = "";

  // assigned => no buttons
  if (it.isAssignedToMe === true) {
    noteEl.textContent = "שובצת למופע";
    return;
  }

  if (it.hasAvailability === true) {
    noteEl.textContent = "זמינות הוצעה";

    const btn = document.createElement("button");
    btn.className = "btn-mini";
    btn.textContent = "הסר זמינות";
    btn.title = "מוחק את הצעת הזמינות שלך למופע הזה";

    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      btn.disabled = true;
      try {
        await callAvailability(it.activityInstanceId, "DELETE");
        it.hasAvailability = false;

        const st = resolveInstanceState(it);
        applyState(instEl, st);
        animate(instEl);

        noteEl.textContent = "";
        setStatus(`הזמינות הוסרה למופע ${it.activityInstanceId}.`, "ok");
        renderInstanceActions(it, instEl, actionsEl, noteEl);
      } catch (e) {
        setStatus(`שגיאה בהסרת זמינות: ${e.message}`, "err");
      } finally {
        btn.disabled = false;
      }
    });

    actionsEl.appendChild(btn);
    return;
  }

  // default
  noteEl.textContent = "";

  const btn = document.createElement("button");
  btn.className = "btn-mini";
  btn.textContent = "הצע זמינות";
  btn.title = "מסמן שהמדריך המחובר מציע זמינות למופע הזה";

  btn.addEventListener("click", async (ev) => {
    ev.stopPropagation();
    btn.disabled = true;
    try {
      await callAvailability(it.activityInstanceId, "POST");
      it.hasAvailability = true;

      const st = resolveInstanceState(it);
      applyState(instEl, st);
      animate(instEl);

      setStatus(`זמינות הוצעה למופע ${it.activityInstanceId}.`, "ok");
      renderInstanceActions(it, instEl, actionsEl, noteEl);
    } catch (e) {
      setStatus(`שגיאה בהצעת זמינות: ${e.message}`, "err");
    } finally {
      btn.disabled = false;
    }
  });

  actionsEl.appendChild(btn);
}

/* ----------------------------
   Render
----------------------------- */

function renderCalendar(year, monthIndex, rawInstances) {
  $("calTitle").textContent = formatMonthYear(year, monthIndex);

  const grid = $("grid");
  grid.innerHTML = "";

  const instances = (rawInstances || []).map(normalizeInstance);
  const dayMap = groupByDay(instances);

  const first = firstDow(year, monthIndex);
  const days = daysInMonth(year, monthIndex);

  // leading blanks
  for (let i = 0; i < first; i++) {
    const cell = document.createElement("div");
    cell.className = "day";
    grid.appendChild(cell);
  }

  for (let day = 1; day <= days; day++) {
    const cell = document.createElement("div");
    cell.className = "day";

    const num = document.createElement("div");
    num.className = "daynum";
    num.textContent = String(day);
    cell.appendChild(num);

    const list = document.createElement("div");
    list.className = "instances";

    const key = `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
    const arr = dayMap.get(key) || [];

    for (const it of arr) {
      const inst = document.createElement("div");
      inst.className = "inst";

      // ✅ apply correct state on first render (fix for refresh)
      const state = resolveInstanceState(it);
      applyState(inst, state);

      const top = document.createElement("div");
      top.className = "inst-top";

      const title = document.createElement("div");
      title.className = "inst-title";
      title.title = it.activityName || "";
      title.textContent = it.activityName || "ללא שם";

      const time = document.createElement("div");
      time.className = "inst-time";
      time.textContent = `${fmtTime(it.startUtc)}–${fmtTime(it.endUtc)}`;

      top.appendChild(title);
      top.appendChild(time);

      const pills = document.createElement("div");
      pills.className = "pills";
      pills.innerHTML = `
        <span class="pill">חדרים: ${Number(it.roomsCount ?? 0)}</span>
        <span class="pill">נדרשים: ${Number(it.requiredInstructors ?? 0)}</span>
        <span class="pill muted">שובצו: ${Number(it.assignedInstructors ?? 0)}</span>
        <span class="pill muted">מרכז: ${esc(it.leadInstructorName || "—")}</span>
      `;

      const actionsWrap = document.createElement("div");
      actionsWrap.className = "actions";

      const meta = document.createElement("div");
      meta.className = "small";
      meta.textContent = `מופע #${it.activityInstanceId} · פעילות #${it.activityId} · קורס #${it.courseId}`;

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.gap = "10px";
      right.style.alignItems = "center";

      const note = document.createElement("div");
      note.className = "small";

      const btnBox = document.createElement("div"); // buttons go here

      right.appendChild(note);
      right.appendChild(btnBox);

      actionsWrap.appendChild(meta);
      actionsWrap.appendChild(right);

      // ✅ render buttons based on state
      renderInstanceActions(it, inst, btnBox, note);

      inst.appendChild(top);
      inst.appendChild(pills);
      inst.appendChild(actionsWrap);

      list.appendChild(inst);
    }

    cell.appendChild(list);
    grid.appendChild(cell);
  }

  // trailing blanks
  const totalCells = first + days;
  const rem = totalCells % 7;
  if (rem !== 0) {
    for (let i = 0; i < 7 - rem; i++) {
      const cell = document.createElement("div");
      cell.className = "day";
      grid.appendChild(cell);
    }
  }
}

/* ----------------------------
   Refresh
----------------------------- */

async function refresh() {
  const ym = $("monthPicker").value;
  if (!ym) return setStatus("בחר חודש.", "err");

  const { fromIso, toIso, y, monthIndex } = monthRangeLocal(ym);
  const activityTypeId = $("activityTypeId")?.value || "";

  try {
    setStatus("טוען מופעים מהשרת…");
    const data = await httpJson(calendarUrl(fromIso, toIso, activityTypeId));
    if (!Array.isArray(data)) throw new Error("תגובה לא תקינה מהשרת (ציפיתי למערך).");
    renderCalendar(y, monthIndex, data);
    setStatus(`נטענו ${data.length} מופעים לחודש ${ym}`, "ok");
  } catch (e) {
    setStatus(`שגיאה בטעינת חודש: ${e.message}`, "err");
  }
}

/* ----------------------------
   Init
----------------------------- */

window.requireUser = window.requireUser || (async function requireUser(){ return true; });

(async function init() {
  setPickerToToday();

  try {
    await discoverBase();
  } catch (e) {
    setApiDebug();
    setStatus(e.message, "err");
    return;
  }

  await loadMe();
  await loadActivityTypes();

  $("btnReload")?.addEventListener("click", refresh);
  $("btnToday")?.addEventListener("click", async () => { setPickerToToday(); await refresh(); });
  $("monthPicker")?.addEventListener("change", refresh);
  $("activityTypeId")?.addEventListener("change", refresh);

  await refresh();
})();

/**
 * activitiesCalendar.js
 * ------------------------------------------------------------
 * ייעוד: הצגת קלנדר חודשי של מופעי פעילויות למדריך, כולל הצעת/ביטול זמינות מול DB.
 *
 * מקורות מידע:
 * - GET  /api/activities/calendar?from=&to=&activityTypeId=
 *   מחזיר מערך ActivityCalendarItemDto (כולל הדגלים):
 *   - hasAvailability  (bool)  -> המדריך הציע זמינות
 *   - isAssignedToMe   (bool)  -> המדריך משובץ (נעילה)
 *
 * פעולות:
 * - POST   /api/api/activity-instances/{instanceId}/availability  -> הצע זמינות (DB)
 * - DELETE /api/api/activity-instances/{instanceId}/availability  -> בטל זמינות (DB)
 *
 * כללי UI:
 * - isAssignedToMe === true  => ירוק, ללא כפתורים
 * - אחרת, hasAvailability===true => חום + כפתור "בטל זמינות"
 * - אחרת => כחול + כפתור "הצע זמינות"
 */

const $ = (id) => document.getElementById(id);

const APP_PATH = new URL(".", window.location.href).pathname; // .../PocusSchedualer/
const API_CANDIDATES = [
  `${window.location.origin}${APP_PATH}api`,
  `${window.location.origin}${APP_PATH}api/api`
];

let API_BASE = API_CANDIDATES[0];
let ME = null;

function setStatus(text, kind = "") {
  const el = $("status");
  el.className = "msg" + (kind ? " " + kind : "");
  el.textContent = text || "";
}

function pad2(n) { return String(n).padStart(2, "0"); }

function formatMonthYear(year, monthIndex) {
  const monthsHe = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  return `${monthsHe[monthIndex]} ${year}`;
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function firstDow(year, monthIndex) {
  return new Date(year, monthIndex, 1).getDay(); // 0=Sun..6=Sat
}

function esc(s) {
  return (s ?? "").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function fmtTime(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

async function fetchTry(url, opts = {}) {
  return await fetch(url, { credentials: "include", ...opts });
}

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
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  return null;
}

/**
 * Endpoints builder
 * NOTE:
 * - API_BASE is expected to be .../api  (because /api/me exists there)
 * - availability endpoints are under /api/api/... in your backend,
 *   therefore we use `${API_BASE}/api/...`
 */
function EP() {
  return {
    me: `${API_BASE}/me`,
    activityTypes: `${API_BASE}/api/activity-types`,
    calendar: (fromIso, toIso, activityTypeId) => {
      const qs = new URLSearchParams();
      qs.set("from", fromIso);
      qs.set("to", toIso);
      if (activityTypeId) qs.set("activityTypeId", activityTypeId);
      return `${API_BASE}/activities/calendar?${qs.toString()}`;
    },
    proposeAvailability: (instanceId) => `${API_BASE}/api/activity-instances/${instanceId}/availability`,
    cancelAvailability:  (instanceId) => `${API_BASE}/api/activity-instances/${instanceId}/availability`,
  };
}

async function detectApiBase() {
  for (const cand of API_CANDIDATES) {
    const res = await fetchTry(`${cand}/me`);
    if (res.ok || res.status === 401) {
      API_BASE = cand;
      $("apiBase").textContent = API_BASE;
      return;
    }
  }
  $("apiBase").textContent = API_BASE;
}

async function loadMe() {
  try {
    ME = await httpJson(EP().me);
    $("meName").textContent = ME.fullName || ME.email || "לא ידוע";
    $("meRole").textContent = ME.roleName || "-";
  } catch {
    ME = null;
    $("meName").textContent = "לא מחובר";
    $("meRole").textContent = "-";
  }
}

async function loadActivityTypes() {
  try {
    const items = await httpJson(EP().activityTypes);
    const sel = $("activityTypeId");
    for (const it of (items || [])) {
      const opt = document.createElement("option");
      opt.value = String(it.activityTypeId);
      opt.textContent = it.typeName;
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

function monthRangeLocal(ym) {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0);

  // send "local-like" ISO (without Z). Program.cs converts local -> UTC.
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
    map.set(k, arr);
  }
  return map;
}

/**
 * Applies UI status classes based on server flags.
 * @param {HTMLDivElement} instEl
 * @param {any} it
 */
function applyStatusClasses(instEl, it) {
  instEl.classList.remove("assigned", "proposed");
  if (it.isAssignedToMe) instEl.classList.add("assigned");
  else if (it.hasAvailability) instEl.classList.add("proposed");
}

function renderCalendar(year, monthIndex, instances) {
  $("calTitle").textContent = formatMonthYear(year, monthIndex);
  const grid = $("grid");
  grid.innerHTML = "";

  const first = firstDow(year, monthIndex);
  const days = daysInMonth(year, monthIndex);
  const dayMap = groupByDay(instances);

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

    for (const raw of arr) {
      // Normalize potential casing differences
      const it = {
        activityInstanceId: raw.activityInstanceId ?? raw.ActivityInstanceId,
        activityId: raw.activityId ?? raw.ActivityId,
        activityName: raw.activityName ?? raw.ActivityName,
        courseId: raw.courseId ?? raw.CourseId,
        leadInstructorName: raw.leadInstructorName ?? raw.LeadInstructorName,
        startUtc: raw.startUtc ?? raw.StartUtc,
        endUtc: raw.endUtc ?? raw.EndUtc,
        roomsCount: raw.roomsCount ?? raw.RoomsCount,
        requiredInstructors: raw.requiredInstructors ?? raw.RequiredInstructors,
        hasAvailability: !!(raw.hasAvailability ?? raw.HasAvailability),
        isAssignedToMe: !!(raw.isAssignedToMe ?? raw.IsAssignedToMe),
      };

      const inst = document.createElement("div");
      inst.className = "inst";
      applyStatusClasses(inst, it);

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

      const rooms = Number(it.roomsCount ?? 0);
      const req = Number(it.requiredInstructors ?? 0);

      pills.innerHTML = `
        <span class="pill">חדרים: ${rooms}</span>
        <span class="pill">נדרשים: ${req}</span>
        <span class="pill muted">מרכז: ${esc(it.leadInstructorName || "—")}</span>
      `;

      const actions = document.createElement("div");
      actions.className = "actions";

      const meta = document.createElement("div");
      meta.className = "small";
      meta.textContent = `מופע #${it.activityInstanceId} · פעילות #${it.activityId} · קורס #${it.courseId}`;

      actions.appendChild(meta);

      // ✅ RULE: if assigned => green + NO buttons
      if (!it.isAssignedToMe) {
        if (it.hasAvailability) {
          // brown + cancel
          const btnCancel = document.createElement("button");
          btnCancel.className = "btn-mini cancel";
          btnCancel.textContent = "בטל זמינות";
          btnCancel.title = "מבטל את הצעת הזמינות שלך למופע הזה";

          btnCancel.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            try {
              btnCancel.disabled = true;
              await httpJson(EP().cancelAvailability(it.activityInstanceId), { method: "DELETE" });
              it.hasAvailability = false;
              applyStatusClasses(inst, it);
              setStatus(`בוטלה זמינות למופע ${it.activityInstanceId}.`, "ok");
            } catch (e) {
              setStatus(`שגיאה בביטול זמינות: ${e.message}`, "err");
            } finally {
              btnCancel.disabled = false;
            }
          });

          actions.appendChild(btnCancel);
        } else {
          // blue + propose
          const btnPropose = document.createElement("button");
          btnPropose.className = "btn-mini primary";
          btnPropose.textContent = "הצע זמינות";
          btnPropose.title = "מסמן שהמדריך המחובר מציע זמינות למופע הזה";

          btnPropose.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            try {
              btnPropose.disabled = true;
              await httpJson(EP().proposeAvailability(it.activityInstanceId), { method: "POST" });
              it.hasAvailability = true;
              applyStatusClasses(inst, it);
              setStatus(`זמינות הוצעה למופע ${it.activityInstanceId}.`, "ok");
            } catch (e) {
              setStatus(`שגיאה בהצעת זמינות: ${e.message}`, "err");
            } finally {
              btnPropose.disabled = false;
            }
          });

          actions.appendChild(btnPropose);
        }
      }

      inst.appendChild(top);
      inst.appendChild(pills);
      inst.appendChild(actions);

      list.appendChild(inst);
    }

    cell.appendChild(list);
    grid.appendChild(cell);
  }

  const totalCells = first + days;
  const remainder = totalCells % 7;
  if (remainder !== 0) {
    const add = 7 - remainder;
    for (let i = 0; i < add; i++) {
      const cell = document.createElement("div");
      cell.className = "day";
      grid.appendChild(cell);
    }
  }
}

async function refresh() {
  const ym = $("monthPicker").value;
  if (!ym) {
    setStatus("בחר חודש.", "err");
    return;
  }

  const { fromIso, toIso, y, monthIndex } = monthRangeLocal(ym);
  const activityTypeId = $("activityTypeId").value || "";

  try {
    setStatus("טוען מופעים מהשרת…");
    const data = await httpJson(EP().calendar(fromIso, toIso, activityTypeId));
    if (!Array.isArray(data)) throw new Error("תגובה לא תקינה מהשרת (ציפיתי למערך).");

    renderCalendar(y, monthIndex, data);
    setStatus(`נטענו ${data.length} מופעים לחודש ${ym}`, "ok");
  } catch (e) {
    setStatus(`שגיאה בטעינת חודש: ${e.message}`, "err");
  }
}

(async function init() {
  await detectApiBase();
  $("apiBase").textContent = API_BASE;

  setPickerToToday();
  await loadMe();
  await loadActivityTypes();

  $("btnReload").addEventListener("click", refresh);
  $("btnToday").addEventListener("click", async () => { setPickerToToday(); await refresh(); });
  $("monthPicker").addEventListener("change", refresh);
  $("activityTypeId").addEventListener("change", refresh);

  await refresh();
})();

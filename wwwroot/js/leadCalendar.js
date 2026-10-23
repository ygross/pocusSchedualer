/* ============================
   LeadCalendar – Course filter
   ============================ */

requireUser();

const API_BASE = "/simcenter/PocusSchedualer/api";

const EP = {
  calendar:  `${API_BASE}/leadcalendar`,
  myCourses: `${API_BASE}/lead/my-courses`,
  reminder:  `${API_BASE}/leadcalendar/instances`,
};

const els = {
  monthTitle:    document.getElementById("monthTitle"),
  prev:          document.getElementById("btnPrev"),
  next:          document.getElementById("btnNext"),
  refresh:       document.getElementById("btnRefresh"),
  search:        document.getElementById("searchBox"),
  legend:        document.getElementById("legendItems"),
  grid:          document.getElementById("grid"),
  courseFilter:  document.getElementById("courseFilter"),
};

let current = new Date();
let raw = null;
let selectedCourseId = null;

// Set month title immediately (before any async calls)
document.getElementById("monthTitle").textContent =
  new Intl.DateTimeFormat("he-IL",{month:"long",year:"numeric"}).format(current);

/* ---------- helpers ---------- */
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

function monthLabel(d){
  return new Intl.DateTimeFormat("he-IL",{month:"long",year:"numeric"}).format(d);
}

/* ---------- API ---------- */
async function apiGet(url){
  const r = await fetch(url,{credentials:"include"});
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* ---------- populate course dropdown ---------- */
async function loadCourses(){
  if (!els.courseFilter) return;
  try {
    const courses = await apiGet(EP.myCourses);
    els.courseFilter.innerHTML =
      `<option value="">כל הקורסים</option>` +
      (courses || []).map(c =>
        `<option value="${c.courseId}">${c.courseName}</option>`
      ).join("");
    els.courseFilter.addEventListener("change", () => {
      selectedCourseId = els.courseFilter.value ? Number(els.courseFilter.value) : null;
      loadMonth();
    });
  } catch(e) {
    console.warn("Could not load courses:", e);
  }
}

/* ---------- load ---------- */
async function loadMonth(){
  const from = new Date(current.getFullYear(), current.getMonth(), 1);
  const to   = new Date(current.getFullYear(), current.getMonth()+1, 0);

  els.monthTitle.textContent = monthLabel(current);

  let url = `${EP.calendar}?from=${from.toISOString()}&to=${to.toISOString()}`;
  if (selectedCourseId) url += `&courseId=${selectedCourseId}`;
  raw = await apiGet(url);

  renderLegend();
  renderCalendar();
}

/* ---------- legend ---------- */
function renderLegend(){
  els.legend.innerHTML = (raw.activities || []).map(a=>`
    <div class="legend-item">
      <span class="swatch" style="background:${a.color}"></span>
      ${a.activityName}
    </div>
  `).join("");
}

/* ---------- calendar ---------- */
function renderCalendar(){
  els.grid.innerHTML = "";

  const search = (els.search?.value || "").trim().toLowerCase();

  const map = {};
  for(const it of raw.instances || []){
    if(search && !it.activityName.toLowerCase().includes(search)) continue;
    const d = new Date(it.startUtc);
    const key = ymd(d);
    (map[key] ||= []).push(it);
  }

  const start = new Date(current.getFullYear(), current.getMonth(), 1);
  const offset = start.getDay();
  start.setDate(start.getDate() - offset);

  for(let i=0;i<42;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);

    const key = ymd(d);
    const items = map[key] || [];

    const cell = document.createElement("div");
    cell.className = "day";

    cell.innerHTML = `
      <div class="day-head">${d.getDate()}</div>
      <div class="items"></div>
    `;

    const wrap = cell.querySelector(".items");

    for(const it of items){
      const el = document.createElement("div");
      el.className = "item";
      el.style.borderColor = it.color;
      el.innerHTML = `
        <div class="item-title">${it.activityName}</div>
        <div class="item-meta">#${it.instanceId}</div>
      `;
      wrap.appendChild(el);
    }

    els.grid.appendChild(cell);
  }
}

/* ---------- events ---------- */
els.prev.onclick    = ()=>{ current.setMonth(current.getMonth()-1); els.monthTitle.textContent = monthLabel(current); loadMonth(); };
els.next.onclick    = ()=>{ current.setMonth(current.getMonth()+1); els.monthTitle.textContent = monthLabel(current); loadMonth(); };
els.refresh.onclick = loadMonth;
if(els.search) els.search.oninput = renderCalendar;

loadCourses().then(() => loadMonth());


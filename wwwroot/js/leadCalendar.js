/* ============================
   LeadCalendar – uses real API
   ============================ */

// Dynamic API base – works regardless of virtual directory
const _lcPath = new URL(".", window.location.href).pathname;
const API_BASE_LC = `${window.location.origin}${_lcPath}api`;

const EP_LC = {
  calendar: (from, to) =>
    `${API_BASE_LC}/activities/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
};

const els = {
  monthTitle: document.getElementById("monthTitle"),
  prev:       document.getElementById("btnPrev"),
  next:       document.getElementById("btnNext"),
  refresh:    document.getElementById("btnRefresh"),
  search:     document.getElementById("searchBox"),
  legend:     document.getElementById("legendItems"),
  grid:       document.getElementById("grid"),
};

let current = new Date();
let rawItems = [];

/* ---------- helpers ---------- */
const _pad = n => String(n).padStart(2, "0");
const _ymd = d => `${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())}`;

function monthLabel(d) {
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(d);
}

function activityColor(name) {
  let h = 0;
  for (const ch of (name || "")) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 60% 65%)`;
}

function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- API ---------- */
async function lcApiGet(url) {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* ---------- load ---------- */
async function loadMonth() {
  const from = new Date(current.getFullYear(), current.getMonth(), 1);
  const to   = new Date(current.getFullYear(), current.getMonth() + 1, 1);

  if (els.monthTitle) els.monthTitle.textContent = monthLabel(current);

  try {
    const data = await lcApiGet(EP_LC.calendar(from.toISOString(), to.toISOString()));
    rawItems = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("LeadCalendar load error:", e);
    rawItems = [];
  }

  renderLegend();
  renderCalendar();
}

/* ---------- legend ---------- */
function renderLegend() {
  if (!els.legend) return;
  const seen = new Set();
  const activities = rawItems.filter(r => {
    if (seen.has(r.activityId)) return false;
    seen.add(r.activityId);
    return true;
  });
  els.legend.innerHTML = activities.map(a => `
    <div class="legend-item">
      <span class="swatch" style="background:${activityColor(a.activityName)}"></span>
      ${escHtml(a.activityName)}
    </div>
  `).join("");
}

/* ---------- calendar grid ---------- */
function renderCalendar() {
  if (!els.grid) return;
  els.grid.innerHTML = "";

  const q = (els.search?.value || "").toLowerCase().trim();

  const map = {};
  for (const it of rawItems) {
    if (q && !(it.activityName || "").toLowerCase().includes(q)) continue;
    const d = new Date(it.startUtc);
    const key = _ymd(d);
    (map[key] ||= []).push(it);
  }

  const gridStart = new Date(current.getFullYear(), current.getMonth(), 1);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);

    const key = _ymd(d);
    const items = map[key] || [];

    const cell = document.createElement("div");
    cell.className = "day" + (d.getMonth() !== current.getMonth() ? " out-of-month" : "");
    cell.innerHTML = `<div class="day-head">${d.getDate()}</div><div class="items"></div>`;

    const wrap = cell.querySelector(".items");
    for (const it of items) {
      const color = activityColor(it.activityName);
      const el = document.createElement("div");
      el.className = "item";
      el.style.borderColor = color;
      el.style.background  = color + "44";
      el.innerHTML = `<div class="item-title">${escHtml(it.activityName)}</div>`;
      wrap.appendChild(el);
    }

    els.grid.appendChild(cell);
  }
}

/* ---------- events ---------- */
if (els.prev)    els.prev.onclick    = () => { current.setMonth(current.getMonth() - 1); loadMonth(); };
if (els.next)    els.next.onclick    = () => { current.setMonth(current.getMonth() + 1); loadMonth(); };
if (els.refresh) els.refresh.onclick = loadMonth;
if (els.search)  els.search.addEventListener("input", renderCalendar);

loadMonth();

const _dir = window.location.pathname.replace(/\/[^\/]*$/, "");
const API_BASE = `${_dir}/api/api`;

let allData = [];
let filteredData = [];

function lastMonthRange() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { y: d.getFullYear(), m: d.getMonth() }; // month 0-based
}

async function init() {
  try {
    const me = await fetchJson(`${API_BASE}/me`);
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    document.getElementById('dotApi').className = 'dot is-ok';
    document.getElementById('apiBase').textContent = window.location.origin;

    const health = await fetchJson(`${API_BASE}/health/db`).catch(() => null);
    document.getElementById('dotDb').className = health ? 'dot is-ok' : 'dot is-err';

    await loadReport();
  } catch (e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function loadReport() {
  try {
    allData = await fetchJson(`${API_BASE}/admin/hours-report`);
    applyFilters();
  } catch (e) {
    showErr('שגיאה בטעינת הדוח: ' + e.message);
  }
}

function applyFilters() {
  const search = (document.getElementById('searchBox')?.value || '').toLowerCase();
  const range = document.getElementById('filterRange')?.value || 'lastMonth';
  const now = new Date();
  const lm = lastMonthRange();

  filteredData = allData.filter(r => {
    if (search) {
      const txt = ((r.instructorName || '') + ' ' + (r.activityName || '') + ' ' + (r.courseName || '')).toLowerCase();
      if (!txt.includes(search)) return false;
    }
    if (range !== 'all') {
      const start = new Date(r.startUtc);
      if (range === 'lastMonth' && (start.getMonth() !== lm.m || start.getFullYear() !== lm.y)) return false;
      if (range === 'week') {
        const ws = new Date(); ws.setDate(now.getDate() - 7);
        if (start < ws) return false;
      }
      if (range === 'month' && (start.getMonth() !== now.getMonth() || start.getFullYear() !== now.getFullYear())) return false;
      if (range === 'nextMonth') {
        const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        if (start.getMonth() !== nm.getMonth() || start.getFullYear() !== nm.getFullYear()) return false;
      }
    }
    return true;
  });

  renderKpi();
  renderSummary();
  renderDetails();
}

function renderKpi() {
  const totalHrs = filteredData.reduce((s, x) => s + (x.hours || 0), 0);
  document.getElementById('totalHours').textContent = totalHrs.toFixed(1);
  document.getElementById('totalSessions').textContent = filteredData.length;
  document.getElementById('totalInstructors').textContent = new Set(filteredData.map(x => x.instructorId)).size;
}

function renderSummary() {
  const map = {};
  filteredData.forEach(r => {
    const key = r.instructorId;
    if (!map[key]) map[key] = { name: r.instructorName, dept: r.department || '—', courses: new Set(), hours: 0, sessions: 0 };
    if (r.courseName) map[key].courses.add(r.courseName);
    map[key].hours += r.hours || 0;
    map[key].sessions++;
  });

  const tbody = document.getElementById('summaryBody');
  const rows = Object.values(map).sort((a, b) => b.hours - a.hours);
  tbody.innerHTML = rows.length
    ? rows.map(d => `<tr>
        <td>${d.name}</td>
        <td>${d.dept}</td>
        <td title="${[...d.courses].join(', ')}">${d.courses.size > 0 ? [...d.courses].join(', ').substring(0,50) : '—'}</td>
        <td>${d.sessions}</td>
        <td>${d.hours.toFixed(1)}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="empty-cell">אין נתונים</td></tr>';
}

function renderDetails() {
  const tbody = document.getElementById('detailsBody');
  tbody.innerHTML = filteredData.length
    ? filteredData.map(r => `
      <tr>
        <td>${fmtDate(r.startUtc)}</td>
        <td>${r.courseName || '—'}</td>
        <td>${r.activityName || '—'}</td>
        <td>${r.instructorName || '—'}</td>
        <td>${(r.hours || 0).toFixed(1)}</td>
        <td>${r.assignmentStatus || '—'}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="empty-cell">אין נתונים</td></tr>';
}

function fmtDate(utc) {
  if (!utc) return '—';
  return new Date(utc).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
}

function showErr(msg) {
  const el = document.getElementById('errBox');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

async function fetchJson(url) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error('API error ' + r.status);
  return r.json();
}

document.getElementById('searchBox')?.addEventListener('input', applyFilters);
document.getElementById('filterRange')?.addEventListener('change', applyFilters);

const themeBtn = document.getElementById('themeToggle');
if (localStorage.getItem('theme') === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn?.addEventListener('click', () => {
  const d = document.body.classList.toggle('theme-dark');
  localStorage.setItem('theme', d ? 'dark' : 'light');
});

init();

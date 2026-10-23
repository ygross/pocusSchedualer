const _dir = window.location.pathname.replace(/\/[^\/]*$/, "");
const API_BASE = `${_dir}/api/api`;
let allData = [];

function lastMonthRange() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const y = d.getFullYear(), m = d.getMonth(); // 0-based
  const ym = `${y}-${String(m + 1).padStart(2, '0')}`;
  return ym;
}

async function init() {
  try {
    const me = await fetchJson(`${API_BASE}/me`);
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    const health = await fetchJson(`${API_BASE}/health/db`).catch(() => null);
    document.getElementById('dotDb').className = health ? 'dot is-ok' : 'dot is-err';
    await load();
  } catch(e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function load() {
  try {
    allData = await fetchJson(`${API_BASE}/admin/hours-report`);
    applyFilters();
  } catch(e) { showErr('שגיאה בטעינה: ' + e.message); }
}

function applyFilters() {
  const q = (document.getElementById('searchBox')?.value || '').toLowerCase();
  const range = document.getElementById('filterRange')?.value || 'lastMonth';
  const now = new Date();
  const lastMonthYM = lastMonthRange();

  let data = allData.filter(r => {
    if (q && !(r.instructorName || '').toLowerCase().includes(q)) return false;
    if (range !== 'all') {
      const d = new Date(r.startUtc);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (range === 'lastMonth' && ym !== lastMonthYM) return false;
      if (range === 'month' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
      if (range === 'week') {
        const ws = new Date(); ws.setDate(now.getDate() - 7);
        if (d < ws) return false;
      }
    }
    return true;
  });

  // aggregate by instructor + courses
  const map = {};
  data.forEach(r => {
    const k = r.instructorId;
    if (!map[k]) map[k] = { name: r.instructorName, dept: r.department || '—', courses: new Set(), courseNames: new Set(), sessions: 0, hours: 0 };
    if (r.courseId) map[k].courses.add(r.courseId);
    if (r.courseName) map[k].courseNames.add(r.courseName);
    map[k].sessions++;
    map[k].hours += r.hours || 0;
  });

  const rows = Object.values(map).sort((a, b) => b.hours - a.hours);
  const maxHours = rows.length ? rows[0].hours : 1;

  document.getElementById('kpiHours').textContent = data.reduce((s, x) => s + (x.hours || 0), 0).toFixed(1);
  document.getElementById('kpiSessions').textContent = data.length;
  document.getElementById('kpiInstructors').textContent = rows.length;

  const tbody = document.getElementById('tblBody');
  tbody.innerHTML = rows.length
    ? rows.map((r, i) => {
        const pct = Math.round((r.hours / maxHours) * 100);
        const courseList = r.courseNames.size ? [...r.courseNames].join(', ') : '—';
        return `<tr>
          <td>${i + 1}</td>
          <td>${r.name}</td>
          <td>${r.dept}</td>
          <td title="${courseList}">${r.courses.size} (${courseList.substring(0, 40)}${courseList.length > 40 ? '…' : ''})</td>
          <td>${r.sessions}</td>
          <td>${r.hours.toFixed(1)}</td>
          <td><div class="bar-wrap"><div class="bar-fill" style="width:${pct}%"></div></div> ${pct}%</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" class="empty-cell">אין נתונים</td></tr>';
}

function showErr(msg) { const e = document.getElementById('errBox'); if(e){e.textContent=msg;e.style.display='block';} }
async function fetchJson(url) { const r = await fetch(url,{credentials:'include'}); if(!r.ok) throw new Error('API error '+r.status); return r.json(); }

document.getElementById('searchBox').addEventListener('input', applyFilters);
document.getElementById('filterRange').addEventListener('change', applyFilters);

const themeBtn = document.getElementById('themeToggle');
if (localStorage.getItem('theme') === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn?.addEventListener('click', () => { const d = document.body.classList.toggle('theme-dark'); localStorage.setItem('theme', d?'dark':'light'); });

init();

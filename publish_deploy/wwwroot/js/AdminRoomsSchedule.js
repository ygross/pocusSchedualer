const _dir = window.location.pathname.replace(/\/[^\/]*$/, "");
const API_BASE = `${_dir}/api/api`;
let allInstances = [];

async function init() {
  try {
    const me = await fetchJson(`${API_BASE}/me`);
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';

    const health = await fetchJson(`${API_BASE}/health/db`).catch(() => null);
    document.getElementById('dotDb').className = health ? 'dot is-ok' : 'dot is-err';

    // Default: last calendar month
    const now = new Date();
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = lm.getFullYear(), m = String(lm.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(lm.getFullYear(), lm.getMonth() + 1, 0).getDate();
    document.getElementById('fromDate').value = `${y}-${m}-01`;
    document.getElementById('toDate').value = `${y}-${m}-${String(lastDay).padStart(2,'0')}`;

    await loadInstances();
  } catch(e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function loadInstances() {
  try {
    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const data = await fetchJson(`${API_BASE}/activities/calendar?${params}`);
    allInstances = Array.isArray(data) ? data : (data.instances || data.items || []);
    applyFilters();
  } catch(e) {
    showErr('שגיאה בטעינת נתונים: ' + e.message);
  }
}

function applyFilters() {
  const q = document.getElementById('searchBox').value.toLowerCase();
  const filtered = allInstances.filter(r => {
    if (q && !(r.activityName || r.name || '').toLowerCase().includes(q)) return false;
    return true;
  });

  document.getElementById('kpiInstances').textContent = filtered.length;
  document.getElementById('kpiRooms').textContent = filtered.reduce((s, r) => s + (r.roomsCount || r.rooms || 0), 0);
  document.getElementById('kpiCancelled').textContent = filtered.filter(r => r.isCancelled).length;

  const tbody = document.getElementById('tblBody');
  const sorted = [...filtered].sort((a, b) => new Date(a.startUtc || a.start) - new Date(b.startUtc || b.start));
  tbody.innerHTML = sorted.length
    ? sorted.map(r => {
        const cancelled = r.isCancelled;
        return `<tr>
          <td>${fmtDate(r.startUtc || r.start)}</td>
          <td>${fmtTime(r.startUtc || r.start)}–${fmtTime(r.endUtc || r.end)}</td>
          <td>${r.activityName || r.name || '—'}</td>
          <td>${r.courseName || '—'}</td>
          <td><span class="rooms-pill">${r.roomsCount || r.rooms || '—'}</span></td>
          <td>${r.requiredInstructors || '—'}</td>
          <td><span class="badge ${cancelled ? 'cancelled' : 'active'}">${cancelled ? 'בוטל' : 'פעיל'}</span></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" class="empty-cell">אין מופעים לתקופה זו</td></tr>';
}

function fmtDate(u) { return u ? new Date(u).toLocaleDateString('he-IL') : '—'; }
function fmtTime(u) { return u ? new Date(u).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '—'; }
function showErr(msg) { const e = document.getElementById('msgErr'); if(e){e.textContent=msg;e.style.display='block';} }
async function fetchJson(url) { const r = await fetch(url, { credentials: 'include' }); if(!r.ok) throw new Error('API error '+r.status); return r.json(); }

document.getElementById('fromDate').addEventListener('change', loadInstances);
document.getElementById('toDate').addEventListener('change', loadInstances);
document.getElementById('searchBox').addEventListener('input', applyFilters);

const themeBtn = document.getElementById('themeToggle');
if (localStorage.getItem('theme') === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn?.addEventListener('click', () => { const d = document.body.classList.toggle('theme-dark'); localStorage.setItem('theme', d?'dark':'light'); });

init();

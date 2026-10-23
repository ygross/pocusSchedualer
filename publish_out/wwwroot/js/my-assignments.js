const _dir = window.location.pathname.replace(/\/[^\/]*$/, "");
const API_BASE = `${_dir}/api/api`;
let allRows = [];
let monthFilter = 'this';

function lastMonthYM() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

    await loadAssignments();
  } catch (e) {
    showErr('שגיאה בטעינה: ' + e.message);
    document.getElementById('dotSession').className = 'dot is-err';
  }
}

function pad2(n) { return String(n).padStart(2, '0'); }

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function fmtTime(isoStart, isoEnd) {
  if (!isoStart) return '';
  const s = new Date(isoStart);
  const e = new Date(isoEnd);
  const ts = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
  if (!isoEnd || isNaN(e)) return ts;
  return `${ts}–${pad2(e.getHours())}:${pad2(e.getMinutes())}`;
}

async function loadAssignments() {
  try {
    const data = await fetchJson(`${API_BASE}/instructor/my-assignments`);
    allRows = data.map(r => ({
      date:       fmtDate(r.startUtc),
      time:       fmtTime(r.startUtc, r.endUtc),
      name:       r.activityName || '',
      instanceId: r.instanceId   || '',
      hours:      parseFloat(r.hours || 0),
      status:     r.status       || 'Approved'
    }));
    render();
  } catch (e) {
    showErr('שגיאה בטעינת שיבוצים: ' + e.message);
  }
}

function ymStr(y, m) { return `${y}-${pad2(m)}`; }

function render() {
  const q = (document.getElementById('qSearch')?.value || '').toLowerCase();
  const now  = new Date();
  const y    = now.getFullYear();
  const m    = now.getMonth() + 1;
  const monthThis = ymStr(y, m);
  const monthLast = m === 1 ? ymStr(y-1, 12) : ymStr(y, m-1);
  const monthNext = m === 12 ? ymStr(y+1, 1) : ymStr(y, m+1);

  const filtered = allRows.filter(r => {
    if (monthFilter === 'this' && !r.date.startsWith(monthThis)) return false;
    if (monthFilter === 'last' && !r.date.startsWith(monthLast)) return false;
    if (monthFilter === 'next' && !r.date.startsWith(monthNext)) return false;
    if (q && !JSON.stringify(r).toLowerCase().includes(q)) return false;
    return true;
  });

  const tb = document.getElementById('tblBody');
  if (!filtered.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty-cell">אין שיבוצים להצגה</td></tr>';
    document.getElementById('hoursSummary').textContent = 'סה״כ: 0 שעות';
    return;
  }

  tb.innerHTML = filtered.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${r.time}</td>
      <td>${r.name}</td>
      <td>${r.instanceId || '—'}</td>
      <td>${r.hours.toFixed ? r.hours.toFixed(1) : r.hours}</td>
      <td><span class="badge-status ${(r.status || '').toLowerCase()}">${r.status}</span></td>
    </tr>
  `).join('');

  const totalHours = filtered.reduce((s, r) => s + r.hours, 0);
  document.getElementById('hoursSummary').textContent = `סה״כ: ${totalHours.toFixed(1)} שעות`;
}

function setFilter(f) {
  monthFilter = f;
  document.getElementById('btnAll')?.classList.toggle('active', f === 'all');
  document.getElementById('btnLast')?.classList.toggle('active', f === 'last');
  document.getElementById('btnThis')?.classList.toggle('active', f === 'this');
  document.getElementById('btnNext')?.classList.toggle('active', f === 'next');
  render();
}

function showErr(msg) {
  const el = document.getElementById('msgErr');
  el.textContent = msg;
  el.style.display = 'block';
}

async function fetchJson(url) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error('API error ' + r.status);
  return r.json();
}

// Theme — default dark, match app.js
const themeBtn = document.getElementById('themeToggle');
if (localStorage.getItem('theme') === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn?.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('theme-dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

document.getElementById('btnAll')?.addEventListener('click',  () => setFilter('all'));
document.getElementById('btnLast')?.addEventListener('click', () => setFilter('last'));
document.getElementById('btnThis')?.addEventListener('click', () => setFilter('this'));
document.getElementById('btnNext')?.addEventListener('click', () => setFilter('next'));
document.getElementById('qSearch')?.addEventListener('input', render);
setFilter('this');

init();

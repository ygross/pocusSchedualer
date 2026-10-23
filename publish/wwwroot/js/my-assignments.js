const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + (const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + '/api/api';
const API = '';
let allRows = [];
let monthFilter = 'all';

async function init() {
  try {
    const me = await fetchJson('/api/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    document.getElementById('dotApi').className = 'dot is-ok';

    const health = await fetchJson('/api/health/db').catch(() => null);
    document.getElementById('dotDb').className = health ? 'dot is-ok' : 'dot is-err';

    const base = window.location.origin;
    document.getElementById('apiBase').textContent = base;

    await loadAssignments();
  } catch (e) {
    showErr('שגיאה בטעינה: ' + e.message);
    document.getElementById('dotSession').className = 'dot is-err';
  }
}

async function loadAssignments() {
  try {
    const data = await fetchJson('/api/instructors/stats');
    allRows = buildRows(data);
    render();
  } catch (e) {
    showErr('שגיאה בטעינת שיבוצים: ' + e.message);
  }
}

function buildRows(data) {
  const rows = [];
  const byActivity = data.byActivity || [];
  byActivity.forEach(a => {
    rows.push({
      date: a.startDate || '',
      time: a.timeRange || '',
      name: a.activityName || a.name || '',
      instanceId: a.instanceId || '',
      hours: parseFloat(a.totalHours || a.hours || 0),
      status: a.status || 'Approved'
    });
  });
  return rows;
}

function render() {
  const q = document.getElementById('qSearch').value.toLowerCase();
  const now = new Date();
  const monthNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthNext = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;

  const filtered = allRows.filter(r => {
    if (monthFilter === 'this' && !r.date.startsWith(monthNow)) return false;
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
  document.getElementById('btnAll').classList.toggle('active', f === 'all');
  document.getElementById('btnThis').classList.toggle('active', f === 'this');
  document.getElementById('btnNext').classList.toggle('active', f === 'next');
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

// Theme toggle
const themeBtn = document.getElementById('themeToggle');
const saved = localStorage.getItem('theme');
if (saved === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('theme-dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

document.getElementById('btnAll').addEventListener('click', () => setFilter('all'));
document.getElementById('btnThis').addEventListener('click', () => setFilter('this'));
document.getElementById('btnNext').addEventListener('click', () => setFilter('next'));
document.getElementById('qSearch').addEventListener('input', render);
setFilter('all');

init();
apiBase+'/api';
const API = '';
let allRows = [];
let monthFilter = 'all';

async function init() {
  try {
    const me = await fetchJson((const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + '/api/api';
const API = '';
let allRows = [];
let monthFilter = 'all';

async function init() {
  try {
    const me = await fetchJson('/api/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    document.getElementById('dotApi').className = 'dot is-ok';

    const health = await fetchJson('/api/health/db').catch(() => null);
    document.getElementById('dotDb').className = health ? 'dot is-ok' : 'dot is-err';

    const base = window.location.origin;
    document.getElementById('apiBase').textContent = base;

    await loadAssignments();
  } catch (e) {
    showErr('שגיאה בטעינה: ' + e.message);
    document.getElementById('dotSession').className = 'dot is-err';
  }
}

async function loadAssignments() {
  try {
    const data = await fetchJson('/api/instructors/stats');
    allRows = buildRows(data);
    render();
  } catch (e) {
    showErr('שגיאה בטעינת שיבוצים: ' + e.message);
  }
}

function buildRows(data) {
  const rows = [];
  const byActivity = data.byActivity || [];
  byActivity.forEach(a => {
    rows.push({
      date: a.startDate || '',
      time: a.timeRange || '',
      name: a.activityName || a.name || '',
      instanceId: a.instanceId || '',
      hours: parseFloat(a.totalHours || a.hours || 0),
      status: a.status || 'Approved'
    });
  });
  return rows;
}

function render() {
  const q = document.getElementById('qSearch').value.toLowerCase();
  const now = new Date();
  const monthNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthNext = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;

  const filtered = allRows.filter(r => {
    if (monthFilter === 'this' && !r.date.startsWith(monthNow)) return false;
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
  document.getElementById('btnAll').classList.toggle('active', f === 'all');
  document.getElementById('btnThis').classList.toggle('active', f === 'this');
  document.getElementById('btnNext').classList.toggle('active', f === 'next');
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

// Theme toggle
const themeBtn = document.getElementById('themeToggle');
const saved = localStorage.getItem('theme');
if (saved === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('theme-dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

document.getElementById('btnAll').addEventListener('click', () => setFilter('all'));
document.getElementById('btnThis').addEventListener('click', () => setFilter('this'));
document.getElementById('btnNext').addEventListener('click', () => setFilter('next'));
document.getElementById('qSearch').addEventListener('input', render);
setFilter('all');

init();
apiBase+'/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    document.getElementById('dotApi').className = 'dot is-ok';

    const health = await fetchJson((const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + '/api/api';
const API = '';
let allRows = [];
let monthFilter = 'all';

async function init() {
  try {
    const me = await fetchJson('/api/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    document.getElementById('dotApi').className = 'dot is-ok';

    const health = await fetchJson('/api/health/db').catch(() => null);
    document.getElementById('dotDb').className = health ? 'dot is-ok' : 'dot is-err';

    const base = window.location.origin;
    document.getElementById('apiBase').textContent = base;

    await loadAssignments();
  } catch (e) {
    showErr('שגיאה בטעינה: ' + e.message);
    document.getElementById('dotSession').className = 'dot is-err';
  }
}

async function loadAssignments() {
  try {
    const data = await fetchJson('/api/instructors/stats');
    allRows = buildRows(data);
    render();
  } catch (e) {
    showErr('שגיאה בטעינת שיבוצים: ' + e.message);
  }
}

function buildRows(data) {
  const rows = [];
  const byActivity = data.byActivity || [];
  byActivity.forEach(a => {
    rows.push({
      date: a.startDate || '',
      time: a.timeRange || '',
      name: a.activityName || a.name || '',
      instanceId: a.instanceId || '',
      hours: parseFloat(a.totalHours || a.hours || 0),
      status: a.status || 'Approved'
    });
  });
  return rows;
}

function render() {
  const q = document.getElementById('qSearch').value.toLowerCase();
  const now = new Date();
  const monthNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthNext = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;

  const filtered = allRows.filter(r => {
    if (monthFilter === 'this' && !r.date.startsWith(monthNow)) return false;
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
  document.getElementById('btnAll').classList.toggle('active', f === 'all');
  document.getElementById('btnThis').classList.toggle('active', f === 'this');
  document.getElementById('btnNext').classList.toggle('active', f === 'next');
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

// Theme toggle
const themeBtn = document.getElementById('themeToggle');
const saved = localStorage.getItem('theme');
if (saved === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('theme-dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

document.getElementById('btnAll').addEventListener('click', () => setFilter('all'));
document.getElementById('btnThis').addEventListener('click', () => setFilter('this'));
document.getElementById('btnNext').addEventListener('click', () => setFilter('next'));
document.getElementById('qSearch').addEventListener('input', render);
setFilter('all');

init();
apiBase+'/health/db').catch(() => null);
    document.getElementById('dotDb').className = health ? 'dot is-ok' : 'dot is-err';

    const base = window.location.origin;
    document.getElementById('apiBase').textContent = base;

    await loadAssignments();
  } catch (e) {
    showErr('שגיאה בטעינה: ' + e.message);
    document.getElementById('dotSession').className = 'dot is-err';
  }
}

async function loadAssignments() {
  try {
    const data = await fetchJson((const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + '/api/api';
const API = '';
let allRows = [];
let monthFilter = 'all';

async function init() {
  try {
    const me = await fetchJson('/api/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    document.getElementById('dotApi').className = 'dot is-ok';

    const health = await fetchJson('/api/health/db').catch(() => null);
    document.getElementById('dotDb').className = health ? 'dot is-ok' : 'dot is-err';

    const base = window.location.origin;
    document.getElementById('apiBase').textContent = base;

    await loadAssignments();
  } catch (e) {
    showErr('שגיאה בטעינה: ' + e.message);
    document.getElementById('dotSession').className = 'dot is-err';
  }
}

async function loadAssignments() {
  try {
    const data = await fetchJson('/api/instructors/stats');
    allRows = buildRows(data);
    render();
  } catch (e) {
    showErr('שגיאה בטעינת שיבוצים: ' + e.message);
  }
}

function buildRows(data) {
  const rows = [];
  const byActivity = data.byActivity || [];
  byActivity.forEach(a => {
    rows.push({
      date: a.startDate || '',
      time: a.timeRange || '',
      name: a.activityName || a.name || '',
      instanceId: a.instanceId || '',
      hours: parseFloat(a.totalHours || a.hours || 0),
      status: a.status || 'Approved'
    });
  });
  return rows;
}

function render() {
  const q = document.getElementById('qSearch').value.toLowerCase();
  const now = new Date();
  const monthNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthNext = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;

  const filtered = allRows.filter(r => {
    if (monthFilter === 'this' && !r.date.startsWith(monthNow)) return false;
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
  document.getElementById('btnAll').classList.toggle('active', f === 'all');
  document.getElementById('btnThis').classList.toggle('active', f === 'this');
  document.getElementById('btnNext').classList.toggle('active', f === 'next');
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

// Theme toggle
const themeBtn = document.getElementById('themeToggle');
const saved = localStorage.getItem('theme');
if (saved === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('theme-dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

document.getElementById('btnAll').addEventListener('click', () => setFilter('all'));
document.getElementById('btnThis').addEventListener('click', () => setFilter('this'));
document.getElementById('btnNext').addEventListener('click', () => setFilter('next'));
document.getElementById('qSearch').addEventListener('input', render);
setFilter('all');

init();
apiBase+'/instructors/stats');
    allRows = buildRows(data);
    render();
  } catch (e) {
    showErr('שגיאה בטעינת שיבוצים: ' + e.message);
  }
}

function buildRows(data) {
  const rows = [];
  const byActivity = data.byActivity || [];
  byActivity.forEach(a => {
    rows.push({
      date: a.startDate || '',
      time: a.timeRange || '',
      name: a.activityName || a.name || '',
      instanceId: a.instanceId || '',
      hours: parseFloat(a.totalHours || a.hours || 0),
      status: a.status || 'Approved'
    });
  });
  return rows;
}

function render() {
  const q = document.getElementById('qSearch').value.toLowerCase();
  const now = new Date();
  const monthNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthNext = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;

  const filtered = allRows.filter(r => {
    if (monthFilter === 'this' && !r.date.startsWith(monthNow)) return false;
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
  document.getElementById('btnAll').classList.toggle('active', f === 'all');
  document.getElementById('btnThis').classList.toggle('active', f === 'this');
  document.getElementById('btnNext').classList.toggle('active', f === 'next');
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

// Theme toggle
const themeBtn = document.getElementById('themeToggle');
const saved = localStorage.getItem('theme');
if (saved === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('theme-dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

document.getElementById('btnAll').addEventListener('click', () => setFilter('all'));
document.getElementById('btnThis').addEventListener('click', () => setFilter('this'));
document.getElementById('btnNext').addEventListener('click', () => setFilter('next'));
document.getElementById('qSearch').addEventListener('input', render);
setFilter('all');

init();

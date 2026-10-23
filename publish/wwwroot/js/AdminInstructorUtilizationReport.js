const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + (const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + '/api/api';
let allData = [];

async function init() {
  try {
    const me = await fetchJson('/api/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    const health = await fetchJson('/api/health/db').catch(() => null);
    document.getElementById('dotDb').className = health ? 'dot is-ok' : 'dot is-err';
    await load();
  } catch(e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function load() {
  try {
    allData = await fetchJson('/api/admin/hours-report');
    applyFilters();
  } catch(e) { showErr('שגיאה בטעינה: ' + e.message); }
}

function applyFilters() {
  const q = document.getElementById('searchBox').value.toLowerCase();
  const range = document.getElementById('filterRange').value;
  const now = new Date();

  let data = allData.filter(r => {
    if (q && !(r.instructorName||'').toLowerCase().includes(q)) return false;
    if (range !== 'all') {
      const d = new Date(r.startUtc);
      if (range === 'month' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
      if (range === 'week') { const ws = new Date(); ws.setDate(now.getDate()-now.getDay()); if (d < ws) return false; }
    }
    return true;
  });

  // aggregate by instructor
  const map = {};
  data.forEach(r => {
    const k = r.instructorId;
    if (!map[k]) map[k] = { name: r.instructorName, dept: r.department||'—', courses: new Set(), sessions: 0, hours: 0 };
    if (r.courseId) map[k].courses.add(r.courseId);
    map[k].sessions++;
    map[k].hours += r.hours || 0;
  });

  const rows = Object.values(map).sort((a,b) => b.hours - a.hours);
  const maxHours = rows.length ? rows[0].hours : 1;

  document.getElementById('kpiHours').textContent = data.reduce((s,x)=>s+(x.hours||0),0).toFixed(1);
  document.getElementById('kpiSessions').textContent = data.length;
  document.getElementById('kpiInstructors').textContent = rows.length;

  const tbody = document.getElementById('tblBody');
  tbody.innerHTML = rows.length
    ? rows.map((r,i) => {
        const pct = Math.round((r.hours / maxHours) * 100);
        return `<tr>
          <td>${i+1}</td>
          <td>${r.name}</td>
          <td>${r.dept}</td>
          <td>${r.courses.size}</td>
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
apiBase+'/api';
let allData = [];

async function init() {
  try {
    const me = await fetchJson((const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + '/api/api';
let allData = [];

async function init() {
  try {
    const me = await fetchJson('/api/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    const health = await fetchJson('/api/health/db').catch(() => null);
    document.getElementById('dotDb').className = health ? 'dot is-ok' : 'dot is-err';
    await load();
  } catch(e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function load() {
  try {
    allData = await fetchJson('/api/admin/hours-report');
    applyFilters();
  } catch(e) { showErr('שגיאה בטעינה: ' + e.message); }
}

function applyFilters() {
  const q = document.getElementById('searchBox').value.toLowerCase();
  const range = document.getElementById('filterRange').value;
  const now = new Date();

  let data = allData.filter(r => {
    if (q && !(r.instructorName||'').toLowerCase().includes(q)) return false;
    if (range !== 'all') {
      const d = new Date(r.startUtc);
      if (range === 'month' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
      if (range === 'week') { const ws = new Date(); ws.setDate(now.getDate()-now.getDay()); if (d < ws) return false; }
    }
    return true;
  });

  // aggregate by instructor
  const map = {};
  data.forEach(r => {
    const k = r.instructorId;
    if (!map[k]) map[k] = { name: r.instructorName, dept: r.department||'—', courses: new Set(), sessions: 0, hours: 0 };
    if (r.courseId) map[k].courses.add(r.courseId);
    map[k].sessions++;
    map[k].hours += r.hours || 0;
  });

  const rows = Object.values(map).sort((a,b) => b.hours - a.hours);
  const maxHours = rows.length ? rows[0].hours : 1;

  document.getElementById('kpiHours').textContent = data.reduce((s,x)=>s+(x.hours||0),0).toFixed(1);
  document.getElementById('kpiSessions').textContent = data.length;
  document.getElementById('kpiInstructors').textContent = rows.length;

  const tbody = document.getElementById('tblBody');
  tbody.innerHTML = rows.length
    ? rows.map((r,i) => {
        const pct = Math.round((r.hours / maxHours) * 100);
        return `<tr>
          <td>${i+1}</td>
          <td>${r.name}</td>
          <td>${r.dept}</td>
          <td>${r.courses.size}</td>
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
apiBase+'/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    const health = await fetchJson((const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + '/api/api';
let allData = [];

async function init() {
  try {
    const me = await fetchJson('/api/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    const health = await fetchJson('/api/health/db').catch(() => null);
    document.getElementById('dotDb').className = health ? 'dot is-ok' : 'dot is-err';
    await load();
  } catch(e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function load() {
  try {
    allData = await fetchJson('/api/admin/hours-report');
    applyFilters();
  } catch(e) { showErr('שגיאה בטעינה: ' + e.message); }
}

function applyFilters() {
  const q = document.getElementById('searchBox').value.toLowerCase();
  const range = document.getElementById('filterRange').value;
  const now = new Date();

  let data = allData.filter(r => {
    if (q && !(r.instructorName||'').toLowerCase().includes(q)) return false;
    if (range !== 'all') {
      const d = new Date(r.startUtc);
      if (range === 'month' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
      if (range === 'week') { const ws = new Date(); ws.setDate(now.getDate()-now.getDay()); if (d < ws) return false; }
    }
    return true;
  });

  // aggregate by instructor
  const map = {};
  data.forEach(r => {
    const k = r.instructorId;
    if (!map[k]) map[k] = { name: r.instructorName, dept: r.department||'—', courses: new Set(), sessions: 0, hours: 0 };
    if (r.courseId) map[k].courses.add(r.courseId);
    map[k].sessions++;
    map[k].hours += r.hours || 0;
  });

  const rows = Object.values(map).sort((a,b) => b.hours - a.hours);
  const maxHours = rows.length ? rows[0].hours : 1;

  document.getElementById('kpiHours').textContent = data.reduce((s,x)=>s+(x.hours||0),0).toFixed(1);
  document.getElementById('kpiSessions').textContent = data.length;
  document.getElementById('kpiInstructors').textContent = rows.length;

  const tbody = document.getElementById('tblBody');
  tbody.innerHTML = rows.length
    ? rows.map((r,i) => {
        const pct = Math.round((r.hours / maxHours) * 100);
        return `<tr>
          <td>${i+1}</td>
          <td>${r.name}</td>
          <td>${r.dept}</td>
          <td>${r.courses.size}</td>
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
apiBase+'/health/db').catch(() => null);
    document.getElementById('dotDb').className = health ? 'dot is-ok' : 'dot is-err';
    await load();
  } catch(e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function load() {
  try {
    allData = await fetchJson((const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + '/api/api';
let allData = [];

async function init() {
  try {
    const me = await fetchJson('/api/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    const health = await fetchJson('/api/health/db').catch(() => null);
    document.getElementById('dotDb').className = health ? 'dot is-ok' : 'dot is-err';
    await load();
  } catch(e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function load() {
  try {
    allData = await fetchJson('/api/admin/hours-report');
    applyFilters();
  } catch(e) { showErr('שגיאה בטעינה: ' + e.message); }
}

function applyFilters() {
  const q = document.getElementById('searchBox').value.toLowerCase();
  const range = document.getElementById('filterRange').value;
  const now = new Date();

  let data = allData.filter(r => {
    if (q && !(r.instructorName||'').toLowerCase().includes(q)) return false;
    if (range !== 'all') {
      const d = new Date(r.startUtc);
      if (range === 'month' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
      if (range === 'week') { const ws = new Date(); ws.setDate(now.getDate()-now.getDay()); if (d < ws) return false; }
    }
    return true;
  });

  // aggregate by instructor
  const map = {};
  data.forEach(r => {
    const k = r.instructorId;
    if (!map[k]) map[k] = { name: r.instructorName, dept: r.department||'—', courses: new Set(), sessions: 0, hours: 0 };
    if (r.courseId) map[k].courses.add(r.courseId);
    map[k].sessions++;
    map[k].hours += r.hours || 0;
  });

  const rows = Object.values(map).sort((a,b) => b.hours - a.hours);
  const maxHours = rows.length ? rows[0].hours : 1;

  document.getElementById('kpiHours').textContent = data.reduce((s,x)=>s+(x.hours||0),0).toFixed(1);
  document.getElementById('kpiSessions').textContent = data.length;
  document.getElementById('kpiInstructors').textContent = rows.length;

  const tbody = document.getElementById('tblBody');
  tbody.innerHTML = rows.length
    ? rows.map((r,i) => {
        const pct = Math.round((r.hours / maxHours) * 100);
        return `<tr>
          <td>${i+1}</td>
          <td>${r.name}</td>
          <td>${r.dept}</td>
          <td>${r.courses.size}</td>
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
apiBase+'/admin/hours-report');
    applyFilters();
  } catch(e) { showErr('שגיאה בטעינה: ' + e.message); }
}

function applyFilters() {
  const q = document.getElementById('searchBox').value.toLowerCase();
  const range = document.getElementById('filterRange').value;
  const now = new Date();

  let data = allData.filter(r => {
    if (q && !(r.instructorName||'').toLowerCase().includes(q)) return false;
    if (range !== 'all') {
      const d = new Date(r.startUtc);
      if (range === 'month' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
      if (range === 'week') { const ws = new Date(); ws.setDate(now.getDate()-now.getDay()); if (d < ws) return false; }
    }
    return true;
  });

  // aggregate by instructor
  const map = {};
  data.forEach(r => {
    const k = r.instructorId;
    if (!map[k]) map[k] = { name: r.instructorName, dept: r.department||'—', courses: new Set(), sessions: 0, hours: 0 };
    if (r.courseId) map[k].courses.add(r.courseId);
    map[k].sessions++;
    map[k].hours += r.hours || 0;
  });

  const rows = Object.values(map).sort((a,b) => b.hours - a.hours);
  const maxHours = rows.length ? rows[0].hours : 1;

  document.getElementById('kpiHours').textContent = data.reduce((s,x)=>s+(x.hours||0),0).toFixed(1);
  document.getElementById('kpiSessions').textContent = data.length;
  document.getElementById('kpiInstructors').textContent = rows.length;

  const tbody = document.getElementById('tblBody');
  tbody.innerHTML = rows.length
    ? rows.map((r,i) => {
        const pct = Math.round((r.hours / maxHours) * 100);
        return `<tr>
          <td>${i+1}</td>
          <td>${r.name}</td>
          <td>${r.dept}</td>
          <td>${r.courses.size}</td>
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

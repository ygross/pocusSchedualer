const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + (const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + '/api/api';
async function init() {
  try {
    const me = await fetchJson('/api/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    await loadHealth();
    await loadInstructorStats();
  } catch(e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function loadHealth() {
  try {
    const h = await fetchJson('/api/health/db');
    const ok = h && (h.ok !== false);
    document.getElementById('dotDb').className = ok ? 'dot is-ok' : 'dot is-err';
    document.getElementById('kpiDb').textContent = ok ? '✅ תקין' : '❌ שגיאה';
    document.getElementById('kpiDb').className = 'kpi-val small ' + (ok ? 'ok' : 'err');
    if (h?.dbTime) {
      const t = new Date(h.dbTime).toLocaleTimeString('he-IL');
      document.getElementById('kpiDbTime').textContent = t;
      document.getElementById('dbTime').textContent = t;
    }
  } catch(e) {
    document.getElementById('dotDb').className = 'dot is-err';
    document.getElementById('kpiDb').textContent = '❌ שגיאה';
  }
}

async function loadInstructorStats() {
  try {
    const data = await fetchJson('/api/admin/pending-approvals');
    const pending = Array.isArray(data) ? data.length : 0;
    document.getElementById('kpiPending').textContent = pending;
  } catch(e) {
    document.getElementById('kpiPending').textContent = '—';
  }

  try {
    const instructors = await fetchJson('/api/admin/instructors').catch(() => null);
    if (instructors) {
      const active = instructors.filter(i => i.status === 'Active' || i.isActive).length;
      document.getElementById('kpiTotal').textContent = instructors.length;
      document.getElementById('kpiActive').textContent = active;
    }
  } catch(e) {
    // endpoint may vary — leave defaults
  }
}

function showErr(msg) { const e = document.getElementById('errBox'); if(e){e.textContent=msg;e.style.display='block';} }
async function fetchJson(url) { const r = await fetch(url,{credentials:'include'}); if(!r.ok) throw new Error('API error '+r.status); return r.json(); }

document.getElementById('btnRefresh')?.addEventListener('click', () => { loadHealth(); loadInstructorStats(); });

const themeBtn = document.getElementById('themeToggle');
if (localStorage.getItem('theme') === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn?.addEventListener('click', () => { const d = document.body.classList.toggle('theme-dark'); localStorage.setItem('theme', d?'dark':'light'); });

init();
apiBase+'/api';
async function init() {
  try {
    const me = await fetchJson((const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + '/api/api';
async function init() {
  try {
    const me = await fetchJson('/api/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    await loadHealth();
    await loadInstructorStats();
  } catch(e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function loadHealth() {
  try {
    const h = await fetchJson('/api/health/db');
    const ok = h && (h.ok !== false);
    document.getElementById('dotDb').className = ok ? 'dot is-ok' : 'dot is-err';
    document.getElementById('kpiDb').textContent = ok ? '✅ תקין' : '❌ שגיאה';
    document.getElementById('kpiDb').className = 'kpi-val small ' + (ok ? 'ok' : 'err');
    if (h?.dbTime) {
      const t = new Date(h.dbTime).toLocaleTimeString('he-IL');
      document.getElementById('kpiDbTime').textContent = t;
      document.getElementById('dbTime').textContent = t;
    }
  } catch(e) {
    document.getElementById('dotDb').className = 'dot is-err';
    document.getElementById('kpiDb').textContent = '❌ שגיאה';
  }
}

async function loadInstructorStats() {
  try {
    const data = await fetchJson('/api/admin/pending-approvals');
    const pending = Array.isArray(data) ? data.length : 0;
    document.getElementById('kpiPending').textContent = pending;
  } catch(e) {
    document.getElementById('kpiPending').textContent = '—';
  }

  try {
    const instructors = await fetchJson('/api/admin/instructors').catch(() => null);
    if (instructors) {
      const active = instructors.filter(i => i.status === 'Active' || i.isActive).length;
      document.getElementById('kpiTotal').textContent = instructors.length;
      document.getElementById('kpiActive').textContent = active;
    }
  } catch(e) {
    // endpoint may vary — leave defaults
  }
}

function showErr(msg) { const e = document.getElementById('errBox'); if(e){e.textContent=msg;e.style.display='block';} }
async function fetchJson(url) { const r = await fetch(url,{credentials:'include'}); if(!r.ok) throw new Error('API error '+r.status); return r.json(); }

document.getElementById('btnRefresh')?.addEventListener('click', () => { loadHealth(); loadInstructorStats(); });

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
    await loadHealth();
    await loadInstructorStats();
  } catch(e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function loadHealth() {
  try {
    const h = await fetchJson((const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + '/api/api';
async function init() {
  try {
    const me = await fetchJson('/api/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    await loadHealth();
    await loadInstructorStats();
  } catch(e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function loadHealth() {
  try {
    const h = await fetchJson('/api/health/db');
    const ok = h && (h.ok !== false);
    document.getElementById('dotDb').className = ok ? 'dot is-ok' : 'dot is-err';
    document.getElementById('kpiDb').textContent = ok ? '✅ תקין' : '❌ שגיאה';
    document.getElementById('kpiDb').className = 'kpi-val small ' + (ok ? 'ok' : 'err');
    if (h?.dbTime) {
      const t = new Date(h.dbTime).toLocaleTimeString('he-IL');
      document.getElementById('kpiDbTime').textContent = t;
      document.getElementById('dbTime').textContent = t;
    }
  } catch(e) {
    document.getElementById('dotDb').className = 'dot is-err';
    document.getElementById('kpiDb').textContent = '❌ שגיאה';
  }
}

async function loadInstructorStats() {
  try {
    const data = await fetchJson('/api/admin/pending-approvals');
    const pending = Array.isArray(data) ? data.length : 0;
    document.getElementById('kpiPending').textContent = pending;
  } catch(e) {
    document.getElementById('kpiPending').textContent = '—';
  }

  try {
    const instructors = await fetchJson('/api/admin/instructors').catch(() => null);
    if (instructors) {
      const active = instructors.filter(i => i.status === 'Active' || i.isActive).length;
      document.getElementById('kpiTotal').textContent = instructors.length;
      document.getElementById('kpiActive').textContent = active;
    }
  } catch(e) {
    // endpoint may vary — leave defaults
  }
}

function showErr(msg) { const e = document.getElementById('errBox'); if(e){e.textContent=msg;e.style.display='block';} }
async function fetchJson(url) { const r = await fetch(url,{credentials:'include'}); if(!r.ok) throw new Error('API error '+r.status); return r.json(); }

document.getElementById('btnRefresh')?.addEventListener('click', () => { loadHealth(); loadInstructorStats(); });

const themeBtn = document.getElementById('themeToggle');
if (localStorage.getItem('theme') === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn?.addEventListener('click', () => { const d = document.body.classList.toggle('theme-dark'); localStorage.setItem('theme', d?'dark':'light'); });

init();
apiBase+'/health/db');
    const ok = h && (h.ok !== false);
    document.getElementById('dotDb').className = ok ? 'dot is-ok' : 'dot is-err';
    document.getElementById('kpiDb').textContent = ok ? '✅ תקין' : '❌ שגיאה';
    document.getElementById('kpiDb').className = 'kpi-val small ' + (ok ? 'ok' : 'err');
    if (h?.dbTime) {
      const t = new Date(h.dbTime).toLocaleTimeString('he-IL');
      document.getElementById('kpiDbTime').textContent = t;
      document.getElementById('dbTime').textContent = t;
    }
  } catch(e) {
    document.getElementById('dotDb').className = 'dot is-err';
    document.getElementById('kpiDb').textContent = '❌ שגיאה';
  }
}

async function loadInstructorStats() {
  try {
    const data = await fetchJson((const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + '/api/api';
async function init() {
  try {
    const me = await fetchJson('/api/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    await loadHealth();
    await loadInstructorStats();
  } catch(e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function loadHealth() {
  try {
    const h = await fetchJson('/api/health/db');
    const ok = h && (h.ok !== false);
    document.getElementById('dotDb').className = ok ? 'dot is-ok' : 'dot is-err';
    document.getElementById('kpiDb').textContent = ok ? '✅ תקין' : '❌ שגיאה';
    document.getElementById('kpiDb').className = 'kpi-val small ' + (ok ? 'ok' : 'err');
    if (h?.dbTime) {
      const t = new Date(h.dbTime).toLocaleTimeString('he-IL');
      document.getElementById('kpiDbTime').textContent = t;
      document.getElementById('dbTime').textContent = t;
    }
  } catch(e) {
    document.getElementById('dotDb').className = 'dot is-err';
    document.getElementById('kpiDb').textContent = '❌ שגיאה';
  }
}

async function loadInstructorStats() {
  try {
    const data = await fetchJson('/api/admin/pending-approvals');
    const pending = Array.isArray(data) ? data.length : 0;
    document.getElementById('kpiPending').textContent = pending;
  } catch(e) {
    document.getElementById('kpiPending').textContent = '—';
  }

  try {
    const instructors = await fetchJson('/api/admin/instructors').catch(() => null);
    if (instructors) {
      const active = instructors.filter(i => i.status === 'Active' || i.isActive).length;
      document.getElementById('kpiTotal').textContent = instructors.length;
      document.getElementById('kpiActive').textContent = active;
    }
  } catch(e) {
    // endpoint may vary — leave defaults
  }
}

function showErr(msg) { const e = document.getElementById('errBox'); if(e){e.textContent=msg;e.style.display='block';} }
async function fetchJson(url) { const r = await fetch(url,{credentials:'include'}); if(!r.ok) throw new Error('API error '+r.status); return r.json(); }

document.getElementById('btnRefresh')?.addEventListener('click', () => { loadHealth(); loadInstructorStats(); });

const themeBtn = document.getElementById('themeToggle');
if (localStorage.getItem('theme') === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn?.addEventListener('click', () => { const d = document.body.classList.toggle('theme-dark'); localStorage.setItem('theme', d?'dark':'light'); });

init();
apiBase+'/admin/pending-approvals');
    const pending = Array.isArray(data) ? data.length : 0;
    document.getElementById('kpiPending').textContent = pending;
  } catch(e) {
    document.getElementById('kpiPending').textContent = '—';
  }

  try {
    const instructors = await fetchJson((const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + '/api/api';
async function init() {
  try {
    const me = await fetchJson('/api/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    await loadHealth();
    await loadInstructorStats();
  } catch(e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function loadHealth() {
  try {
    const h = await fetchJson('/api/health/db');
    const ok = h && (h.ok !== false);
    document.getElementById('dotDb').className = ok ? 'dot is-ok' : 'dot is-err';
    document.getElementById('kpiDb').textContent = ok ? '✅ תקין' : '❌ שגיאה';
    document.getElementById('kpiDb').className = 'kpi-val small ' + (ok ? 'ok' : 'err');
    if (h?.dbTime) {
      const t = new Date(h.dbTime).toLocaleTimeString('he-IL');
      document.getElementById('kpiDbTime').textContent = t;
      document.getElementById('dbTime').textContent = t;
    }
  } catch(e) {
    document.getElementById('dotDb').className = 'dot is-err';
    document.getElementById('kpiDb').textContent = '❌ שגיאה';
  }
}

async function loadInstructorStats() {
  try {
    const data = await fetchJson('/api/admin/pending-approvals');
    const pending = Array.isArray(data) ? data.length : 0;
    document.getElementById('kpiPending').textContent = pending;
  } catch(e) {
    document.getElementById('kpiPending').textContent = '—';
  }

  try {
    const instructors = await fetchJson('/api/admin/instructors').catch(() => null);
    if (instructors) {
      const active = instructors.filter(i => i.status === 'Active' || i.isActive).length;
      document.getElementById('kpiTotal').textContent = instructors.length;
      document.getElementById('kpiActive').textContent = active;
    }
  } catch(e) {
    // endpoint may vary — leave defaults
  }
}

function showErr(msg) { const e = document.getElementById('errBox'); if(e){e.textContent=msg;e.style.display='block';} }
async function fetchJson(url) { const r = await fetch(url,{credentials:'include'}); if(!r.ok) throw new Error('API error '+r.status); return r.json(); }

document.getElementById('btnRefresh')?.addEventListener('click', () => { loadHealth(); loadInstructorStats(); });

const themeBtn = document.getElementById('themeToggle');
if (localStorage.getItem('theme') === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn?.addEventListener('click', () => { const d = document.body.classList.toggle('theme-dark'); localStorage.setItem('theme', d?'dark':'light'); });

init();
apiBase+'/admin/instructors').catch(() => null);
    if (instructors) {
      const active = instructors.filter(i => i.status === 'Active' || i.isActive).length;
      document.getElementById('kpiTotal').textContent = instructors.length;
      document.getElementById('kpiActive').textContent = active;
    }
  } catch(e) {
    // endpoint may vary — leave defaults
  }
}

function showErr(msg) { const e = document.getElementById('errBox'); if(e){e.textContent=msg;e.style.display='block';} }
async function fetchJson(url) { const r = await fetch(url,{credentials:'include'}); if(!r.ok) throw new Error('API error '+r.status); return r.json(); }

document.getElementById('btnRefresh')?.addEventListener('click', () => { loadHealth(); loadInstructorStats(); });

const themeBtn = document.getElementById('themeToggle');
if (localStorage.getItem('theme') === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn?.addEventListener('click', () => { const d = document.body.classList.toggle('theme-dark'); localStorage.setItem('theme', d?'dark':'light'); });

init();

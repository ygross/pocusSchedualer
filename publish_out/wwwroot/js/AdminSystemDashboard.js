const _dir = window.location.pathname.replace(/\/[^\/]*$/, "");
const API_BASE = `${_dir}/api/api`;
async function init() {
  try {
    const me = await fetchJson(`${API_BASE}/me`);
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    await loadHealth();
    await loadStats();
  } catch(e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function loadHealth() {
  try {
    const h = await fetchJson(`${API_BASE}/health/db`);
    const ok = h && (h.ok !== false);
    document.getElementById('dotDb').className = ok ? 'dot is-ok' : 'dot is-err';
    document.getElementById('kpiDb').textContent = ok ? '✅ תקין' : '❌ שגיאה';
    if (document.getElementById('kpiDb').className !== undefined)
      document.getElementById('kpiDb').className = 'kpi-val small ' + (ok ? 'ok' : 'err');
    if (h?.dbTime) {
      const t = new Date(h.dbTime).toLocaleTimeString('he-IL');
      const kpiDbTime = document.getElementById('kpiDbTime');
      const dbTime = document.getElementById('dbTime');
      if (kpiDbTime) kpiDbTime.textContent = t;
      if (dbTime) dbTime.textContent = t;
    }
  } catch(e) {
    document.getElementById('dotDb').className = 'dot is-err';
    document.getElementById('kpiDb').textContent = '❌ שגיאה';
  }
}

async function loadStats() {
  // Pending approvals
  try {
    const data = await fetchJson(`${API_BASE}/admin/pending-approvals`);
    const el = document.getElementById('kpiPending');
    if (el) el.textContent = Array.isArray(data) ? data.length : 0;
  } catch { }

  // Instructors
  try {
    const instructors = await fetchJson(`${API_BASE}/admin/instructors`);
    if (instructors) {
      const active = instructors.filter(i => (i.status || i.Status || '').toLowerCase() === 'active' || i.isActive).length;
      const elTotal = document.getElementById('kpiTotal');
      const elActive = document.getElementById('kpiActive');
      if (elTotal) elTotal.textContent = instructors.length;
      if (elActive) elActive.textContent = active;
    }
  } catch { }

  // Courses
  try {
    const courses = await fetchJson(`${API_BASE}/courses`);
    const elCourses = document.getElementById('kpiCourses');
    if (elCourses && courses) elCourses.textContent = Array.isArray(courses) ? courses.length : (courses.total ?? 0);
  } catch { }

  // Activity types
  try {
    const types = await fetchJson(`${API_BASE}/activity-types`);
    const elTypes = document.getElementById('kpiActivityTypes');
    if (elTypes && types) elTypes.textContent = Array.isArray(types) ? types.length : 0;
  } catch { }
}

function showErr(msg) {
  const e = document.getElementById('errBox');
  if (e) { e.textContent = msg; e.style.display = 'block'; }
}

async function fetchJson(url) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error('API error ' + r.status);
  return r.json();
}

document.getElementById('btnRefresh')?.addEventListener('click', () => { loadHealth(); loadStats(); });

const themeBtn = document.getElementById('themeToggle');
if (localStorage.getItem('theme') === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn?.addEventListener('click', () => {
  const d = document.body.classList.toggle('theme-dark');
  localStorage.setItem('theme', d ? 'dark' : 'light');
});

init();

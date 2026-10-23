const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + (const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + '/api/api';
async function init() {
  try {
    const me = await fetchJson('/api/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    document.getElementById('dotApi').className = 'dot is-ok';

    // set default month to current
    const now = new Date();
    document.getElementById('selMonth').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    await loadCourses();
  } catch (e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function loadCourses() {
  try {
    const data = await fetchJson('/api/lead/status');
    const courses = data.courses || [];
    const sel = document.getElementById('selCourse');
    sel.innerHTML = courses.length
      ? courses.map(c => `<option value="${c.courseId}">${c.courseName}</option>`).join('')
      : '<option value="">אין קורסים</option>';
    if (courses.length) loadDashboard();
  } catch (e) {
    showErr('שגיאה בטעינת קורסים: ' + e.message);
  }
}

async function loadDashboard() {
  const courseId = document.getElementById('selCourse').value;
  const month = document.getElementById('selMonth').value;
  if (!courseId) return;
  try {
    const params = new URLSearchParams({ courseId, month });
    const data = await fetchJson(`/api/lead/status?${params}`);
    const s = data.summary;
    if (s) {
      document.getElementById('kpiTotal').textContent = s.totalInstances ?? '—';
      document.getElementById('kpiFull').textContent = s.fullyStaffed ?? '—';
      document.getElementById('kpiPartial').textContent = s.partiallyStaffed ?? '—';
      document.getElementById('kpiNone').textContent = s.unstaffed ?? '—';
    }
    renderInstances(data.instances || []);
  } catch (e) {
    showErr('שגיאה בטעינת דשבורד: ' + e.message);
  }
}

function renderInstances(rows) {
  const tbody = document.getElementById('tblInstances');
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">אין מופעים</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => {
    const missing = Math.max(0, (r.requiredInstructors || 0) - (r.assignedCount || 0));
    let cls = 'none', lbl = 'ללא שיבוץ';
    if (r.isCancelled) { cls = ''; lbl = 'בוטל'; }
    else if (missing === 0) { cls = 'full'; lbl = 'מאויש'; }
    else if ((r.assignedCount || 0) > 0) { cls = 'partial'; lbl = 'חלקי'; }
    return `<tr>
      <td>${fmtDate(r.startUtc)}</td>
      <td>${fmtTime(r.startUtc)}–${fmtTime(r.endUtc)}</td>
      <td>${r.requiredInstructors ?? '—'}</td>
      <td>${r.assignedCount ?? 0}</td>
      <td>${missing}</td>
      <td><span class="badge ${cls}">${lbl}</span></td>
    </tr>`;
  }).join('');
}

function fmtDate(u) { return u ? new Date(u).toLocaleDateString('he-IL') : '—'; }
function fmtTime(u) { return u ? new Date(u).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}) : '—'; }
function showErr(msg) { const e = document.getElementById('msgErr'); if(e){e.textContent=msg;e.style.display='block';} }
async function fetchJson(url) { const r = await fetch(url,{credentials:'include'}); if(!r.ok) throw new Error('API error '+r.status); return r.json(); }

document.getElementById('selCourse').addEventListener('change', loadDashboard);
document.getElementById('selMonth').addEventListener('change', loadDashboard);

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
    document.getElementById('dotApi').className = 'dot is-ok';

    // set default month to current
    const now = new Date();
    document.getElementById('selMonth').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    await loadCourses();
  } catch (e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function loadCourses() {
  try {
    const data = await fetchJson('/api/lead/status');
    const courses = data.courses || [];
    const sel = document.getElementById('selCourse');
    sel.innerHTML = courses.length
      ? courses.map(c => `<option value="${c.courseId}">${c.courseName}</option>`).join('')
      : '<option value="">אין קורסים</option>';
    if (courses.length) loadDashboard();
  } catch (e) {
    showErr('שגיאה בטעינת קורסים: ' + e.message);
  }
}

async function loadDashboard() {
  const courseId = document.getElementById('selCourse').value;
  const month = document.getElementById('selMonth').value;
  if (!courseId) return;
  try {
    const params = new URLSearchParams({ courseId, month });
    const data = await fetchJson(`/api/lead/status?${params}`);
    const s = data.summary;
    if (s) {
      document.getElementById('kpiTotal').textContent = s.totalInstances ?? '—';
      document.getElementById('kpiFull').textContent = s.fullyStaffed ?? '—';
      document.getElementById('kpiPartial').textContent = s.partiallyStaffed ?? '—';
      document.getElementById('kpiNone').textContent = s.unstaffed ?? '—';
    }
    renderInstances(data.instances || []);
  } catch (e) {
    showErr('שגיאה בטעינת דשבורד: ' + e.message);
  }
}

function renderInstances(rows) {
  const tbody = document.getElementById('tblInstances');
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">אין מופעים</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => {
    const missing = Math.max(0, (r.requiredInstructors || 0) - (r.assignedCount || 0));
    let cls = 'none', lbl = 'ללא שיבוץ';
    if (r.isCancelled) { cls = ''; lbl = 'בוטל'; }
    else if (missing === 0) { cls = 'full'; lbl = 'מאויש'; }
    else if ((r.assignedCount || 0) > 0) { cls = 'partial'; lbl = 'חלקי'; }
    return `<tr>
      <td>${fmtDate(r.startUtc)}</td>
      <td>${fmtTime(r.startUtc)}–${fmtTime(r.endUtc)}</td>
      <td>${r.requiredInstructors ?? '—'}</td>
      <td>${r.assignedCount ?? 0}</td>
      <td>${missing}</td>
      <td><span class="badge ${cls}">${lbl}</span></td>
    </tr>`;
  }).join('');
}

function fmtDate(u) { return u ? new Date(u).toLocaleDateString('he-IL') : '—'; }
function fmtTime(u) { return u ? new Date(u).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}) : '—'; }
function showErr(msg) { const e = document.getElementById('msgErr'); if(e){e.textContent=msg;e.style.display='block';} }
async function fetchJson(url) { const r = await fetch(url,{credentials:'include'}); if(!r.ok) throw new Error('API error '+r.status); return r.json(); }

document.getElementById('selCourse').addEventListener('change', loadDashboard);
document.getElementById('selMonth').addEventListener('change', loadDashboard);

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
    document.getElementById('dotApi').className = 'dot is-ok';

    // set default month to current
    const now = new Date();
    document.getElementById('selMonth').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    await loadCourses();
  } catch (e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function loadCourses() {
  try {
    const data = await fetchJson((const _apiBase = window.location.pathname.replace(/\/[^\/]*$/, '') + '/api/api';
async function init() {
  try {
    const me = await fetchJson('/api/me');
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    document.getElementById('dotApi').className = 'dot is-ok';

    // set default month to current
    const now = new Date();
    document.getElementById('selMonth').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    await loadCourses();
  } catch (e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function loadCourses() {
  try {
    const data = await fetchJson('/api/lead/status');
    const courses = data.courses || [];
    const sel = document.getElementById('selCourse');
    sel.innerHTML = courses.length
      ? courses.map(c => `<option value="${c.courseId}">${c.courseName}</option>`).join('')
      : '<option value="">אין קורסים</option>';
    if (courses.length) loadDashboard();
  } catch (e) {
    showErr('שגיאה בטעינת קורסים: ' + e.message);
  }
}

async function loadDashboard() {
  const courseId = document.getElementById('selCourse').value;
  const month = document.getElementById('selMonth').value;
  if (!courseId) return;
  try {
    const params = new URLSearchParams({ courseId, month });
    const data = await fetchJson(`/api/lead/status?${params}`);
    const s = data.summary;
    if (s) {
      document.getElementById('kpiTotal').textContent = s.totalInstances ?? '—';
      document.getElementById('kpiFull').textContent = s.fullyStaffed ?? '—';
      document.getElementById('kpiPartial').textContent = s.partiallyStaffed ?? '—';
      document.getElementById('kpiNone').textContent = s.unstaffed ?? '—';
    }
    renderInstances(data.instances || []);
  } catch (e) {
    showErr('שגיאה בטעינת דשבורד: ' + e.message);
  }
}

function renderInstances(rows) {
  const tbody = document.getElementById('tblInstances');
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">אין מופעים</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => {
    const missing = Math.max(0, (r.requiredInstructors || 0) - (r.assignedCount || 0));
    let cls = 'none', lbl = 'ללא שיבוץ';
    if (r.isCancelled) { cls = ''; lbl = 'בוטל'; }
    else if (missing === 0) { cls = 'full'; lbl = 'מאויש'; }
    else if ((r.assignedCount || 0) > 0) { cls = 'partial'; lbl = 'חלקי'; }
    return `<tr>
      <td>${fmtDate(r.startUtc)}</td>
      <td>${fmtTime(r.startUtc)}–${fmtTime(r.endUtc)}</td>
      <td>${r.requiredInstructors ?? '—'}</td>
      <td>${r.assignedCount ?? 0}</td>
      <td>${missing}</td>
      <td><span class="badge ${cls}">${lbl}</span></td>
    </tr>`;
  }).join('');
}

function fmtDate(u) { return u ? new Date(u).toLocaleDateString('he-IL') : '—'; }
function fmtTime(u) { return u ? new Date(u).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}) : '—'; }
function showErr(msg) { const e = document.getElementById('msgErr'); if(e){e.textContent=msg;e.style.display='block';} }
async function fetchJson(url) { const r = await fetch(url,{credentials:'include'}); if(!r.ok) throw new Error('API error '+r.status); return r.json(); }

document.getElementById('selCourse').addEventListener('change', loadDashboard);
document.getElementById('selMonth').addEventListener('change', loadDashboard);

const themeBtn = document.getElementById('themeToggle');
if (localStorage.getItem('theme') === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn?.addEventListener('click', () => { const d = document.body.classList.toggle('theme-dark'); localStorage.setItem('theme', d?'dark':'light'); });

init();
apiBase+'/lead/status');
    const courses = data.courses || [];
    const sel = document.getElementById('selCourse');
    sel.innerHTML = courses.length
      ? courses.map(c => `<option value="${c.courseId}">${c.courseName}</option>`).join('')
      : '<option value="">אין קורסים</option>';
    if (courses.length) loadDashboard();
  } catch (e) {
    showErr('שגיאה בטעינת קורסים: ' + e.message);
  }
}

async function loadDashboard() {
  const courseId = document.getElementById('selCourse').value;
  const month = document.getElementById('selMonth').value;
  if (!courseId) return;
  try {
    const params = new URLSearchParams({ courseId, month });
    const data = await fetchJson(`/api/lead/status?${params}`);
    const s = data.summary;
    if (s) {
      document.getElementById('kpiTotal').textContent = s.totalInstances ?? '—';
      document.getElementById('kpiFull').textContent = s.fullyStaffed ?? '—';
      document.getElementById('kpiPartial').textContent = s.partiallyStaffed ?? '—';
      document.getElementById('kpiNone').textContent = s.unstaffed ?? '—';
    }
    renderInstances(data.instances || []);
  } catch (e) {
    showErr('שגיאה בטעינת דשבורד: ' + e.message);
  }
}

function renderInstances(rows) {
  const tbody = document.getElementById('tblInstances');
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">אין מופעים</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => {
    const missing = Math.max(0, (r.requiredInstructors || 0) - (r.assignedCount || 0));
    let cls = 'none', lbl = 'ללא שיבוץ';
    if (r.isCancelled) { cls = ''; lbl = 'בוטל'; }
    else if (missing === 0) { cls = 'full'; lbl = 'מאויש'; }
    else if ((r.assignedCount || 0) > 0) { cls = 'partial'; lbl = 'חלקי'; }
    return `<tr>
      <td>${fmtDate(r.startUtc)}</td>
      <td>${fmtTime(r.startUtc)}–${fmtTime(r.endUtc)}</td>
      <td>${r.requiredInstructors ?? '—'}</td>
      <td>${r.assignedCount ?? 0}</td>
      <td>${missing}</td>
      <td><span class="badge ${cls}">${lbl}</span></td>
    </tr>`;
  }).join('');
}

function fmtDate(u) { return u ? new Date(u).toLocaleDateString('he-IL') : '—'; }
function fmtTime(u) { return u ? new Date(u).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}) : '—'; }
function showErr(msg) { const e = document.getElementById('msgErr'); if(e){e.textContent=msg;e.style.display='block';} }
async function fetchJson(url) { const r = await fetch(url,{credentials:'include'}); if(!r.ok) throw new Error('API error '+r.status); return r.json(); }

document.getElementById('selCourse').addEventListener('change', loadDashboard);
document.getElementById('selMonth').addEventListener('change', loadDashboard);

const themeBtn = document.getElementById('themeToggle');
if (localStorage.getItem('theme') === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn?.addEventListener('click', () => { const d = document.body.classList.toggle('theme-dark'); localStorage.setItem('theme', d?'dark':'light'); });

init();

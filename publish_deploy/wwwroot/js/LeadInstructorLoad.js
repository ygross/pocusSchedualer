const _dir = window.location.pathname.replace(/\/[^\/]*$/, "");
const API_BASE = `${_dir}/api/api`;

async function init() {
  try {
    const me = await fetchJson(`${API_BASE}/me`);
    document.getElementById('meName').textContent = me.fullName || me.email || '—';
    document.getElementById('meRole').textContent = me.roleName || me.role || '—';
    document.getElementById('otpRoleInline').textContent = me.roleName || me.role || '—';
    document.getElementById('dotSession').className = 'dot is-ok';
    document.getElementById('dotApi').className = 'dot is-ok';

    // Default: last calendar month
    const now = new Date();
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    document.getElementById('selMonth').value = `${lm.getFullYear()}-${String(lm.getMonth()+1).padStart(2,'0')}`;

    await loadCourses();
  } catch(e) {
    document.getElementById('dotSession').className = 'dot is-err';
    showErr('שגיאה: ' + e.message);
  }
}

async function loadCourses() {
  try {
    const data = await fetchJson(`${API_BASE}/lead/status`);
    const courses = data.courses || [];
    const sel = document.getElementById('selCourse');
    sel.innerHTML = courses.length
      ? courses.map(c => `<option value="${c.courseId}">${c.courseName}</option>`).join('')
      : '<option value="">אין קורסים</option>';
    if (courses.length) loadLoad();
  } catch(e) { showErr('שגיאה: ' + e.message); }
}

async function loadLoad() {
  const courseId = document.getElementById('selCourse').value;
  const month = document.getElementById('selMonth').value;
  if (!courseId) return;
  try {
    const params = new URLSearchParams({ courseId, month });
    const data = await fetchJson(`${API_BASE}/lead/status?${params}`);
    renderTable(data.fairness || []);
  } catch(e) { showErr('שגיאה בטעינת נתונים: ' + e.message); }
}

function renderTable(rows) {
  const tbody = document.getElementById('tblBody');
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">אין נתונים</td></tr>'; return; }
  const maxTotal = Math.max(...rows.map(r => r.totalAssignments || 0), 1);
  tbody.innerHTML = rows.map((r, i) => {
    const pct = Math.round(((r.totalAssignments || 0) / maxTotal) * 100);
    return `<tr>
      <td>${r.instructorName || '—'}</td>
      <td>${r.monthAssignments ?? '—'}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span>${r.totalAssignments ?? '—'}</span>
          <div class="bar-wrap"><div class="bar-fill" style="width:${pct}%"></div></div>
        </div>
      </td>
      <td>${typeof r.totalHours === 'number' ? r.totalHours.toFixed(1) : '—'}</td>
      <td>${i + 1}</td>
    </tr>`;
  }).join('');
}

function showErr(msg) { const e = document.getElementById('msgErr'); if(e){e.textContent=msg;e.style.display='block';} }
async function fetchJson(url) { const r = await fetch(url,{credentials:'include'}); if(!r.ok) throw new Error('API error '+r.status); return r.json(); }

document.getElementById('selCourse').addEventListener('change', loadLoad);
document.getElementById('selMonth').addEventListener('change', loadLoad);

const themeBtn = document.getElementById('themeToggle');
if (localStorage.getItem('theme') === 'light') document.body.classList.remove('theme-dark');
else document.body.classList.add('theme-dark');
themeBtn?.addEventListener('click', () => { const d = document.body.classList.toggle('theme-dark'); localStorage.setItem('theme', d?'dark':'light'); });

init();

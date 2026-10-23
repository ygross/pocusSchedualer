'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════
let checklists  = [];
let courses     = [];
let selectedId  = null;   // currently-open checklist id
let editingId   = null;   // id being edited in modal (null = new)
let assigningId = null;   // checklist id for assign-course modal

// ═══════════════════════════════════════════════════════════════════════════
// DOM helpers
// ═══════════════════════════════════════════════════════════════════════════
const $  = id => document.getElementById(id);
const esc = s  => (s ?? '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function setMsg(id, text, type = 'info') {
  const el = $(id);
  if (!el) return;
  el.className = 'msg ' + type;
  el.textContent = text;
  el.style.display = text ? 'block' : 'none';
}

// ═══════════════════════════════════════════════════════════════════════════
// Boot
// ═══════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initUserCard();
  await checkAuth();
  await loadCourseList();
  await loadChecklists();
});

// ── Auth / user info ────────────────────────────────────────────────────────
async function checkAuth() {
  try {
    const r = await fetch('/api/auth/me');
    if (r.status === 401) { location.href = '/app.html'; return; }
    const d = await r.json();
    $('meName').textContent    = d.fullName || d.email || '?';
    $('meRole').textContent    = d.role || '?';
    $('otpRoleInline').textContent = d.role || '?';
    $('dotSession').className  = 'dot is-ok';
    const admin = ['Admin','SystemAdmin','CourseManager'].includes(d.role);
    $('dotAdmin').className    = admin ? 'dot is-ok' : 'dot is-err';
    if (!admin) { location.href = '/app.html'; }
  } catch { setMsg('pageMsg','שגיאה בבדיקת הרשאות','err'); }
}

async function loadCourseList() {
  try {
    const r = await fetch('/api/admin/courses-admin');
    if (r.ok) courses = await r.json();
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// Load & render checklists
// ═══════════════════════════════════════════════════════════════════════════
async function loadChecklists() {
  try {
    const r = await fetch('/api/admin/checklists');
    if (!r.ok) { setMsg('pageMsg', 'שגיאה בטעינת צ׳קליסטים', 'err'); return; }
    checklists = await r.json();
    renderGrid();
    if (selectedId) openDetail(selectedId);  // re-open if one was selected
  } catch (e) {
    setMsg('pageMsg', 'שגיאת רשת: ' + e.message, 'err');
  }
}

function renderGrid() {
  const grid = $('clGrid');
  if (!checklists.length) {
    grid.innerHTML = `<div class="empty"><div class="empty-icon">📋</div>
      <div class="empty-text">אין צ׳קליסטים עדיין. לחץ "צ׳קליסט חדש" ליצירה.</div></div>`;
    return;
  }
  grid.innerHTML = checklists.map(cl => `
    <div class="cl-card ${cl.checklistId === selectedId ? 'selected' : ''}"
         id="clcard-${cl.checklistId}"
         onclick="toggleDetail(${cl.checklistId})">
      <div class="cl-card-title">${esc(cl.title)}</div>
      <div class="cl-card-desc">${esc(cl.description || '')}</div>
      <div class="cl-card-meta">
        <span class="badge badge-blue">📌 ${cl.itemCount} סעיפים</span>
        <span class="badge badge-green">📚 ${cl.courseCount} קורסים</span>
      </div>
      <div class="cl-card-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-sm" onclick="openEditModal(${cl.checklistId})">✏️ עריכה</button>
        <button class="btn btn-green btn-sm"  onclick="openAssignModal(${cl.checklistId})">＋ שייך לקורס</button>
        <button class="btn btn-danger btn-sm" onclick="deleteChecklist(${cl.checklistId})">🗑️ מחק</button>
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// Detail panel
// ═══════════════════════════════════════════════════════════════════════════
async function toggleDetail(id) {
  if (selectedId === id) {
    selectedId = null;
    $('detailPanel').style.display = 'none';
    renderGrid();
    return;
  }
  selectedId = id;
  renderGrid();
  await openDetail(id);
}

async function openDetail(id) {
  const panel = $('detailPanel');
  panel.innerHTML = '<div style="padding:20px;color:var(--muted)">טוען…</div>';
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const r = await fetch(`/api/admin/checklists/${id}`);
    if (!r.ok) { panel.innerHTML = '<div class="empty">שגיאה בטעינת פרטים</div>'; return; }
    const cl = await r.json();
    renderDetail(cl);
  } catch (e) {
    panel.innerHTML = `<div class="empty">שגיאה: ${esc(e.message)}</div>`;
  }
}

function renderDetail(cl) {
  const panel = $('detailPanel');

  // ── Items ────────────────────────────────────────────────────────────────
  const itemsHtml = cl.items.length
    ? cl.items.map(it => `
      <div class="item-row" id="itemrow-${it.itemId}">
        <span class="item-row-text">${esc(it.itemText)}</span>
        <button class="btn btn-ghost btn-sm" onclick="editItem(${cl.checklistId},${it.itemId},'${esc(it.itemText)}',${it.sortOrder})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteItem(${cl.checklistId},${it.itemId})">✕</button>
      </div>`).join('')
    : '<div style="color:var(--muted);font-size:13px">אין סעיפים עדיין.</div>';

  // ── Courses progress ─────────────────────────────────────────────────────
  const coursesHtml = cl.courses.length
    ? cl.courses.map(co => {
        const pct = co.totalItems ? Math.round(co.checkedItems / co.totalItems * 100) : 0;
        return `
          <div class="course-progress-card" id="cpcard-${co.linkId}">
            <div class="cp-header">
              <span class="cp-course-name">📚 ${esc(co.courseName)}</span>
              <div style="display:flex;align-items:center;gap:8px;flex:1;justify-content:flex-end">
                <div class="progress-bar-wrap">
                  <div class="progress-bar-fill" style="width:${pct}%"></div>
                </div>
                <span class="cp-pct">${co.checkedItems}/${co.totalItems} (${pct}%)</span>
                <button class="btn btn-sm btn-ghost"
                  onclick="loadProgress(${cl.checklistId},${co.linkId})">⟳</button>
                <button class="btn btn-sm btn-danger"
                  onclick="unassignCourse(${cl.checklistId},${co.linkId})">✕ הסר</button>
              </div>
            </div>
            <div class="cp-items" id="cpitems-${co.linkId}">
              <div style="color:var(--muted);font-size:12px">לחץ ⟳ לטעינת פריטים</div>
            </div>
          </div>`;
      }).join('')
    : '<div style="color:var(--muted);font-size:13px">לא משויך לאף קורס עדיין.</div>';

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <div style="font-size:18px;font-weight:900">${esc(cl.title)}</div>
        ${cl.description ? `<div style="font-size:13px;color:var(--muted);margin-top:4px">${esc(cl.description)}</div>` : ''}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="openEditModal(${cl.checklistId})">✏️ ערוך</button>
        <button class="btn btn-green btn-sm"  onclick="openAssignModal(${cl.checklistId})">＋ שייך לקורס</button>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">📌 סעיפי הצ׳קליסט</div>
      <div class="item-list" id="itemList-${cl.checklistId}">${itemsHtml}</div>
      <div class="item-add-row" style="margin-top:10px">
        <input id="newItemText-${cl.checklistId}" type="text" placeholder="הוסף סעיף חדש…"
               onkeydown="if(event.key==='Enter') addItem(${cl.checklistId})" />
        <button class="btn btn-primary btn-sm" onclick="addItem(${cl.checklistId})">＋ הוסף</button>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">📚 מעקב ביצוע לפי קורס</div>
      <div id="coursesList-${cl.checklistId}">${coursesHtml}</div>
    </div>`;

  // Auto-load progress for assigned courses (up to first 5)
  cl.courses.slice(0, 5).forEach(co => loadProgress(cl.checklistId, co.linkId));
}

// ═══════════════════════════════════════════════════════════════════════════
// Items CRUD
// ═══════════════════════════════════════════════════════════════════════════
async function addItem(checklistId) {
  const inp = $(`newItemText-${checklistId}`);
  const text = inp.value.trim();
  if (!text) return;

  const listEl = $(`itemList-${checklistId}`);
  const currentCount = listEl?.querySelectorAll('.item-row').length ?? 0;

  try {
    const r = await fetch(`/api/admin/checklists/${checklistId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemText: text, sortOrder: currentCount * 10 })
    });
    if (!r.ok) { setMsg('pageMsg','שגיאה בהוספת סעיף','err'); return; }
    inp.value = '';
    await openDetail(checklistId);   // re-render detail
    await loadChecklists();
  } catch (e) { setMsg('pageMsg', e.message, 'err'); }
}

async function editItem(checklistId, itemId, currentText, sortOrder) {
  const newText = prompt('ערוך סעיף:', currentText);
  if (!newText || newText.trim() === currentText) return;

  try {
    const r = await fetch(`/api/admin/checklists/${checklistId}/items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemText: newText.trim(), sortOrder })
    });
    if (!r.ok) { setMsg('pageMsg','שגיאה בעדכון סעיף','err'); return; }
    await openDetail(checklistId);
  } catch (e) { setMsg('pageMsg', e.message, 'err'); }
}

async function deleteItem(checklistId, itemId) {
  if (!confirm('למחוק סעיף זה?')) return;
  try {
    const r = await fetch(`/api/admin/checklists/${checklistId}/items/${itemId}`,
      { method: 'DELETE' });
    if (!r.ok) { setMsg('pageMsg','שגיאה במחיקת סעיף','err'); return; }
    await openDetail(checklistId);
    await loadChecklists();
  } catch (e) { setMsg('pageMsg', e.message, 'err'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// Progress
// ═══════════════════════════════════════════════════════════════════════════
async function loadProgress(checklistId, linkId) {
  const container = $(`cpitems-${linkId}`);
  if (!container) return;
  container.innerHTML = '<div style="color:var(--muted);font-size:12px">טוען…</div>';

  try {
    const r = await fetch(`/api/admin/checklists/links/${linkId}/progress`);
    if (!r.ok) { container.innerHTML = '<div style="color:var(--red)">שגיאה</div>'; return; }
    const items = await r.json();
    if (!items.length) {
      container.innerHTML = '<div style="color:var(--muted);font-size:12px">אין סעיפים בצ׳קליסט זה.</div>';
      return;
    }
    container.innerHTML = items.map(it => `
      <div class="cp-item" onclick="toggleItem(${checklistId},${linkId},${it.itemId},this)">
        <input type="checkbox" ${it.isChecked ? 'checked' : ''}
               onclick="event.stopPropagation();toggleItem(${checklistId},${linkId},${it.itemId},this.parentElement)" />
        <span class="cp-item-text ${it.isChecked ? 'checked' : ''}">${esc(it.itemText)}</span>
        ${it.isChecked && it.checkedByName ? `<span class="cp-item-by">✓ ${esc(it.checkedByName)}</span>` : ''}
      </div>`).join('');

    // refresh the progress bar in the card header
    const card = $(`cpcard-${linkId}`);
    if (card) {
      const total   = items.length;
      const checked = items.filter(x => x.isChecked).length;
      const pct     = total ? Math.round(checked / total * 100) : 0;
      const bar  = card.querySelector('.progress-bar-fill');
      const pctEl = card.querySelector('.cp-pct');
      if (bar)   bar.style.width = pct + '%';
      if (pctEl) pctEl.textContent = `${checked}/${total} (${pct}%)`;
    }
  } catch (e) {
    container.innerHTML = `<div style="color:var(--red)">${esc(e.message)}</div>`;
  }
}

async function toggleItem(checklistId, linkId, itemId, rowEl) {
  const cb = rowEl.querySelector('input[type=checkbox]');
  const newChecked = cb.checked;

  try {
    const r = await fetch(`/api/admin/checklists/links/${linkId}/progress/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isChecked: newChecked })
    });
    if (!r.ok) { cb.checked = !newChecked; return; }
    // refresh progress items
    await loadProgress(checklistId, linkId);
  } catch {
    cb.checked = !newChecked;   // rollback
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Assign checklist to course
// ═══════════════════════════════════════════════════════════════════════════
function openAssignModal(checklistId) {
  assigningId = checklistId;
  const sel = $('assignCourseSelect');
  sel.innerHTML = courses.length
    ? courses.map(c => `<option value="${c.courseId}">${esc(c.courseName)}</option>`).join('')
    : '<option value="">אין קורסים זמינים</option>';
  setMsg('assignMsg', '');
  $('assignModal').classList.add('open');
}

function closeAssignModal() {
  $('assignModal').classList.remove('open');
  assigningId = null;
}

async function doAssign() {
  const courseId = +$('assignCourseSelect').value;
  if (!courseId || !assigningId) return;

  try {
    const r = await fetch(`/api/admin/checklists/${assigningId}/courses/${courseId}`,
      { method: 'POST' });
    const d = await r.json();
    if (!d.ok) { setMsg('assignMsg', d.error || 'שגיאה', 'err'); return; }
    closeAssignModal();
    setMsg('pageMsg', 'הצ׳קליסט שויך לקורס בהצלחה ✅', 'ok');
    setTimeout(() => setMsg('pageMsg',''), 4000);
    await loadChecklists();
    if (selectedId === assigningId) await openDetail(assigningId);
  } catch (e) { setMsg('assignMsg', e.message, 'err'); }
}

async function unassignCourse(checklistId, linkId) {
  if (!confirm('להסיר שיוך קורס זה?')) return;
  try {
    const r = await fetch(`/api/admin/checklists/links/${linkId}`, { method: 'DELETE' });
    if (!r.ok) { setMsg('pageMsg','שגיאה בהסרת שיוך','err'); return; }
    await openDetail(checklistId);
    await loadChecklists();
  } catch (e) { setMsg('pageMsg', e.message, 'err'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// Create / Edit modal
// ═══════════════════════════════════════════════════════════════════════════
function openCreateModal() {
  editingId = null;
  $('clModalTitle').textContent = 'צ׳קליסט חדש';
  $('clTitle').value = '';
  $('clDesc').value  = '';
  setMsg('clModalMsg', '');
  $('clModal').classList.add('open');
  setTimeout(() => $('clTitle').focus(), 80);
}

function openEditModal(id) {
  const cl = checklists.find(c => c.checklistId === id);
  if (!cl) return;
  editingId = id;
  $('clModalTitle').textContent = 'עריכת צ׳קליסט';
  $('clTitle').value = cl.title;
  $('clDesc').value  = cl.description || '';
  setMsg('clModalMsg', '');
  $('clModal').classList.add('open');
  setTimeout(() => $('clTitle').focus(), 80);
}

function closeClModal() {
  $('clModal').classList.remove('open');
  editingId = null;
}

async function saveChecklist() {
  const title = $('clTitle').value.trim();
  const desc  = $('clDesc').value.trim();
  if (!title) { setMsg('clModalMsg','כותרת שדה חובה','err'); return; }

  const url    = editingId ? `/api/admin/checklists/${editingId}` : '/api/admin/checklists';
  const method = editingId ? 'PUT' : 'POST';

  try {
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: desc || null })
    });
    const d = await r.json();
    if (!d.ok) { setMsg('clModalMsg', d.error || 'שגיאה', 'err'); return; }

    const successText = editingId ? 'הצ׳קליסט עודכן ✅' : 'הצ׳קליסט נוצר ✅';
    closeClModal();
    await loadChecklists();
    setMsg('pageMsg', successText, 'ok');
    setTimeout(() => setMsg('pageMsg',''), 4000);

    if (!editingId && d.checklistId) {
      selectedId = d.checklistId;
      await openDetail(d.checklistId);
    }
  } catch (e) { setMsg('clModalMsg', e.message, 'err'); }
}

async function deleteChecklist(id) {
  const cl = checklists.find(c => c.checklistId === id);
  if (!confirm(`למחוק את הצ׳קליסט "${cl?.title}"?\nפעולה זו תמחק גם את כל הסעיפים, השיוכים והתקדמות.`)) return;

  try {
    const r = await fetch(`/api/admin/checklists/${id}`, { method: 'DELETE' });
    if (!r.ok) { setMsg('pageMsg','שגיאה במחיקה','err'); return; }
    if (selectedId === id) {
      selectedId = null;
      $('detailPanel').style.display = 'none';
    }
    await loadChecklists();
    setMsg('pageMsg','הצ׳קליסט נמחק','ok');
    setTimeout(() => setMsg('pageMsg',''), 4000);
  } catch (e) { setMsg('pageMsg', e.message, 'err'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// Theme & UI helpers
// ═══════════════════════════════════════════════════════════════════════════
function initTheme() {
  const t = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
  const btn = $('themeToggle');
  if (btn) {
    btn.textContent = t === 'light' ? '🌙' : '☀️';
    btn.onclick = () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      btn.textContent = next === 'light' ? '🌙' : '☀️';
      try { window.parent.postMessage({ type: 'theme', value: next }, '*'); } catch {}
    };
  }
}

function initUserCard() {
  const card = $('userCard');
  const btn  = $('collapseUserCard');
  if (!card || !btn) return;
  btn.onclick = () => {
    card.classList.toggle('collapsed');
    btn.textContent = card.classList.contains('collapsed') ? '▼' : '▲';
  };
}

// Keyboard: Escape closes open modals
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if ($('clModal').classList.contains('open'))     closeClModal();
  if ($('assignModal').classList.contains('open')) closeAssignModal();
});

// Click outside modal card closes it
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.classList.remove('open');
      editingId   = null;
      assigningId = null;
    }
  });
});

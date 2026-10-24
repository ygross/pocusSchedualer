/**
 * lead-course-filter.js
 * Renders a sticky course-selector bar at the top of every CourseManager page.
 * Persists selection in localStorage (shared across same-origin iframes).
 * Dispatches window event 'leadCourseChanged' with { detail: { courseId } }.
 * Exposes window.getLeadCourseId() for synchronous reads.
 */
(function () {
  const LS_KEY = 'pocus_lead_course';
  const _dir   = window.location.pathname.replace(/\/[^\/]*$/, '');
  const API    = `${window.location.origin}${_dir}/api/api`;

  window.getLeadCourseId = function () {
    try { return parseInt(localStorage.getItem(LS_KEY), 10) || null; } catch { return null; }
  };

  const esc = s => String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function run() {
    let courses;
    try {
      const r = await fetch(`${API}/lead/my-courses`, { credentials: 'include' });
      if (r.status === 401) { window.top.location.href = `${_dir}/login-otp.html`; return; }
      if (!r.ok) return;
      courses = await r.json();
    } catch { return; }
    if (!courses?.length) return;

    let courseId;
    try {
      const saved = parseInt(localStorage.getItem(LS_KEY), 10);
      courseId = courses.find(c => c.courseId === saved)?.courseId ?? courses[0].courseId;
    } catch { courseId = courses[0].courseId; }
    try { localStorage.setItem(LS_KEY, String(courseId)); } catch {}

    // Inject styles
    const css = document.createElement('style');
    css.textContent = `
      #leadCourseBar {
        display: flex; align-items: center; gap: 10px;
        padding: 6px 16px;
        background: var(--surface, #eef2ff);
        border-bottom: 2px solid var(--accent, #4f46e5);
        font-size: 13px; direction: rtl;
        position: sticky; top: 0; z-index: 200;
      }
      .lcb-icon { font-size: 16px; }
      .lcb-label { color: var(--muted, #6b7280); font-weight: 500; }
      .lcb-name  { color: var(--accent, #4f46e5); font-weight: 700; font-size: 14px; }
      #lcbSel {
        font-size: 13px; font-weight: 600;
        padding: 3px 8px;
        border: 1px solid var(--border, #c7d2fe);
        border-radius: 6px;
        background: var(--bg, #fff);
        color: var(--fg, #111);
        cursor: pointer;
      }
    `;
    document.head.appendChild(css);

    // Render bar
    const bar = document.createElement('div');
    bar.id = 'leadCourseBar';
    bar.innerHTML = courses.length === 1
      ? `<span class="lcb-icon">📚</span><span class="lcb-label">קורס:</span><span class="lcb-name">${esc(courses[0].courseName)}</span>`
      : `<span class="lcb-icon">📚</span><span class="lcb-label">קורס:</span>
         <select id="lcbSel">${courses.map(c =>
           `<option value="${c.courseId}"${c.courseId === courseId ? ' selected' : ''}>${esc(c.courseName)}</option>`
         ).join('')}</select>`;
    document.body.prepend(bar);

    if (courses.length > 1) {
      document.getElementById('lcbSel').addEventListener('change', function () {
        const newId = parseInt(this.value, 10);
        try { localStorage.setItem(LS_KEY, String(newId)); } catch {}
        window.dispatchEvent(new CustomEvent('leadCourseChanged', { detail: { courseId: newId } }));
      });
    }
  }

  run();
})();

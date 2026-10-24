(function () {
  const LS_COURSE = 'pocus_lead_course';
  const LS_TYPE   = 'pocus_lead_atype';
  const _dir = window.location.pathname.replace(/\/[^\/]*$/, '');
  const API  = `${window.location.origin}${_dir}/api/api`;

  window.getLeadCourseId = function () {
    try { return parseInt(localStorage.getItem(LS_COURSE), 10) || null; } catch { return null; }
  };
  window.getLeadActivityTypeId = function () {
    try { const v = localStorage.getItem(LS_TYPE); return v ? (parseInt(v, 10) || null) : null; } catch { return null; }
  };

  const esc = s => String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function dispatch() {
    window.dispatchEvent(new CustomEvent('leadCourseChanged', {
      detail: { courseId: window.getLeadCourseId(), activityTypeId: window.getLeadActivityTypeId() }
    }));
  }

  async function run() {
    let courses, types;
    try {
      const [rC, rT] = await Promise.all([
        fetch(`${API}/lead/my-courses`, { credentials: 'include' }),
        fetch(`${API}/activity-types`,  { credentials: 'include' })
      ]);
      if (rC.status === 401) { window.top.location.href = `${_dir}/login-otp.html`; return; }
      if (!rC.ok) return;
      courses = await rC.json();
      types   = rT.ok ? await rT.json() : [];
    } catch { return; }
    if (!courses?.length) return;

    // Restore saved values
    let courseId, typeId;
    try {
      const savedC = parseInt(localStorage.getItem(LS_COURSE), 10);
      const savedT = parseInt(localStorage.getItem(LS_TYPE), 10);
      courseId = courses.find(c => c.courseId === savedC)?.courseId ?? courses[0].courseId;
      typeId   = (types || []).find(t => t.activityTypeId === savedT)?.activityTypeId ?? null;
    } catch {
      courseId = courses[0].courseId;
      typeId   = null;
    }
    try { localStorage.setItem(LS_COURSE, String(courseId)); } catch {}
    if (typeId) { try { localStorage.setItem(LS_TYPE, String(typeId)); } catch {} }
    else { try { localStorage.removeItem(LS_TYPE); } catch {} }

    // CSS
    const css = document.createElement('style');
    css.textContent = `
      #leadFilterBar {
        display:flex; align-items:center; gap:18px; flex-wrap:wrap;
        padding:9px 18px;
        background:var(--panel,#102847);
        border-bottom:1px solid var(--line,rgba(255,255,255,.10));
        font-size:13px; direction:rtl;
        position:sticky; top:0; z-index:200;
        box-shadow:0 2px 10px rgba(0,0,0,.30);
      }
      .lfb-group { display:flex; align-items:center; gap:7px; }
      .lfb-label { color:var(--muted,#b7c8e3); font-size:12px; font-weight:600; white-space:nowrap; }
      .lfb-val   { color:var(--txt,#f4f7fb); font-weight:700; font-size:13px; }
      .lfb-sel {
        font-size:13px; font-weight:600; padding:4px 10px;
        border:1px solid var(--line2,rgba(255,255,255,.15));
        border-radius:8px;
        background:var(--inputBg,rgba(0,0,0,.25));
        color:var(--txt,#f4f7fb);
        cursor:pointer; min-width:110px;
      }
      .lfb-sel option { background:#102847; color:#f4f7fb; }
      .lfb-div { width:1px; height:20px; background:var(--line,rgba(255,255,255,.10)); flex-shrink:0; }
    `;
    document.head.appendChild(css);

    // Course group HTML
    const courseHtml = courses.length === 1
      ? `<span class="lfb-group"><span class="lfb-label">קורס:</span><span class="lfb-val">${esc(courses[0].courseName)}</span></span>`
      : `<span class="lfb-group">
           <span class="lfb-label">קורס:</span>
           <select id="lfbCourse" class="lfb-sel">
             ${courses.map(c => `<option value="${c.courseId}"${c.courseId === courseId ? ' selected' : ''}>${esc(c.courseName)}</option>`).join('')}
           </select>
         </span>`;

    // Activity type group HTML
    const typeHtml = `<span class="lfb-group">
      <span class="lfb-label">סוג פעילות:</span>
      <select id="lfbType" class="lfb-sel">
        <option value="">כל הסוגים</option>
        ${(types || []).map(t => `<option value="${t.activityTypeId}"${t.activityTypeId === typeId ? ' selected' : ''}>${esc(t.typeName)}</option>`).join('')}
      </select>
    </span>`;

    const bar = document.createElement('div');
    bar.id = 'leadFilterBar';
    bar.innerHTML = courseHtml + '<span class="lfb-div"></span>' + typeHtml;
    document.body.prepend(bar);

    // Course change
    if (courses.length > 1) {
      document.getElementById('lfbCourse').addEventListener('change', function () {
        try { localStorage.setItem(LS_COURSE, this.value); } catch {}
        dispatch();
      });
    }

    // Activity type change
    document.getElementById('lfbType').addEventListener('change', function () {
      const val = this.value;
      try { val ? localStorage.setItem(LS_TYPE, val) : localStorage.removeItem(LS_TYPE); } catch {}
      dispatch();
    });
  }

  run();
})();

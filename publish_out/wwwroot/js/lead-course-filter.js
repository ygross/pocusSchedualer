(function () {
  const LS_COURSE = 'pocus_lead_course';
  const LS_TYPE   = 'pocus_lead_atype';
  const _dir = window.location.pathname.replace(/\/[^\/]*$/, '');
  // Try /api first; fall back to /api/api for older deployments
  let API = `${window.location.origin}${_dir}/api`;

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
    // Detect API base: try /api then /api/api
    try {
      const probe = await fetch(`${API}/me`, { credentials: 'include' });
      if (!probe.ok && probe.status !== 401) {
        const alt = `${window.location.origin}${_dir}/api/api`;
        const probe2 = await fetch(`${alt}/me`, { credentials: 'include' });
        if (probe2.ok || probe2.status === 401) API = alt;
      }
    } catch {}

    let allCourses, types;
    try {
      const [rC, rT] = await Promise.all([
        fetch(`${API}/lead/my-courses`, { credentials: 'include' }),
        fetch(`${API}/activity-types`,  { credentials: 'include' })
      ]);
      if (rC.status === 401) { window.top.location.href = `${_dir}/login-otp.html`; return; }
      if (!rC.ok) return;
      allCourses = await rC.json();
      types = rT.ok ? await rT.json() : [];
    } catch { return; }
    if (!allCourses?.length) return;

    // Build type→courses index (client-side cascade)
    const coursesByType = {};
    for (const c of allCourses) {
      const tid = c.activityTypeId;
      if (tid) { if (!coursesByType[tid]) coursesByType[tid] = []; coursesByType[tid].push(c); }
    }

    // Filter types to only those that have at least one of this lead's courses
    const relevantTypes = (types || []).filter(t => coursesByType[t.activityTypeId]?.length > 0);

    // Restore saved values
    let courseId, typeId;
    try {
      const savedC = parseInt(localStorage.getItem(LS_COURSE), 10);
      const savedT = parseInt(localStorage.getItem(LS_TYPE), 10);
      typeId   = relevantTypes.find(t => t.activityTypeId === savedT)?.activityTypeId ?? null;
      const availCourses = typeId ? (coursesByType[typeId] || []) : allCourses;
      courseId = availCourses.find(c => c.courseId === savedC)?.courseId ?? availCourses[0]?.courseId ?? null;
    } catch {
      typeId   = null;
      courseId = allCourses[0]?.courseId ?? null;
    }
    try { if (typeId) localStorage.setItem(LS_TYPE, String(typeId)); else localStorage.removeItem(LS_TYPE); } catch {}
    try { if (courseId) localStorage.setItem(LS_COURSE, String(courseId)); } catch {}

    // CSS
    const slot = document.getElementById('leadFilterSlot');
    const inSlot = !!slot;
    const css = document.createElement('style');
    css.textContent = `
      #leadFilterBar {
        display:flex; align-items:center; gap:14px; flex-wrap:wrap;
        padding:${inSlot ? '6px 0' : '10px 16px'};
        ${inSlot ? '' : 'background:var(--card,#0f2340); border:1px solid var(--line2,rgba(255,255,255,.15)); border-radius:var(--radius,12px); margin-bottom:14px;'}
        font-size:13px; direction:rtl;
      }
      .lfb-group { display:flex; align-items:center; gap:7px; }
      .lfb-label { color:var(--muted,#b7c8e3); font-size:12px; font-weight:600; white-space:nowrap; }
      .lfb-val   { color:var(--txt,#f4f7fb); font-weight:700; font-size:13px; }
      .lfb-sel {
        font-size:13px; font-weight:600; padding:5px 10px;
        border:1px solid var(--line2,rgba(255,255,255,.15));
        border-radius:8px;
        background:var(--inputBg,rgba(0,0,0,.25));
        color:var(--txt,#f4f7fb);
        cursor:pointer; min-width:120px;
      }
      .lfb-sel option { background:#0f2340; color:#f4f7fb; }
      .lfb-arrow { color:var(--muted,#b7c8e3); font-size:14px; }
    `;
    document.head.appendChild(css);

    function buildCourseOptions(forTypeId) {
      const list = forTypeId ? (coursesByType[forTypeId] || []) : allCourses;
      return list.map(c => `<option value="${c.courseId}"${c.courseId === courseId ? ' selected' : ''}>${esc(c.courseName)}</option>`).join('');
    }

    const typeOptions = relevantTypes.length > 1
      ? `<option value="">כל הסוגים</option>` + relevantTypes.map(t =>
          `<option value="${t.activityTypeId}"${t.activityTypeId === typeId ? ' selected' : ''}>${esc(t.typeName)}</option>`
        ).join('')
      : (relevantTypes.length === 1
          ? `<option value="${relevantTypes[0].activityTypeId}" selected>${esc(relevantTypes[0].typeName)}</option>`
          : `<option value="">—</option>`);

    const bar = document.createElement('div');
    bar.id = 'leadFilterBar';

    const showTypeSelect = relevantTypes.length > 1;
    const showCourseSelect = allCourses.length > 1;

    bar.innerHTML =
      (showTypeSelect
        ? `<span class="lfb-group"><span class="lfb-label">סוג פעילות:</span><select id="lfbType" class="lfb-sel">${typeOptions}</select></span>`
        : relevantTypes.length === 1
          ? `<span class="lfb-group"><span class="lfb-label">סוג פעילות:</span><span class="lfb-val">${esc(relevantTypes[0].typeName)}</span></span>`
          : '') +
      (showTypeSelect ? `<span class="lfb-arrow">←</span>` : '') +
      (showCourseSelect
        ? `<span class="lfb-group"><span class="lfb-label">קורס:</span><select id="lfbCourse" class="lfb-sel">${buildCourseOptions(typeId)}</select></span>`
        : `<span class="lfb-group"><span class="lfb-label">קורס:</span><span class="lfb-val">${esc(allCourses[0]?.courseName || '')}</span></span>`);

    // Inject: prefer explicit slot, then .wrap/.purpose, then body
    if (inSlot) {
      slot.appendChild(bar);
    } else {
      const wrap    = document.querySelector('.wrap');
      const purpose = wrap?.querySelector('.purpose');
      if (purpose) {
        purpose.insertAdjacentElement('afterend', bar);
      } else if (wrap) {
        wrap.prepend(bar);
      } else {
        document.body.prepend(bar);
      }
    }

    // Events
    if (showTypeSelect) {
      document.getElementById('lfbType').addEventListener('change', function () {
        const newTypeId = this.value ? parseInt(this.value, 10) : null;
        try { newTypeId ? localStorage.setItem(LS_TYPE, String(newTypeId)) : localStorage.removeItem(LS_TYPE); } catch {}

        // Cascade: rebuild course select
        if (showCourseSelect) {
          const sel = document.getElementById('lfbCourse');
          if (sel) {
            sel.innerHTML = buildCourseOptions(newTypeId);
            const firstCourse = newTypeId ? (coursesByType[newTypeId]?.[0]?.courseId) : allCourses[0]?.courseId;
            if (firstCourse) sel.value = String(firstCourse);
            try { localStorage.setItem(LS_COURSE, sel.value); } catch {}
          }
        }
        dispatch();
      });
    }

    if (showCourseSelect) {
      document.getElementById('lfbCourse').addEventListener('change', function () {
        try { localStorage.setItem(LS_COURSE, this.value); } catch {}
        dispatch();
      });
    }
  }

  run();
})();

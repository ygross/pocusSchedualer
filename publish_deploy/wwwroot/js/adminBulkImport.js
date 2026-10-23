/* adminBulkImport.js */
(async function () {
  const _dir = window.location.pathname.replace(/\/[^\/]*$/, "");
  const API_BASE = `${_dir}/api/api`;

  // ── Auth check ──────────────────────────────────────────────
  let me = null;
  try {
    const r = await fetch(`${API_BASE}/me`, { credentials: 'include' });
    if (!r.ok) { location.href = 'app.html'; return; }
    me = await r.json();
  } catch { location.href = 'app.html'; return; }

  const role = (me.roleName || me.RoleName || '').toLowerCase();
  if (role !== 'admin' && role !== 'systemadmin') {
    document.body.innerHTML = '<div style="padding:40px;text-align:center;color:red">אין הרשאה לדף זה</div>';
    return;
  }

  document.getElementById('otpRoleInline').textContent = me.roleName || me.RoleName || '—';
  document.getElementById('userFullName').textContent  = me.fullName  || me.FullName  || '—';
  document.getElementById('userEmail').textContent     = me.email     || me.Email     || '—';
  document.getElementById('userRole').textContent      = me.roleName  || me.RoleName  || '—';

  // ── State ────────────────────────────────────────────────────
  let selectedFile = null;
  let parsedRows   = [];  // [{col:val, ...}]
  let parsedHeaders = [];

  // ── Upload zone wiring ───────────────────────────────────────
  const zone      = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');

  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  // ── Template download ─────────────────────────────────────────
  window.downloadTemplate = function () {
    const bom = '\uFEFF';
    const header = 'FullName,Email,Role,Department,Phone';
    const example = 'ישראל ישראלי,israel@example.com,Instructor,הנדסה,050-1234567';
    const blob = new Blob([bom + header + '\n' + example], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'instructors_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 100);
  };

  // ── File handling ─────────────────────────────────────────────
  function handleFile(f) {
    if (!f.name.toLowerCase().endsWith('.csv') && f.type !== 'text/csv') {
      alert('יש לבחור קובץ CSV בלבד');
      return;
    }
    selectedFile = f;
    document.getElementById('selectedFileName').textContent = f.name;

    const reader = new FileReader();
    reader.onload = ev => {
      let text = ev.target.result;
      // remove BOM
      text = text.replace(/^\uFEFF/, '');
      parseAndPreview(text);
    };
    reader.readAsText(f, 'UTF-8');
  }

  function parseAndPreview(text) {
    const lines = text.split(/\r\n|\r|\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) { alert('הקובץ חייב לכלול שורת כותרת ולפחות שורת נתונים אחת'); return; }

    parsedHeaders = parseCsvLine(lines[0]);
    parsedRows    = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]);
      const row = {};
      parsedHeaders.forEach((h, idx) => row[h] = cells[idx] || '');
      parsedRows.push(row);
    }

    renderPreview();
    document.getElementById('previewSection').style.display = '';
    document.getElementById('importBar').style.display = '';
    document.getElementById('resultsSection').style.display = 'none';
  }

  function renderPreview() {
    document.getElementById('previewCount').textContent = parsedRows.length;

    const thead = document.getElementById('previewHead');
    thead.innerHTML = '<tr>' + parsedHeaders.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';

    const tbody = document.getElementById('previewBody');
    const show = parsedRows.slice(0, 10);
    tbody.innerHTML = show.map(r =>
      '<tr>' + parsedHeaders.map(h => `<td>${esc(r[h] || '')}</td>`).join('') + '</tr>'
    ).join('');

    const hint = document.getElementById('previewHint');
    hint.textContent = parsedRows.length > 10 ? `מוצגות 10 שורות ראשונות מתוך ${parsedRows.length}` : '';
  }

  // ── Import ────────────────────────────────────────────────────
  window.runImport = async function () {
    if (!selectedFile) return;

    const btn     = document.getElementById('importBtn');
    const spinner = document.getElementById('importSpinner');
    btn.disabled  = true;
    spinner.style.display = '';

    try {
      const fd = new FormData();
      fd.append('file', selectedFile);

      const r = await fetch(`${API_BASE}/admin/instructors/bulk-import`, { method: 'POST', credentials: 'include', body: fd });
      const data = await r.json();

      if (!data.ok) {
        alert('שגיאה: ' + (data.error || 'Unknown error'));
        return;
      }

      renderResults(data);
      document.getElementById('resultsSection').style.display = '';
      document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });

    } catch (e) {
      alert('שגיאת רשת: ' + e.message);
    } finally {
      btn.disabled = false;
      spinner.style.display = 'none';
    }
  };

  function renderResults(data) {
    // Summary pills
    const summary = document.getElementById('resultSummary');
    summary.innerHTML = `
      <span class="stat-pill pill-total">סה"כ: ${data.total}</span>
      <span class="stat-pill pill-imported">יובאו: ${data.imported}</span>
      <span class="stat-pill pill-duplicate">כפולות: ${data.duplicates}</span>
      <span class="stat-pill pill-error">שגיאות: ${data.errors}</span>
    `;

    // Rows table
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = (data.rows || []).map(r => {
      const badgeClass = r.status === 'imported' ? 'badge-imported'
                       : r.status === 'duplicate' ? 'badge-duplicate'
                       : 'badge-error';
      const statusLabel = r.status === 'imported' ? 'יובא'
                        : r.status === 'duplicate' ? 'כפול'
                        : 'שגיאה';
      return `<tr>
        <td>${r.row}</td>
        <td>${esc(r.email)}</td>
        <td>${esc(r.name)}</td>
        <td>${esc(r.role || '')}</td>
        <td><span class="status-badge ${badgeClass}">${statusLabel}</span></td>
        <td>${esc(r.reason || '')}</td>
      </tr>`;
    }).join('');
  }

  // ── Reset ─────────────────────────────────────────────────────
  window.resetAll = function () {
    selectedFile = null;
    parsedRows   = [];
    parsedHeaders = [];
    fileInput.value = '';
    document.getElementById('selectedFileName').textContent = '';
    document.getElementById('previewSection').style.display = 'none';
    document.getElementById('importBar').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
  };

  // ── CSV parser (handles quoted fields) ───────────────────────
  function parseCsvLine(line) {
    const fields = [];
    let inQ = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        fields.push(cur.trim()); cur = '';
      } else {
        cur += c;
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();

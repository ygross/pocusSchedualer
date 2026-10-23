const _dir = window.location.pathname.replace(/\/[^\/]*$/, "");
const API  = `${window.location.origin}${_dir}/api/api`;

const $ = id => document.getElementById(id);

const CAT_META = {
  Email:        { icon: "📧", label: "Email Notifications" },
  WhatsApp:     { icon: "💬", label: "WhatsApp Notifications" },
  Availability: { icon: "📅", label: "Availability Settings" },
  Cancellation: { icon: "🚫", label: "Cancellation Settings" },
  System:       { icon: "⚙️",  label: "System" },
  General:      { icon: "🔧", label: "General" },
};

// ── API ────────────────────────────────────────────────────
async function loadSettings() {
  const res = await fetch(`${API}/admin/settings`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load settings (HTTP ${res.status})`);
  return res.json();
}

async function saveCategory(category, rows) {
  const body = rows.map(r => {
    const el = $("input-" + r.settingKey);
    if (!el) return null;
    const value = r.settingType === "bool" ? (el.checked ? "true" : "false") : el.value.trim();
    return { key: r.settingKey, value };
  }).filter(Boolean);

  const res = await fetch(`${API}/admin/settings`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Save failed (HTTP ${res.status})`);
}

// ── Render ─────────────────────────────────────────────────
function buildControl(row) {
  const id = "input-" + row.settingKey;
  if (row.settingType === "bool") {
    const checked = (row.settingValue ?? "false").toLowerCase() === "true";
    return `<label class="toggle" title="${checked ? "Enabled" : "Disabled"}">
      <input type="checkbox" id="${id}" ${checked ? "checked" : ""} />
      <span class="slider"></span>
    </label>`;
  }
  if (row.settingType === "int") {
    return `<input type="number" class="setting-input" id="${id}" value="${row.settingValue ?? ""}" style="width:90px" />`;
  }
  return `<input type="text" class="setting-input" id="${id}" value="${row.settingValue ?? ""}" placeholder="(empty)" />`;
}

function buildCard(category, rows, grouped) {
  const meta = CAT_META[category] ?? { icon: "🔧", label: category };

  const settingRows = rows.map(r => `
    <div class="setting-row">
      <div class="setting-info">
        <div class="setting-label">${r.displayName}</div>
        ${r.description ? `<div class="setting-desc">${r.description}</div>` : ""}
        <div class="setting-key">Key: <code>${r.settingKey}</code></div>
      </div>
      <div class="setting-control">${buildControl(r)}</div>
    </div>`).join("");

  return `
    <div class="cat-card">
      <div class="cat-header">
        <span class="cat-icon">${meta.icon}</span>
        <span class="cat-title">${meta.label}</span>
        <span class="cat-count">${rows.length} setting${rows.length !== 1 ? "s" : ""}</span>
      </div>
      <div class="settings-list">${settingRows}</div>
      <div class="cat-footer">
        <button class="btn-save" data-cat="${category}" type="button">Save ${meta.label}</button>
        <span class="save-status" id="status-${category}"></span>
      </div>
    </div>`;
}

function groupByCategory(settings) {
  const map = {};
  for (const s of settings) {
    if (!map[s.category]) map[s.category] = [];
    map[s.category].push(s);
  }
  return map;
}

function showMsg(text, kind) {
  const el = $("msgBox");
  el.textContent = text;
  el.className = "msg" + (kind ? " " + kind : "");
  el.style.display = text ? "block" : "none";
}

// ── Init ───────────────────────────────────────────────────
(async function init() {
  const grid = $("catsGrid");

  // theme toggle
  const themeBtn = $("themeToggle");
  if (themeBtn) {
    if (localStorage.getItem("theme") === "light") themeBtn.textContent = "☀️";
    themeBtn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      themeBtn.textContent = next === "dark" ? "🌙" : "☀️";
    });
  }

  // load current user
  try {
    const me = await fetch(`${API}/me`, { credentials: "include" }).then(r => r.ok ? r.json() : null);
    if (me) {
      const nameEl = $("meName");
      const roleEl = $("meRole");
      if (nameEl) nameEl.textContent = me.fullName || me.email || "—";
      if (roleEl) roleEl.textContent = me.roleName || "—";
    }
  } catch { /* non-fatal */ }

  // load settings
  try {
    const settings = await loadSettings();
    const grouped  = groupByCategory(settings);

    const catOrder = ["Email", "WhatsApp", "Availability", "Cancellation", "System", "General"];
    const cats = catOrder.filter(c => grouped[c])
      .concat(Object.keys(grouped).filter(c => !catOrder.includes(c)));

    grid.innerHTML = cats.map(c => buildCard(c, grouped[c], grouped)).join("");

    grid.querySelectorAll(".btn-save").forEach(btn => {
      btn.addEventListener("click", async () => {
        const cat      = btn.dataset.cat;
        const statusEl = $("status-" + cat);
        btn.disabled = true;
        statusEl.textContent = "Saving...";
        statusEl.className   = "save-status";
        try {
          await saveCategory(cat, grouped[cat]);
          statusEl.textContent = "✓ Saved";
          statusEl.className   = "save-status save-ok";
          setTimeout(() => { statusEl.textContent = ""; }, 3000);
        } catch (e) {
          statusEl.textContent = e.message;
          statusEl.className   = "save-status save-err";
        } finally {
          btn.disabled = false;
        }
      });
    });

  } catch (e) {
    grid.innerHTML = "";
    showMsg(e.message, "err");
  }
})();

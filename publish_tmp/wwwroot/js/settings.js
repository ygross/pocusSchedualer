/**
 * settings.js — System settings management (Admin only)
 * Loads all settings from /api/admin/settings, groups by category,
 * renders toggle switches (bool) or input fields (string/int).
 * Save per-category or "שמור הכל".
 */

const $ = (id) => document.getElementById(id);
const origin = window.location.origin;
const basePath = new URL(".", window.location.href).pathname.replace(/\/+$/, "/");
const ROOTS = [
  `${origin}${basePath}api/api`,
  `${origin}${basePath}api`,
];
let API_BASE = null;

function esc(s){ return (s??'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

function setGlobalMsg(text, kind=""){
  const el = $("globalMsg");
  el.style.display = text ? "" : "none";
  el.className = "msg" + (kind ? " "+kind : "");
  el.textContent = text||"";
}

async function http(url, opts={}){ return fetch(url,{credentials:"include",...opts}); }
async function httpJson(url, opts={}){
  const res = await http(url,{headers:{"Accept":"application/json",...(opts.headers||{})},...opts});
  if(!res.ok){ const t=await res.text().catch(()=>""); throw new Error(`${res.status} ${t}`.trim()); }
  const ct=res.headers.get("content-type")||"";
  return ct.includes("application/json") ? res.json() : null;
}

// ── API discovery ────────────────────────────────────────────────────────────
async function discoverApi(){
  for(const r of ROOTS){
    try{
      const res = await http(`${r}/me`);
      if(res.ok||res.status===401||res.status===403){ API_BASE=r; return; }
    }catch{}
  }
  throw new Error("לא נמצא API");
}

// ── Load user ────────────────────────────────────────────────────────────────
async function loadMe(){
  try{
    const me = await httpJson(`${API_BASE}/me`);
    $("meLine").textContent = `משתמש: ${me.fullName||me.email||"לא ידוע"} · ${me.roleName||"-"}`;
  }catch{ $("meLine").textContent = "לא מחובר"; }
  $("apiLine").textContent = `API: ${API_BASE}`;
}

// ── Categories meta ──────────────────────────────────────────────────────────
const CAT_META = {
  Email:        { icon:"✉️",  title:"מייל" },
  WhatsApp:     { icon:"💬",  title:"WhatsApp" },
  Availability: { icon:"📅",  title:"זמינות ודדליין" },
  Cancellation: { icon:"🔄",  title:"ביטולי שיבוץ" },
  System:       { icon:"⚙️",  title:"מערכת" },
  General:      { icon:"🗂️",  title:"כללי" },
};

// ── Build settings UI ────────────────────────────────────────────────────────
let _allSettings = [];

function renderSettings(settings){
  _allSettings = settings;

  // Group by category
  const groups = {};
  for(const s of settings){
    const cat = s.category || "General";
    if(!groups[cat]) groups[cat] = [];
    groups[cat].push(s);
  }

  const grid = $("catsGrid");
  grid.innerHTML = "";

  for(const [cat, rows] of Object.entries(groups)){
    const meta = CAT_META[cat] || { icon:"⚙️", title: cat };
    const card = document.createElement("div");
    card.className = "cat-card";
    card.dataset.cat = cat;

    // Header
    const hdr = document.createElement("div");
    hdr.className = "cat-header";
    hdr.innerHTML = `
      <span class="cat-icon">${meta.icon}</span>
      <span class="cat-title">${esc(meta.title)}</span>
      <span class="cat-badge">${rows.length} הגדרות</span>`;
    card.appendChild(hdr);

    // Setting rows
    for(const s of rows){
      const row = document.createElement("div");
      row.className = "setting-row";
      row.dataset.key = s.settingKey;

      const info = document.createElement("div");
      info.className = "setting-info";
      info.innerHTML = `
        <div class="setting-name">${esc(s.displayName || s.settingKey)}</div>
        ${s.description ? `<div class="setting-desc">${esc(s.description)}</div>` : ""}`;

      const ctrl = document.createElement("div");
      ctrl.className = "setting-ctrl";

      const type = (s.settingType||"string").toLowerCase();

      if(type === "bool"){
        const lbl = document.createElement("label");
        lbl.className = "toggle";
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.dataset.key = s.settingKey;
        chk.checked = (s.settingValue||"").toLowerCase() === "true";
        const span = document.createElement("span");
        span.className = "slider";
        lbl.appendChild(chk);
        lbl.appendChild(span);
        ctrl.appendChild(lbl);
      } else {
        const inp = document.createElement("input");
        inp.className = "setting-input";
        inp.type = type === "int" ? "number" : "text";
        inp.dataset.key = s.settingKey;
        inp.value = s.settingValue ?? "";
        inp.dir = "ltr";
        if(type==="int"){ inp.min="0"; inp.style.width="90px"; }
        ctrl.appendChild(inp);
      }

      row.appendChild(info);
      row.appendChild(ctrl);
      card.appendChild(row);
    }

    // Footer
    const footer = document.createElement("div");
    footer.className = "cat-footer";
    const statusEl = document.createElement("span");
    statusEl.className = "save-status";
    const saveBtn = document.createElement("button");
    saveBtn.className = "btn primary";
    saveBtn.textContent = "שמור קטגוריה";
    saveBtn.onclick = () => saveCategory(cat, card, statusEl, saveBtn);
    footer.appendChild(statusEl);
    footer.appendChild(saveBtn);
    card.appendChild(footer);

    grid.appendChild(card);
  }
}

async function saveCategory(cat, card, statusEl, btn){
  btn.disabled = true;
  statusEl.className = "save-status";
  statusEl.textContent = "שומר...";

  const items = [];
  card.querySelectorAll("[data-key]").forEach(el => {
    const key = el.dataset.key;
    if(!key) return;
    const value = el.type === "checkbox" ? String(el.checked) : el.value;
    items.push({ key, value });
  });

  try{
    await httpJson(`${API_BASE}/admin/settings`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(items)
    });
    statusEl.className = "save-status ok";
    statusEl.textContent = "✔ נשמר";
    setTimeout(()=>{ statusEl.textContent=""; }, 3000);
  }catch(e){
    statusEl.className = "save-status err";
    statusEl.textContent = `שגיאה: ${e.message}`;
  }finally{
    btn.disabled = false;
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────
(async function init(){
  try{
    await discoverApi();
  }catch(e){
    setGlobalMsg(`לא נמצא API: ${e.message}`,"err");
    return;
  }

  await loadMe();

  try{
    const settings = await httpJson(`${API_BASE}/admin/settings`);
    if(!Array.isArray(settings)||settings.length===0){
      setGlobalMsg("לא נמצאו הגדרות. ייתכן שאינך מחובר כאדמין.","err");
      return;
    }
    renderSettings(settings);
  }catch(e){
    setGlobalMsg(`שגיאה בטעינת הגדרות: ${e.message}`,"err");
  }
})();

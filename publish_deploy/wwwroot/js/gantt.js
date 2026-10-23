// ===========================
// Gantt (Real API)
// Endpoint: GET {APP_BASE}/api/activities/gantt?from=&to=&activityTypeId=&q=
// ===========================

const APP_BASE = (() => {
    const p = window.location.pathname;
    return p.substring(0, p.lastIndexOf("/") + 1); // /simcenter/PocusSchedualer/
  })();
  const API_BASE = APP_BASE + "api";
  
  const EP = {
    gantt: `${API_BASE}/activities/gantt`,
    me: `${API_BASE}/me`,
    healthDb: `${API_BASE}/health/db`
  };
  
  const $ = (id)=>document.getElementById(id);
  const pad2 = (n)=>String(n).padStart(2,"0");
  const fmtDate = (d)=> `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  const fmtTime = (d)=> `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  function addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function addMonths(d, n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return x; }
  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  
  async function httpJson(url, opts = {}) {
    const res = await fetch(url, {
      credentials: "include",
      headers: { "Accept": "application/json", ...(opts.headers || {}) },
      ...opts
    });
    if (!res.ok) {
      const t = await res.text().catch(()=> "");
      throw new Error(`${res.status} ${t}`.trim());
    }
    return await res.json();
  }
  
  function rangeEnd(start, range){
    if(range==="week") return addDays(start, 7);
    if(range==="month") return addDays(start, 30);
    return addMonths(start, 12);
  }
  
  function buildTicks(start, end, range){
    const ticks = [];
    if(range==="week"){
      for(let i=0;i<7;i++){
        const d = addDays(start,i);
        ticks.push({ label: `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}`, at: d });
      }
      return ticks;
    }
    if(range==="month"){
      const steps = 10;
      for(let i=0;i<steps;i++){
        const d = addDays(start, Math.round((30/steps)*i));
        ticks.push({ label: `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}`, at: d });
      }
      return ticks;
    }
    for(let i=0;i<12;i++){
      const d = addMonths(start, i);
      ticks.push({ label: `${pad2(d.getMonth()+1)}/${String(d.getFullYear()).slice(2)}`, at: d });
    }
    return ticks;
  }
  
  // צבע יציב לפי ActivityName (HSL)
  function barColor(name){
    let h=0; for(const ch of (name||"")) h=(h*31 + ch.charCodeAt(0))%360;
    return `hsl(${h} 70% 85%)`;
  }
  
  async function loadHeaderStatus(){
    // /me
    try{
      const me = await httpJson(EP.me);
      $("meLine").textContent = `משתמש: ${me?.fullName || me?.email || "לא ידוע"}`;
      $("roleLine").textContent = `תפקיד: ${me?.roleName || "לא ידוע"}`;
    }catch{
      $("meLine").textContent = "משתמש: לא מחובר";
      $("roleLine").textContent = "תפקיד: -";
    }
  
    // /health/db
    try{
      const h = await httpJson(EP.healthDb);
      $("healthLine").textContent = `DB: ${h?.ok ? "תקין ✅" : "לא תקין ❌"}`;
    }catch{
      $("healthLine").textContent = "DB: לא זמין ❌";
    }
  }
  
  async function fetchGanttData(from, to, activityTypeId, q){
    const params = new URLSearchParams();
    params.set("from", from.toISOString());
    params.set("to", to.toISOString());
    if (activityTypeId) params.set("activityTypeId", String(activityTypeId));
    if (q) params.set("q", q);
  
    return await httpJson(`${EP.gantt}?${params.toString()}`);
  }
  
  function renderGantt(items, start, end, range){
    const ticks = buildTicks(start, end, range);
  
    // timeline header
    $("timelineHead").innerHTML = ticks.map(()=> `<div class="tick"></div>`).join("");
    $("timelineHead").querySelectorAll(".tick").forEach((el, i)=> el.textContent = ticks[i].label);
  
    $("summaryPill").textContent =
      `טווח: ${fmtDate(start)} → ${fmtDate(end)} | פעילויות מוצגות: ${items.length}`;
  
    const body = $("ganttBody");
    if(items.length===0){
      body.innerHTML = `<div class="empty">אין פעילויות בטווח/חיפוש הנוכחי.</div>`;
      return;
    }
  
    // Convert to local Date for display (server gives UTC)
    const rows = items.map(a => ({
      ...a,
      s: new Date(a.startUtc),
      e: new Date(a.endUtc),
    })).sort((a,b)=> a.s - b.s);
  
    body.innerHTML = rows.map(a=>{
      const total = (end - start);
      const left = clamp01((a.s - start)/total);
      const right = clamp01((a.e - start)/total);
      const width = Math.max(0.01, right - left);
  
      const bg = barColor(a.activityName);
  
      const metaLine1 = `סוג: ${a.typeName}${a.courseName ? ` | קורס: ${a.courseName}` : ""}`;
      const metaLine2 = `מדריך מוביל: ${a.leadInstructorName || "-"}`;
      const metaLine3 = `חדרים: ${a.roomsCount} | נדרשים מדריכים: ${a.requiredInstructors}`;
  
      return `
        <div class="row">
          <div class="meta">
            <b>${a.activityName}</b>
            <div class="m">
              ${metaLine1}<br/>
              תאריך: ${fmtDate(a.s)}<br/>
              שעות: ${fmtTime(a.s)}–${fmtTime(a.e)}<br/>
              ${metaLine2}<br/>
              ${metaLine3}
            </div>
          </div>
          <div class="lane">
            <div class="laneGrid">${ticks.map(()=>`<div class="g"></div>`).join("")}</div>
            <div class="barWrap">
              <div class="bar"
                title="${a.activityName} | ${fmtDate(a.s)} ${fmtTime(a.s)}–${fmtTime(a.e)}"
                style="
                  background:${bg};
                  width:${(width*100).toFixed(2)}%;
                  margin-left:${(left*100).toFixed(2)}%;
                ">
                <span>${a.activityName}</span>
                <small>${fmtTime(a.s)}–${fmtTime(a.e)}</small>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }
  
  async function apply(){
    const range = $("range").value;
    const q = ($("q").value||"").trim();
  
    const startStr = $("startDate").value;
    const start = startStr ? new Date(startStr+"T00:00:00") : new Date();
    const end = rangeEnd(start, range);
  
    $("apiBaseLabel").textContent = API_BASE;
  
    try{
      $("listMsg").textContent = "טוען נתונים מהשרת…";
      const data = await fetchGanttData(start, end, null, q);
      $("listMsg").textContent = "";
      renderGantt(Array.isArray(data)?data:[], start, end, range);
    }catch(e){
      $("listMsg").textContent = `שגיאה: ${e.message}`;
      renderGantt([], start, end, range);
    }
  }
  
  (function init(){
    const today = new Date();
    $("startDate").value = fmtDate(today);
  
    $("todayBtn").addEventListener("click", ()=>{
      const t = new Date();
      $("startDate").value = fmtDate(t);
      apply();
    });
  
    $("applyBtn").addEventListener("click", apply);
    $("range").addEventListener("change", apply);
    $("q").addEventListener("input", ()=> apply());
    $("startDate").addEventListener("change", apply);
  
    loadHeaderStatus();
    apply();
  })();
  
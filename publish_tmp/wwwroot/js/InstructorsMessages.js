/* =========================
   Base-path detect (supports /simcenter/PocusSchedualer/api/api)
   ========================= */
   function getAppPrefix() {
    const m = location.pathname.match(/^(.*\/PocusSchedualer)\//i);
    return m ? m[1] : "";
  }
  
  async function tryMe(base) {
    try {
      const res = await fetch(`${base}/me`, { credentials: "include" });
      return res.ok;
    } catch { return false; }
  }
  
  async function detectApiBase() {
    const prefix = getAppPrefix();
    const candidates = [
      `${prefix}/api/api`,
      `${prefix}/api`,
      `/api/api`,
      `/api`
    ];
    for (const c of candidates) {
      if (await tryMe(c)) return c;
    }
    return candidates[0];
  }
  
  const $ = (id) => document.getElementById(id);
  
  function showErr(msg){
    const box = $("errBox");
    box.style.display = "block";
    box.textContent = msg;
  }
  function clearErr(){
    const box = $("errBox");
    box.style.display = "none";
    box.textContent = "";
  }
  
  async function fetchJson(url){
    const res = await fetch(url, { credentials: "include" });
    const txt = await res.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch {}
    if(!res.ok){
      const msg = (data && (data.error || data.message)) ? (data.error || data.message) : (txt || res.statusText);
      throw new Error(`${res.status} ${res.statusText}\n${msg}`);
    }
    return data;
  }
  
  function escapeHtml(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll("\"","&quot;")
      .replaceAll("'","&#039;");
  }
  
  function monthKey(y,m){ return `${y}-${String(m).padStart(2,"0")}`; }
  
  function buildMonthOptions(select, months){
    const now = new Date();
    const y0 = now.getFullYear();
    const m0 = now.getMonth()+1;
    select.innerHTML = "";
    for(let i=0;i<months;i++){
      const d = new Date(y0, m0-1-i, 1);
      const y = d.getFullYear();
      const m = d.getMonth()+1;
      const opt = document.createElement("option");
      opt.value = monthKey(y,m);
      opt.textContent = `${String(m).padStart(2,"0")}/${y}`;
      if(i===0) opt.selected = true;
      select.appendChild(opt);
    }
  }
  
  function parseMonthValue(v){
    const [y,mm] = String(v||"").split("-");
    return { year:Number(y||0), month:Number(mm||0) };
  }
  
  function shiftMonth(delta){
    const cur = parseMonthValue($("monthSelect").value);
    const d = new Date(cur.year, cur.month-1+delta, 1);
    const v = monthKey(d.getFullYear(), d.getMonth()+1);
    $("monthSelect").value = v;
    refresh();
  }
  
  function groupByMonth(rows){
    const map = new Map();
    for(const r of rows){
      const createdAt = r.createdAtUtc ?? r.CreatedAtUtc ?? r.sentAtUtc ?? r.SentAtUtc;
      const d = createdAt ? new Date(createdAt) : null;
      const key = d ? `${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}` : "לא ידוע";
      if(!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
  
    const keys = Array.from(map.keys()).sort((a,b)=>{
      const [am,ay]=a.split("/").map(Number);
      const [bm,by]=b.split("/").map(Number);
      const va = ay*100+am;
      const vb = by*100+bm;
      return vb-va;
    });
  
    return keys.map(k=>({ key:k, rows: map.get(k) }));
  }
  
  function statusClass(status){
    const s = String(status||"").toLowerCase();
    if(s.includes("sent") || s.includes("success") || s.includes("ok")) return "s-sent";
    if(s.includes("fail") || s.includes("error")) return "s-failed";
    if(s.includes("pend") || s.includes("queue")) return "s-pending";
    return "";
  }
  
  /* =========================
     Preview modal
     ========================= */
  function closePreview(){
    $("overlay").style.display = "none";
    $("overlay").setAttribute("aria-hidden","true");
    $("mTitle").textContent = "תצוגה מקדימה";
    $("mMeta").textContent = "";
    $("mPills").innerHTML = "";
    $("mText").textContent = "";
    const ifr = $("mIframe");
    ifr.style.display = "none";
    ifr.removeAttribute("srcdoc");
    document.body.style.overflow = "";
  }
  
  function openPreview(row){
    const subject = row.subject ?? row.Subject ?? "";
    const status  = row.status ?? row.Status ?? "";
    const createdAt = row.createdAtUtc ?? row.CreatedAtUtc ?? row.sentAtUtc ?? row.SentAtUtc;
    const sentAt = row.sentAtUtc ?? row.SentAtUtc;
    const fail = row.failReason ?? row.FailReason;
    const relEnt = row.relatedEntity ?? row.RelatedEntity;
    const relId = row.relatedId ?? row.RelatedId;
  
    // ✅ DB שלך: EmailOutbox.BodyHtml → לרוב מגיע כ-BodyHtml
    const bodyHtml =
      row.bodyHtml ?? row.BodyHtml ??
      row.htmlBody ?? row.HtmlBody ??
      row.messageHtml ?? row.MessageHtml ??
      row.bodyHTML ?? row.BodyHTML ?? "";
  
    const bodyText =
      row.bodyText ?? row.BodyText ??
      row.textBody ?? row.TextBody ??
      row.body ?? row.Body ??
      row.messageText ?? row.MessageText ?? "";
  
    $("mTitle").textContent = subject || "(ללא נושא)";
  
    const metaParts = [];
    if(createdAt) metaParts.push(`📅 ${new Date(createdAt).toLocaleString("he-IL")}`);
    if(sentAt) metaParts.push(`נשלח: ${new Date(sentAt).toLocaleString("he-IL")}`);
    $("mMeta").textContent = metaParts.join(" • ");
  
    const pills = [];
    if(status) pills.push(`<span class="pill ${statusClass(status)}">סטטוס: ${escapeHtml(status)}</span>`);
    if(fail) pills.push(`<span class="pill s-failed">שגיאה: ${escapeHtml(fail)}</span>`);
    if(relEnt || relId) pills.push(`<span class="pill">קשור: ${escapeHtml(relEnt||"")} ${escapeHtml(relId||"")}</span>`);
    if(bodyHtml) pills.push(`<span class="pill">כולל HTML</span>`);
    if(bodyText) pills.push(`<span class="pill">כולל טקסט</span>`);
    $("mPills").innerHTML = pills.join("");
  
    const ifr = $("mIframe");
    const pre = $("mText");
  
    if(String(bodyHtml||"").trim()){
      // ✅ טקסט בהיר גם בתוך iframe (כופה !important)
      const wrapper = `<!doctype html>
  <html>
  <head>
  <meta charset="utf-8"/>
  <style>
    body{
      font-family: Arial, sans-serif;
      padding:14px;
      background:#071827 !important;
      color:#eaf3ff !important;
      line-height:1.5;
    }
    *{ color:#eaf3ff !important; }
    a{ color:#8ab4ff !important; }
    img{ max-width:100%; height:auto; }
    table{ border-collapse:collapse; }
  </style>
  </head>
  <body>${bodyHtml}</body>
  </html>`;
  
      ifr.setAttribute("srcdoc", wrapper);
      ifr.style.display = "block";
      pre.textContent = "";
    } else {
      ifr.style.display = "none";
      ifr.removeAttribute("srcdoc");
      pre.textContent = bodyText ? String(bodyText) : "(אין תוכן הודעה בשורה זו)";
    }
  
    $("overlay").style.display = "flex";
    $("overlay").setAttribute("aria-hidden","false");
    document.body.style.overflow = "hidden";
  }
  
  /* =========================
     Search
     ========================= */
  let lastRows = [];
  let currentViewRows = [];
  
  function rowSearchBlob(r){
    const subject = r.subject ?? r.Subject ?? "";
    const status = r.status ?? r.Status ?? "";
    const fail = r.failReason ?? r.FailReason ?? "";
    const createdAt = r.createdAtUtc ?? r.CreatedAtUtc ?? "";
    const sentAt = r.sentAtUtc ?? r.SentAtUtc ?? "";
    const relEnt = r.relatedEntity ?? r.RelatedEntity ?? "";
    const relId = r.relatedId ?? r.RelatedId ?? "";
  
    const bodyHtml =
      r.bodyHtml ?? r.BodyHtml ?? r.htmlBody ?? r.HtmlBody ?? r.messageHtml ?? r.MessageHtml ?? "";
    const bodyText =
      r.bodyText ?? r.BodyText ?? r.textBody ?? r.TextBody ?? r.body ?? r.Body ?? r.messageText ?? r.MessageText ?? "";
  
    return (
      String(subject)+" | "+
      String(status)+" | "+
      String(fail)+" | "+
      String(createdAt)+" | "+
      String(sentAt)+" | "+
      String(relEnt)+" | "+
      String(relId)+" | "+
      String(bodyText)+" | "+
      String(bodyHtml)
    ).toLowerCase();
  }
  
  function renderFromState(){
    const q = String($("searchBox").value||"").trim().toLowerCase();
    const filtered = q ? lastRows.filter(r => rowSearchBlob(r).includes(q)) : lastRows.slice();
    render({ rows: filtered });
  }
  
  /* =========================
     Rendering
     ========================= */
  function render(data){
    const host = $("content");
    const rows = data?.rows ?? [];
    lastRows = rows.slice();
  
    const grouped = groupByMonth(rows);
  
    if(!rows.length){
      host.innerHTML = `<div class="muted">אין מיילים (לא כולל OTP) בטווח שנבחר${$("searchBox").value ? " (אחרי חיפוש)" : ""}.</div>`;
      return;
    }
  
    host.innerHTML = grouped.map(g=>{
      const count = g.rows.length;
      return `
        <div style="margin-bottom:14px">
          <div class="monthTitle">
            <div>📅 ${escapeHtml(g.key)}</div>
            <span class="badge">${count} הודעות</span>
          </div>
  
          <table>
            <thead>
              <tr>
                <th style="width:16%">תאריך</th>
                <th style="width:30%">נושא</th>
                <th style="width:12%">סטטוס</th>
                <th style="width:32%">פרטים</th>
                <th style="width:10%">Preview</th>
              </tr>
            </thead>
            <tbody>
              ${g.rows.map((r)=>{
                const created = new Date(r.createdAtUtc ?? r.CreatedAtUtc ?? r.sentAtUtc ?? r.SentAtUtc);
                const createdStr = isNaN(created.getTime()) ? "" : created.toLocaleString("he-IL");
                const subject = r.subject ?? r.Subject ?? "";
                const status = r.status ?? r.Status ?? "";
                const sentAt = r.sentAtUtc ?? r.SentAtUtc;
                const fail = r.failReason ?? r.FailReason;
                const relEnt = r.relatedEntity ?? r.RelatedEntity;
                const relId = r.relatedId ?? r.RelatedId;
  
                return `
                  <tr>
                    <td class="small">${escapeHtml(createdStr)}</td>
                    <td class="wrap">${escapeHtml(subject)}</td>
                    <td class="status ${statusClass(status)}">${escapeHtml(status)}</td>
                    <td class="wrap">
                      ${sentAt ? `נשלח: ${escapeHtml(new Date(sentAt).toLocaleString("he-IL"))}<br>` : ``}
                      ${fail ? `שגיאה: ${escapeHtml(fail)}<br>` : ``}
                      ${(relEnt||relId) ? `קשור: ${escapeHtml(relEnt||"")} ${escapeHtml(relId||"")}` : ``}
                    </td>
                    <td>
                      <button class="btnMini" type="button" data-preview-i="">PREVIEW</button>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;
    }).join("");
  
    currentViewRows = [];
    for(const g of grouped){
      for(const r of g.rows) currentViewRows.push(r);
    }
  
    const btns = host.querySelectorAll("button[data-preview-i]");
    btns.forEach((b, i) => b.setAttribute("data-preview-i", String(i)));
  }
  
  let apiBase = null;
  
  async function loadMeLine(){
    const me = await fetchJson(`${apiBase}/me`);
    const name = me?.fullName ?? me?.FullName ?? "—";
    const role = me?.roleName ?? me?.RoleName ?? me?.role ?? me?.Role ?? "—";
    const email = me?.email ?? me?.Email ?? "—";
    $("meLine").textContent = `מחובר: ${name} (${role}) | ${email}`;
  }
  
  async function refresh(){
    clearErr();
    try{
      if(!apiBase) apiBase = await detectApiBase();
  
      await loadMeLine();
  
      const {year, month} = parseMonthValue($("monthSelect").value);
      const back = Number($("monthsBack").value || 6);
  
      const url = `${apiBase}/instructors/messages?fromYear=${year}&fromMonth=${month}&monthsBack=${back}`;
      const data = await fetchJson(url);
  
      render(data);
  
      if(String($("searchBox").value||"").trim()){
        renderFromState();
      }
  
    } catch(e){
      console.error(e);
      showErr(e.message || String(e));
    }
  }
  
  document.addEventListener("DOMContentLoaded", ()=>{
    buildMonthOptions($("monthSelect"), 24);
  
    $("refreshBtn").addEventListener("click", refresh);
    $("monthSelect").addEventListener("change", refresh);
    $("monthsBack").addEventListener("change", refresh);
  
    $("prevBtn").addEventListener("click", ()=> shiftMonth(-1));
    $("nextBtn").addEventListener("click", ()=> shiftMonth(+1));
  
    let t = null;
    $("searchBox").addEventListener("input", ()=>{
      clearTimeout(t);
      t = setTimeout(renderFromState, 120);
    });
  
    $("closeModalBtn").addEventListener("click", closePreview);
    $("overlay").addEventListener("click", (e)=>{ if(e.target === $("overlay")) closePreview(); });
    window.addEventListener("keydown", (e)=>{ if(e.key==="Escape" && $("overlay").style.display==="flex") closePreview(); });
  
    $("content").addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-preview-i]");
      if(!btn) return;
      const i = Number(btn.getAttribute("data-preview-i"));
      const row = currentViewRows[i];
      if(row) openPreview(row);
    });
  
    refresh();
  });
  
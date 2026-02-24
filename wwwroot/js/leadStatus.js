// File: js/leadsStatus.js  (API CONNECTED)
(() => {
  const $ = (id) => document.getElementById(id);

  // =========================
  // Base URL (works in iframe)
  // =========================
  // API_BASE נחשב דינמית לפי מיקום הדף
  const _lsAppPath = new URL(".", window.location.href).pathname;
  const API_BASE = (window.API_BASE || "").trim() || `${window.location.origin}${_lsAppPath}api`;

  function setSpinner(on){
    const sp1 = $("spin");
    const sp2 = $("spinTop");
    if (sp1) sp1.style.display = on ? "inline-block" : "none";
    if (sp2) sp2.style.display = on ? "inline-block" : "none";
  }

  function fmtDate(d){
    try{
      const dt = (d instanceof Date) ? d : new Date(d);
      return dt.toLocaleDateString("he-IL", { year:"numeric", month:"2-digit", day:"2-digit" });
    }catch{ return String(d ?? "—"); }
  }

  function fmtMonthRange(yyyyMM){
    if(!yyyyMM || !yyyyMM.includes("-")) return "—";
    const [y,m] = yyyyMM.split("-").map(Number);
    const start = new Date(y, m-1, 1);
    const end   = new Date(y, m, 0);
    return `${fmtDate(start)} – ${fmtDate(end)}`;
  }

  function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }

  // =========================
  // API helpers
  // =========================
  async function apiGet(path){
    const url = `${API_BASE}${path}`;
    const r = await fetch(url, {
      method: "GET",
      credentials: "include",              // חשוב ל-OTP/session cookies
      headers: { "Accept": "application/json" }
    });

    if(!r.ok){
      let msg = `HTTP ${r.status}`;
      try{
        const t = await r.text();
        if(t) msg += `: ${t.slice(0,200)}`;
      }catch{}
      throw new Error(msg);
    }
    return r.json();
  }

  // =========================
  // UI helpers
  // =========================
  function animateNumber(el, to, duration=450){
    if(!el) return;
    const from = Number(String(el.textContent).replace(/[^\d.-]/g,'')) || 0;
    const start = performance.now();
    const diff = to - from;

    function tick(now){
      const t = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(from + diff * eased));
      if(t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function statusForInstance(it){
    const canceled = !!it.canceled;
    const required = Number(it.required || 0);
    const assigned = Number(it.assigned || 0);

    if(canceled) return { key:"cancel", label:"בוטל", cls:"s-cancel" };
    if(assigned >= required && required > 0) return { key:"good", label:"מלא", cls:"s-good" };
    if(assigned > 0) return { key:"warn", label:"חלקי", cls:"s-warn" };
    return { key:"bad", label:"ללא שיבוץ", cls:"s-bad" };
  }

  function computeKpis(instances){
    const total = instances.length;
    let full=0, partial=0, none=0;

    for(const it of instances){
      const st = statusForInstance(it);
      if(st.key === "cancel") continue;
      if(st.key === "good") full++;
      else if(st.key === "warn") partial++;
      else if(st.key === "bad") none++;
    }

    const denom = Math.max(1, (full+partial+none));
    const coverage = Math.round(((full + partial*0.5) / denom) * 100);
    return { total, full, partial, none, coverage };
  }

  function updateKpis(kpis){
    animateNumber($("kpiTotal"), kpis.total);
    animateNumber($("kpiFull"), kpis.full);
    animateNumber($("kpiPartial"), kpis.partial);
    animateNumber($("kpiNone"), kpis.none);

    const pct = clamp(kpis.coverage, 0, 100);
    $("progressText").textContent = `${pct}%`;
    $("progressBar").style.width = `${pct}%`;
  }

  // =========================
  // Modal
  // =========================
  function openModal(title, meta, body){
    $("modalTitle").textContent = title || "—";
    $("modalMeta").textContent = meta || "—";
    $("modalBody").textContent = body || "—";
    $("modalBack").style.display = "flex";
  }
  function closeModal(){ $("modalBack").style.display = "none"; }

  // =========================
  // Renderers
  // =========================
  let LAST_DATA = null;

  function renderInstances(instances){
    const tb = $("instancesTbody");
    tb.innerHTML = "";

    const q = ($("searchTxt").value || "").trim().toLowerCase();
    const onlyOpen = $("onlyOpenChk").checked;
    const onlyIssues = $("onlyIssuesChk").checked;

    const filtered = instances.filter(it => {
      const st = statusForInstance(it);
      const text = `${it.date} ${it.activity} ${it.note || ""} ${st.label}`.toLowerCase();
      if(q && !text.includes(q)) return false;
      if(onlyOpen && (st.key === "cancel" || st.key === "good")) return false;
      if(onlyIssues && (st.key === "good" || st.key === "cancel")) return false;
      return true;
    });

    $("instancesEmpty").style.display = filtered.length ? "none" : "flex";

    for(const it of filtered){
      const st = statusForInstance(it);

      const tr = document.createElement("tr");
      tr.dataset.status = st.key;

      tr.innerHTML = `
        <td class="w120">${fmtDate(it.date)}</td>
        <td><b>${it.activity || ""}</b></td>
        <td class="w90">${Number(it.required || 0)}</td>
        <td class="w90">${st.key === "cancel" ? "—" : Number(it.assigned || 0)}</td>
        <td class="w150"><span class="status ${st.cls}">${st.label}</span></td>
        <td>${it.note || ""}</td>
        <td class="w220">
          <div class="actions">
            <button class="mini primary" type="button" data-act="view">פרטים</button>
            <button class="mini" type="button" data-act="msg">הודעה</button>
          </div>
        </td>
      `;

      tr.querySelector('[data-act="view"]').addEventListener("click", () => {
        openModal(
          `מופע: ${it.activity || "—"}`,
          `${fmtDate(it.date)} • נדרש: ${it.required} • שובץ: ${st.key==="cancel"?"—":it.assigned} • סטטוס: ${st.label}`,
          JSON.stringify(it, null, 2)
        );
      });

      tr.querySelector('[data-act="msg"]').addEventListener("click", () => {
        openModal(
          "פעולה עתידית",
          "כאן תחבר ל-endpoint של שליחת הודעה",
          "כפתור זה מיועד לחיבור API לשליחת תזכורת/מייל.\nאם יש לך endpoint קיים — תגיד לי את הנתיב ואחבר."
        );
      });

      tb.appendChild(tr);
    }
  }

  function renderMessages(messages){
    const tb = $("messagesTbody");
    tb.innerHTML = "";

    const arr = Array.isArray(messages) ? messages : [];
    $("messagesEmpty").style.display = arr.length ? "none" : "flex";

    for(const m of arr){
      const tr = document.createElement("tr");
      const ok = String(m.status || "").toUpperCase() === "SENT";
      tr.innerHTML = `
        <td class="w120">${fmtDate(m.day)}</td>
        <td>${m.subject || ""}</td>
        <td class="w110"><span class="status ${ok ? "s-good":"s-bad"}">${ok ? "נשלח":"נכשל"}</span></td>
        <td class="w90">${m.recipients ?? "—"}</td>
        <td class="w90"><button class="mini" type="button">פתח</button></td>
      `;
      tr.querySelector("button").addEventListener("click", () => {
        openModal(
          `הודעה: ${m.subject || "—"}`,
          `${fmtDate(m.day)} • סטטוס: ${(m.status||"—")}`,
          m.body || "(אין גוף הודעה)"
        );
      });
      tb.appendChild(tr);
    }
  }

  function renderFairness(fairness){
    const tb = $("fairnessTbody");
    tb.innerHTML = "";

    const arr = Array.isArray(fairness) ? fairness : [];
    $("fairnessEmpty").style.display = arr.length ? "none" : "flex";

    for(const f of arr){
      const emails = Number(f.emails || 0);
      const noReply = Number(f.noReply || 0);
      const ratio = emails > 0 ? (noReply / emails) : 0;

      const st =
        ratio >= 0.6 ? { label:"בעיה", cls:"s-bad" } :
        ratio >= 0.3 ? { label:"מעקב", cls:"s-warn" } :
        { label:"טוב", cls:"s-good" };

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${f.name || "—"}</b></td>
        <td class="w120">${Number(f.assigned || 0)}</td>
        <td class="w140">${Number(f.availability || 0)}</td>
        <td class="w140">${emails}</td>
        <td class="w150">${noReply}</td>
        <td class="w140"><span class="status ${st.cls}">${st.label}</span></td>
      `;
      tb.appendChild(tr);
    }
  }

  function renderInsights(kpis, fairness){
    const box = $("insightsBox");
    box.innerHTML = "";

    const items = [];
    if(kpis.none > 0) items.push({ badge:"⚠️", title:`יש ${kpis.none} מופעים ללא שיבוץ`, body:"המלצה: תעדף מופעים אדומים ושלח פנייה למוסמכים." });
    if(kpis.partial > 0) items.push({ badge:"🟡", title:`${kpis.partial} מופעים חלקיים`, body:"המלצה: השלם מדריך(ים) חסרים לפני חלון הזמן הקריטי." });
    items.push({ badge: kpis.coverage >= 85 ? "✅" : "📉", title:`כיסוי: ${kpis.coverage}%`, body: kpis.coverage >= 85 ? "מצב טוב — המשך ניטור." : "כדאי להגביר פניות/שיבוצים." });

    const arr = Array.isArray(fairness) ? fairness : [];
    const worst = [...arr].sort((a,b)=>{
      const ra = (a.emails ? (a.noReply/a.emails) : 0);
      const rb = (b.emails ? (b.noReply/b.emails) : 0);
      return rb - ra;
    })[0];

    if(worst && Number(worst.emails||0) >= 2 && Number(worst.noReply||0) >= 1){
      items.push({ badge:"🧑‍🏫", title:`צדק: ${worst.name} עם אי-תגובה גבוהה`, body:"המלצה: בדוק חסמים/מדיניות פניות או איזון עומסים." });
    }

    for(const it of items.slice(0,5)){
      const el = document.createElement("div");
      el.className = "insight";
      el.innerHTML = `
        <div class="badge">${it.badge}</div>
        <div class="txt"><b>${it.title}</b><div class="muted">${it.body}</div></div>
      `;
      box.appendChild(el);
    }
  }

  // =========================
  // Load from API
  // =========================
  async function loadAndRender(){
    setSpinner(true);

    const month = $("monthSel").value;          // YYYY-MM
    const courseId = $("courseSel").value || ""; // e.g. "A"

    try{
      // 1) Pull data
      const data = await apiGet(`/lead/status?courseId=${encodeURIComponent(courseId)}&month=${encodeURIComponent(month)}`);
      LAST_DATA = data;

      // 2) Top info
      $("apiPathTxt").textContent = API_BASE;
      $("kpiSubtitle").textContent = `${data?.course?.name || "—"} • ${fmtMonthRange(data?.month || month)}`;
      $("pillCourseCount").textContent = `קורס: ${data?.course?.name || "—"}`;
      $("pillMonthRange").textContent = `טווח: ${fmtMonthRange(data?.month || month)}`;

      // 3) user
      if(data?.user?.name) $("userName").textContent = data.user.name;
      if(data?.user?.role) $("userRole").textContent = data.user.role;

      // 4) render
      const instances = Array.isArray(data.instances) ? data.instances : [];
      const messages  = Array.isArray(data.messages) ? data.messages : [];
      const fairness  = Array.isArray(data.fairness) ? data.fairness : [];

      const kpis = computeKpis(instances);
      updateKpis(kpis);

      renderInstances(instances);
      renderMessages(messages);
      renderFairness(fairness);
      renderInsights(kpis, fairness);

      $("lastRefreshTag").textContent = `עדכון אחרון: ${new Date().toLocaleString("he-IL")}`;
    }catch(err){
      openModal("שגיאת API", "נכשל לטעון נתונים", String(err?.message || err));
    }finally{
      setSpinner(false);
    }
  }

  // =========================
  // Init
  // =========================
  async function init(){
    // default month
    const now = new Date();
    $("monthSel").value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

    // Courses list:
    // אם יש לך endpoint לקורסים — זה הכי נכון:
    // GET /api/lead/courses  -> [{id,name}]
    try{
      const courses = await apiGet(`/lead/courses`);
      const sel = $("courseSel");
      sel.innerHTML = (courses || []).map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    }catch{
      // fallback אם אין endpoint כזה
      const sel = $("courseSel");
      sel.innerHTML = `<option value="">בחר קורס</option>`;
    }

    // buttons
    $("btnRefresh")?.addEventListener("click", loadAndRender);
    $("btnRefreshTop")?.addEventListener("click", loadAndRender);
    $("monthSel")?.addEventListener("change", loadAndRender);
    $("courseSel")?.addEventListener("change", loadAndRender);
    $("searchTxt")?.addEventListener("input", () => { if(LAST_DATA) renderInstances(LAST_DATA.instances||[]); });
    $("onlyOpenChk")?.addEventListener("change", () => { if(LAST_DATA) renderInstances(LAST_DATA.instances||[]); });
    $("onlyIssuesChk")?.addEventListener("change", () => { if(LAST_DATA) renderInstances(LAST_DATA.instances||[]); });

    $("btnPrev")?.addEventListener("click", () => {
      const [y,m] = $("monthSel").value.split("-").map(Number);
      const d = new Date(y, m-2, 1);
      $("monthSel").value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      loadAndRender();
    });

    $("btnNext")?.addEventListener("click", () => {
      const [y,m] = $("monthSel").value.split("-").map(Number);
      const d = new Date(y, m, 1);
      $("monthSel").value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      loadAndRender();
    });

    // modal
    $("modalClose")?.addEventListener("click", closeModal);
    $("modalBack")?.addEventListener("click", (e) => { if(e.target === $("modalBack")) closeModal(); });
    document.addEventListener("keydown", (e) => { if(e.key === "Escape") closeModal(); });

    // first load
    loadAndRender();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

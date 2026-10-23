(() => {
  "use strict";

  const baseDir = window.location.pathname.replace(/\/[^\/]*$/, "");
  const API_ME     = `${baseDir}/api/api/me`;
  const API_LOGOUT = `${baseDir}/api/api/auth/logout`;
  const API_DB     = `${baseDir}/api/api/health/db`;
  const ICON_BASE  = `${baseDir}/img/icons/`;

  const MENU_CFG = {"defaults":{"Instructor":"my-assignments.html","CourseManager":"LeadUpdateActivities.html","Admin":"adminUpdateDeleteActivities.html","SystemAdmin":"sysAdminDashboard.html"},"items":[{"id":"myAssignments","icon":"assignment","label":"המשימות שלי","page":"my-assignments.html","roles":["Instructor"],"group":"Instructor","section":"פעילות"},{"id":"InstructorActivitiesCalendar","icon":"calendar","label":"יומן פעילויות","page":"InstructorActivitiesCalendar.html","roles":["Instructor","CourseManager","Admin"],"group":"Instructor","section":"פעילות"},{"id":"activitiesList","icon":"activities","label":"רשימת פעילויות","page":"activitieslist.html","roles":["Instructor","Admin"],"group":"Instructor","section":"פעילות"},{"id":"InstructorsSummary","icon":"summary","label":"דוח מסכם","page":"instructorsSummary.html","roles":["Instructor","CourseManager","Admin"],"group":"Instructor","section":"דוחות"},{"id":"InstructorsMessages","icon":"messages","label":"הודעות","page":"InstructorsMessages.html","roles":["Instructor","Admin"],"group":"Instructor","section":"דוחות"},{"id":"InstructorUpdateDetails","icon":"edit","label":"עדכון פרטים","page":"instructorUpdateDetails.html","roles":["Instructor","CourseManager","Admin"],"group":"Instructor","section":"ניהול"},{"id":"help","icon":"help","label":"עזרה","page":"help.html","roles":["Instructor","CourseManager","Admin"],"group":"Instructor","section":"ניהול"},{"id":"LeadUpdateActivities","icon":"edit","label":"עריכת פעילות","page":"LeadUpdateActivities.html","roles":["CourseManager","Admin"],"group":"CourseManager","section":"פעילות"},{"id":"leadCreateActivity","icon":"add","label":"פתיחת פעילות חדשה","page":"LeadCreateActivity.html","roles":["CourseManager","Admin"],"group":"CourseManager","section":"פעילות"},{"id":"leadAssignment","icon":"assignment","label":"שיבוץ פעילות","page":"leadassignment.html","roles":["CourseManager","Admin"],"group":"CourseManager","section":"פעילות"},{"id":"leadPendingAvailability","icon":"report","label":"זמינות ממתינה","page":"LeadPendingAvailability.html","roles":["CourseManager","Admin"],"group":"CourseManager","section":"פעילות"},{"id":"leadReplacementManagement","icon":"alert","label":"ניהול החלפות","page":"LeadReplacementManagement.html","roles":["CourseManager","Admin"],"group":"CourseManager","section":"פעילות"},{"id":"leadConflictReport","icon":"report","label":"דוח התנגשויות","page":"LeadConflictReport.html","roles":["CourseManager","Admin"],"group":"CourseManager","section":"דוחות"},{"id":"leadCalendar","icon":"calendar","label":"קלנדר למרכז","page":"leadCalendar.html","roles":["CourseManager","Admin"],"group":"CourseManager","section":"פעילות"},{"id":"courseManagerReport","icon":"report","label":"דוחות מרכז קורס","page":"instructorsSummary.html","roles":["CourseManager","Admin"],"group":"CourseManager","section":"דוחות"},{"id":"LeadCourseDashboard","icon":"dashboard","label":"דשבורד קורס","page":"LeadCourseDashboard.html","roles":["CourseManager","Admin"],"group":"CourseManager","section":"דוחות"},{"id":"LeadInstructorLoad","icon":"summary","label":"עומס מדריכים","page":"LeadInstructorLoad.html","roles":["CourseManager","Admin"],"group":"CourseManager","section":"דוחות"},{"id":"leadReminders","icon":"messages","label":"שליחת הודעה / תזכורת","page":"leadReminders.html","roles":["CourseManager","Admin"],"group":"CourseManager","section":"ניהול"},{"id":"adminUpdateDeleteActivities","icon":"edit","label":"עדכון / מחיקה פעילויות","page":"adminUpdateDeleteActivities.html","roles":["Admin"],"group":"Admin","section":"פעילות"},{"id":"AdminActivityAssignment","icon":"assignment","label":"שיבוץ פעילות","page":"adminActivityAssignment.html","roles":["Admin"],"group":"Admin","section":"פעילות"},{"id":"adminAddActivities","icon":"add","label":"הוספת פעילות","page":"adminAddActivities.html","roles":["Admin"],"group":"Admin","section":"פעילות"},{"id":"gantt","icon":"gantt","label":"גאנט פעילויות","page":"gantt.html","roles":["Admin"],"group":"Admin","section":"פעילות"},{"id":"adminHoursReport","icon":"report","label":"דוח שעות מנהלה","page":"admin-hours-report.html","roles":["Admin"],"group":"Admin","section":"דוחות"},{"id":"adminInstructorSummary","icon":"summary","label":"דוחות מדריכים","page":"instructorsSummary.html","roles":["Admin"],"group":"Admin","section":"דוחות"},{"id":"AdminInstructorUtilizationReport","icon":"report","label":"ניצול מדריכים","page":"AdminInstructorUtilizationReport.html","roles":["Admin"],"group":"Admin","section":"דוחות"},{"id":"adminCenterOverview","icon":"dashboard","label":"מבט מרכז","page":"adminCenterOverview.html","roles":["Admin"],"group":"Admin","section":"דוחות"},{"id":"sysAdminDashboard","icon":"dashboard","label":"Dashboard","page":"sysAdminDashboard.html","roles":["SystemAdmin"],"group":"SystemAdmin","section":"System"},{"id":"sysAdminEmailCenter","icon":"messages","label":"Email Center","page":"sysAdminEmailCenter.html","roles":["SystemAdmin"],"group":"SystemAdmin","section":"Monitoring"},{"id":"sysAdminAuditLog","icon":"summary","label":"Audit Log","page":"sysAdminAuditLog.html","roles":["SystemAdmin"],"group":"SystemAdmin","section":"Monitoring"},{"id":"sysAdminErrors","icon":"alert","label":"Errors","page":"sysAdminErrors.html","roles":["SystemAdmin"],"group":"SystemAdmin","section":"Monitoring"},{"id":"sysAdminUsers","icon":"courses","label":"User Management","page":"sysAdminUsers.html","roles":["SystemAdmin"],"group":"SystemAdmin","section":"System"},{"id":"sysAdminPermissions","icon":"settings","label":"הרשאות Admin / SysAdmin","page":"sysAdminPermissions.html","roles":["SystemAdmin"],"group":"SystemAdmin","section":"System"},{"id":"sysAdminMaintenance","icon":"settings","label":"Maintenance","page":"sysAdminMaintenance.html","roles":["SystemAdmin"],"group":"SystemAdmin","section":"Maintenance"},{"id":"sysAdminForceDelete","icon":"alert","label":"Force Delete Course","page":"sysAdminForceDelete.html","roles":["SystemAdmin"],"group":"SystemAdmin","section":"Maintenance"},{"id":"courseInstructors","icon":"courses","label":"ניהול הסמכות מדריכים","page":"admincourseInstructors.html","roles":["Admin"],"group":"Admin","section":"ניהול"},{"id":"adminInstructorCourse","icon":"courses","label":"הסמכות לפי קורס","page":"adminInstructorCourse.html","roles":["Admin"],"group":"Admin","section":"ניהול"},{"id":"activityTypes","icon":"settings","label":"סוגי פעילויות","page":"activityTypes.html","roles":["Admin"],"group":"Admin","section":"ניהול"},{"id":"adminCoursesManagement","icon":"courses","label":"ניהול קורסים","page":"adminCoursesManagement.html","roles":["Admin"],"group":"Admin","section":"ניהול"},{"id":"adminBulkImport","icon":"add","label":"ייבוא מדריכים מקובץ","page":"adminBulkImport.html","roles":["SystemAdmin"],"group":"SystemAdmin","section":"System"},{"id":"systemSettings","icon":"settings","label":"הגדרות מערכת","page":"adminSettings.html","roles":["SystemAdmin"],"group":"SystemAdmin","section":"System"},{"id":"changelog","icon":"summary","label":"עדכוני גרסאות","page":"changelog.html","roles":["SystemAdmin"],"group":"SystemAdmin","section":"System"}]};
  const API_IMPERSONATE_USERS = `${baseDir}/api/api/admin/impersonate/users`;
  const API_IMPERSONATE_START = `${baseDir}/api/api/admin/impersonate/start`;
  const API_IMPERSONATE_STOP  = `${baseDir}/api/api/admin/impersonate/stop`;

  const KEY_THEME = "theme";
  const KEY_LAST_PAGE = "lastPage";
  const KEY_OPEN_GROUP = "menuOpenGroup";

  const contentFrame  = document.getElementById("contentFrame");
  const menuContainer = document.getElementById("menuContainer");
  const menuRoleLine  = document.getElementById("menuRoleLine");
  const userNameEl  = document.getElementById("userName");
  const userRoleEl  = document.getElementById("userRole");
  const pageTextEl  = document.getElementById("pageText");
  const sessionDot  = document.getElementById("sessionDot");
  const sessionText = document.getElementById("sessionText");
  const dbDot       = document.getElementById("dbDot");
  const dbText      = document.getElementById("dbText");
  const logoutBtn   = document.getElementById("logoutBtn");
  const themeToggle = document.getElementById("themeToggle");
  const authBanner  = document.getElementById("authBanner");
  const authMsg     = document.getElementById("authMsg");
  const goLoginBtn  = document.getElementById("goLoginBtn");
  const impersonateBanner  = document.getElementById("impersonateBanner");
  const impersonateName    = document.getElementById("impersonateName");
  const stopImpersonateBtn = document.getElementById("stopImpersonateBtn");
  const impersonatePanel   = document.getElementById("impersonatePanel");
  const impersonateSelect  = document.getElementById("impersonateSelect");
  const startImpersonateBtn = document.getElementById("startImpersonateBtn");

  const GROUP_ORDER = ["Instructor", "CourseManager", "Admin", "SystemAdmin"];
  const GROUP_TITLES_HE = { Instructor: "מדריך", CourseManager: "מרכז קורס", Admin: "אדמין", SystemAdmin: "SysAdmin" };
  const SECTION_ORDER = ["פעילות", "דוחות", "ניהול", "כללי", "System", "Monitoring", "Maintenance"];

  document.addEventListener("DOMContentLoaded", async () => {
    applySavedTheme();
    themeToggle?.addEventListener("click", toggleTheme);
    contentFrame?.addEventListener("load", () => setHeaderPageName(contentFrame.getAttribute("src") || ""));
    logoutBtn?.addEventListener("click", onLogout);
    stopImpersonateBtn?.addEventListener("click", onStopImpersonate);
    startImpersonateBtn?.addEventListener("click", onStartImpersonate);
    goLoginBtn?.addEventListener("click", () => {
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `login-otp.html?returnUrl=${returnUrl}`;
    });

    const meStatus = await getMe();
    if (!meStatus.ok) {
      applyMeToHeader(meStatus);
      const already = sessionStorage.getItem("redirectedToLogin");
      if (!already) {
        sessionStorage.setItem("redirectedToLogin", "1");
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `login-otp.html?returnUrl=${returnUrl}`;
        return;
      }
      showAuthProblem(meStatus);
      renderGuestMenu();
      applyDbToHeader({ ok: null });
      return;
    }

    sessionStorage.removeItem("redirectedToLogin");
    hideAuthProblem();
    applyMeToHeader(meStatus);

    const role = normalizeRole(meStatus.me.roleName);
    menuRoleLine.textContent = `תפקיד: ${role}`;

    try {
      const cfg = MENU_CFG;
      const visibleGroups = getVisibleGroupsForRole(role);
      const effectiveRoles = role === "SystemAdmin" ? ["Instructor","CourseManager","Admin","SystemAdmin"] : [role];
      const allowedItems = (cfg.items || []).filter(it => {
        const rolesOk = Array.isArray(it.roles) && it.roles.some(r => effectiveRoles.includes(r));
        if (!rolesOk) return false;
        const g = normalizeGroup(it.group);
        return visibleGroups.includes(g);
      });
      const start = pickStartPage(cfg, role, allowedItems);
      renderMenuGroupedAccordion(allowedItems, visibleGroups, start);
      navigateTo(start, false);
    } catch(menuErr) {
      console.error("menu render failed:", menuErr);
      menuRoleLine.textContent = `תפקיד: ${role} ⚠ שגיאת תפריט: ${menuErr?.message || menuErr}`;
      try { renderGuestMenu(); } catch {}
    }

    const dbStatus = await getDbStatus();
    applyDbToHeader(dbStatus);
  });

  async function getMe(){
    setSessionStatus("בודק…", "warn");
    try{
      const res = await fetch(API_ME, { credentials:"include", cache:"no-cache" });
      const text = await res.text().catch(()=> "");
      if(!res.ok) return { ok:false, http:res.status, body:text.slice(0,220) };
      return { ok:true, http:res.status, me: safeJson(text) || {} };
    }catch(e){ return { ok:false, http:0, error:String(e?.message||e) }; }
  }

  async function getDbStatus(){
    try{
      const res = await fetch(API_DB, { credentials:"include", cache:"no-cache" });
      const text = await res.text().catch(()=> "");
      if(res.status === 404) return { ok:null, http:404 };
      if(!res.ok) return { ok:false, http:res.status, body:text.slice(0,160) };
      const data = safeJson(text) || {};
      const ok = data.ok === true || data.status === "ok" || data.healthy === true;
      return { ok, http:res.status, data };
    }catch(e){ return { ok:null, http:0, error:String(e?.message||e) }; }
  }

  function applyMeToHeader(st){
    if(st.ok){
      const me = st.me || {};
      userNameEl.textContent = me.fullName || me.email || "מחובר";
      userRoleEl.textContent = me.roleName || "—";
      setSessionStatus("מחובר", "ok");
      if(logoutBtn) logoutBtn.style.display = "inline-block";
      if(me.isImpersonating){
        if(impersonateBanner) { impersonateBanner.style.display = "flex"; }
        if(impersonateName)   { impersonateName.textContent = `${me.fullName || me.email} (${me.roleName})`; }
        if(impersonatePanel)  { impersonatePanel.style.display = "none"; }
      } else {
        if(impersonateBanner) { impersonateBanner.style.display = "none"; }
        const _r = normalizeRole(me.roleName); if(_r === "Admin" || _r === "SystemAdmin") { loadImpersonateUsers(); }
      }
    }else{
      userNameEl.textContent = "לא מחובר";
      userRoleEl.textContent = "—";
      setSessionStatus(`לא מחובר (${st.http ?? "?"})`, "err");
      if(logoutBtn) logoutBtn.style.display = "none";
      if(impersonateBanner) impersonateBanner.style.display = "none";
      if(impersonatePanel)  impersonatePanel.style.display  = "none";
    }
  }

  async function loadImpersonateUsers(){
    try{
      const res = await fetch(API_IMPERSONATE_USERS, { credentials:"include", cache:"no-cache" });
      if(!res.ok) return;
      const users = await res.json();
      if(!impersonateSelect || !impersonatePanel) return;
      impersonateSelect.innerHTML = '<option value="">— בחר משתמש להתחזות —</option>' +
        users.map(u => `<option value="${u.instructorId}">${escapeHtml(u.fullName)} (${escapeHtml(u.roleName)})</option>`).join('');
      impersonatePanel.style.display = "block";
    }catch{}
  }

  async function onStartImpersonate(){
    const id = Number(impersonateSelect?.value || 0);
    if(!id) return;
    try{
      const res = await fetch(API_IMPERSONATE_START, { method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body:JSON.stringify({instructorId:id}) });
      if(!res.ok){ const t = await res.text().catch(()=>""); alert("שגיאה: " + t); return; }
      window.location.reload();
    }catch(e){ alert("שגיאה: " + (e.message||e)); }
  }

  async function onStopImpersonate(){
    try{
      const res = await fetch(API_IMPERSONATE_STOP, { method:"POST", credentials:"include" });
      if(!res.ok){ const t = await res.text().catch(()=>""); alert("שגיאה: " + t); return; }
      window.location.reload();
    }catch(e){ alert("שגיאה: " + (e.message||e)); }
  }
  function setSessionStatus(text, state){
    sessionText.textContent = text;
    sessionDot.classList.remove("ok","err");
    if(state==="ok") sessionDot.classList.add("ok");
    if(state==="err") sessionDot.classList.add("err");
  }
  function applyDbToHeader(st){
    if(st.ok === true){ dbText.textContent = "תקין"; dbDot.classList.remove("err"); dbDot.classList.add("ok"); return; }
    if(st.ok === false){ dbText.textContent = `שגיאה (${st.http ?? "?"})`; dbDot.classList.remove("ok"); dbDot.classList.add("err"); return; }
    dbText.textContent = "לא נבדק"; dbDot.classList.remove("ok","err");
  }
  function setHeaderPageName(pageOrUrl){ pageTextEl.textContent = extractFileName(pageOrUrl); }
  function extractFileName(s){ s=String(s||"").trim(); if(!s) return "—"; const noHash=s.split("#")[0]; const parts=noHash.split("/").filter(Boolean); return parts.pop() || noHash; }
  function showAuthProblem(st){
    const code = st.http ?? "?";
    const extra = st.body ? ` | ${st.body}` : (st.error ? ` | ${st.error}` : "");
    authMsg.textContent = (`אין Session תקף (/api/me=${code}). ${extra}`).slice(0,220);
    authBanner.style.display = "flex";
  }
  function hideAuthProblem(){ authBanner.style.display = "none"; }

  function renderMenuGroupedAccordion(items, visibleGroups, initialPage){
    menuContainer.innerHTML = "";
    const buckets = new Map();
    for(const g of visibleGroups) buckets.set(g, []);
    for(const it of items){
      const g = normalizeGroup(it.group);
      if(!buckets.has(g)) buckets.set(g, []);
      buckets.get(g).push(it);
    }

    const pageGroup = findGroupOfPage(items, initialPage);
    const stored = localStorage.getItem(KEY_OPEN_GROUP);
    let openGroup = pageGroup || stored || "";
    if (openGroup && !visibleGroups.includes(openGroup)) openGroup = "";
    localStorage.setItem(KEY_OPEN_GROUP, openGroup);

    const groupUIs = new Map();

    for(const g of GROUP_ORDER){
      if(!visibleGroups.includes(g)) continue;
      const groupItems = buckets.get(g) || [];
      if(groupItems.length === 0) continue;

      const title = document.createElement("div");
      title.className = "menuGroupTitle";
      title.dataset.group = g;
      title.innerHTML = `
        <div class="right">
          <span class="groupName">${escapeHtml(GROUP_TITLES_HE[g] || g)}</span>
        </div>
        <span class="count">${groupItems.length} פריטים</span>
        <span class="chev">▸</span>`;

      const wrap = document.createElement("div");
      wrap.className = "menuGroupItems";
      wrap.dataset.group = g;

      const sectionMap = new Map();
      groupItems.forEach(it => {
        const sec = normalizeSection(it.section);
        if (!sectionMap.has(sec)) sectionMap.set(sec, []);
        sectionMap.get(sec).push(it);
      });

      for (const sec of SECTION_ORDER) {
        const secItems = sectionMap.get(sec) || [];
        if (!secItems.length) continue;

        const sectionTitle = document.createElement("div");
        sectionTitle.className = "menuSectionTitle";
        sectionTitle.textContent = sec;
        wrap.appendChild(sectionTitle);

        const sectionWrap = document.createElement("div");
        sectionWrap.className = "menuSectionWrap";

        secItems.forEach(it => {
          const el = document.createElement("div");
          el.className = "menuItem";
          el.dataset.page = it.page;
          el.innerHTML = `
            <div class="row1">
              <div class="icon">${buildIconHtml(it.icon)}</div>
              <div class="label">${escapeHtml(it.label || "")}</div>
            </div>`;
          el.addEventListener("click", () => {
            setOpenGroup(g, groupUIs, true);
            navigateTo(it.page, true);
          });
          sectionWrap.appendChild(el);
        });
        wrap.appendChild(sectionWrap);
      }

      const divider = document.createElement("div");
      divider.className = "menuGroupDivider";
      title.addEventListener("click", () => setOpenGroup(g, groupUIs));
      menuContainer.appendChild(title);
      menuContainer.appendChild(wrap);
      menuContainer.appendChild(divider);
      groupUIs.set(g, { title, wrap });
    }

    if (openGroup) {
      setOpenGroup(openGroup, groupUIs, true);
    } else {
      groupUIs.forEach((ui) => {
        ui.title.classList.remove("open");
        ui.wrap.classList.remove("open");
      });
    }
    markActive(initialPage);
  }

  function buildIconHtml(icon){
    const name = String(icon || '').trim();
    if (!name) return `<img src="${ICON_BASE}dashboard.svg" alt="" class="menuSvg">`;
    if (/[<>]/.test(name)) return name;
    if (/\.(svg|png|jpg|jpeg|webp)$/i.test(name)) return `<img src="${ICON_BASE}${name}" alt="" class="menuSvg">`;
    if (name.length <= 3 && /[^a-z0-9_-]/i.test(name)) return escapeHtml(name);
    return `<img src="${ICON_BASE}${name}.svg" alt="" class="menuSvg">`;
  }

  function setOpenGroup(groupKey, groupUIs, forceOpen = null){
    const currentOpen = localStorage.getItem(KEY_OPEN_GROUP) || "";
    const nextOpen =
      forceOpen === true ? groupKey :
      forceOpen === false ? "" :
      (currentOpen === groupKey ? "" : groupKey);

    localStorage.setItem(KEY_OPEN_GROUP, nextOpen);

    groupUIs.forEach((ui, g) => {
      const isOpen = (g === nextOpen);
      ui.title.classList.toggle("open", isOpen);
      ui.wrap.classList.toggle("open", isOpen);
    });
  }
  function findGroupOfPage(items, page){ const it = items.find(x => x.page === page); return it ? normalizeGroup(it.group) : null; }
  function markActive(page){ document.querySelectorAll(".menuItem").forEach(el => el.classList.toggle("active", el.dataset.page === page)); }
  function pickStartPage(cfg, role, allowedItems){
    const allowedPages = new Set(allowedItems.map(x=>x.page));
    const last = localStorage.getItem(KEY_LAST_PAGE);
    const roleDefault = (cfg.defaults && cfg.defaults[role]) ? cfg.defaults[role] : "help.html";
    if(last && allowedPages.has(last)) return last;
    if(allowedPages.has(roleDefault)) return roleDefault;
    if(allowedPages.has("help.html")) return "help.html";
    return allowedItems[0]?.page || "help.html";
  }
  const _NAV_V = Date.now();
  function navigateTo(page, save){ if(!page) return; markActive(page); const sep=page.includes('?')?'&':'?'; contentFrame.src = page+sep+'_v='+_NAV_V; setHeaderPageName(page); if(save) localStorage.setItem(KEY_LAST_PAGE, page); }
  function renderGuestMenu(){
    menuRoleLine.textContent = "תפקיד: Guest";
    menuContainer.innerHTML = "";
    const title = document.createElement("div");
    title.className = "menuGroupTitle open";
    title.innerHTML = `<div class="right"><span class="groupName">גישה מוגבלת</span></div><span class="count">1 פריטים</span><span class="chev">▸</span>`;
    const wrap = document.createElement("div");
    wrap.className = "menuGroupItems open";
    const sectionTitle = document.createElement("div");
    sectionTitle.className = "menuSectionTitle";
    sectionTitle.textContent = "כללי";
    const sectionWrap = document.createElement("div");
    sectionWrap.className = "menuSectionWrap";
    const el = document.createElement("div");
    el.className = "menuItem active";
    el.dataset.page = "help.html";
    el.innerHTML = `<div class="row1"><div class="icon">${buildIconHtml('help')}</div><div class="label">עזרה</div></div>`;
    el.addEventListener("click", () => navigateTo("help.html", false));
    sectionWrap.appendChild(el);
    wrap.appendChild(sectionTitle);
    wrap.appendChild(sectionWrap);
    menuContainer.appendChild(title);
    menuContainer.appendChild(wrap);
  }

  async function onLogout(){ if(!confirm("להתנתק מהמערכת?")) return; try{ await fetch(API_LOGOUT, { method:"POST", credentials:"include" }); }catch{} localStorage.removeItem(KEY_LAST_PAGE); sessionStorage.clear(); window.location.href = "login-otp.html"; }
  function normalizeRole(roleName){ const r = String(roleName || "").trim().toLowerCase(); if(r === "instructor" || r === "מדריך") return "Instructor"; if(r === "coursemanager" || r === "course manager" || r === "מרכז קורס" || r === "רכז קורס") return "CourseManager"; if(r === "admin" || r === "אדמין" || r === "מנהל" || r === "מנהל מערכת") return "Admin"; if(r === "systemadmin" || r === "sysadmin") return "SystemAdmin"; return "Instructor"; }
  function getVisibleGroupsForRole(role){ if(role === "Instructor") return ["Instructor"]; if(role === "CourseManager") return ["Instructor","CourseManager"]; if(role === "SystemAdmin") return ["Instructor","CourseManager","Admin","SystemAdmin"]; return ["Instructor","CourseManager","Admin"]; }
  function normalizeGroup(group){ const g = String(group || "").trim(); if(!g) return "Instructor"; const gl = g.toLowerCase(); if(gl === "instructor" || gl === "מדריך") return "Instructor"; if(gl === "coursemanager" || gl === "course manager" || gl === "מרכז קורס" || gl === "רכז קורס") return "CourseManager"; if(gl === "admin" || gl === "אדמין") return "Admin"; if(gl === "systemadmin") return "SystemAdmin"; return "Admin"; }
  function normalizeSection(section){ const s = String(section || '').trim(); if (!s) return 'כללי'; if (SECTION_ORDER.includes(s)) return s; return 'כללי'; }
  function applySavedTheme(){ const v = localStorage.getItem(KEY_THEME) || "light"; document.documentElement.setAttribute("data-theme", v); if(themeToggle) themeToggle.textContent = (v === "dark") ? "☀️" : "🌙"; }
  function toggleTheme(){ const cur = document.documentElement.getAttribute("data-theme") || "light"; const next = (cur === "dark") ? "light" : "dark"; document.documentElement.setAttribute("data-theme", next); localStorage.setItem(KEY_THEME, next); if(themeToggle) themeToggle.textContent = (next === "dark") ? "☀️" : "🌙"; try{ contentFrame?.contentWindow?.postMessage({type:"theme",value:next},"*"); }catch(e){} }
  async function fetchJsonNoCache(url){ const res = await fetch(url + "?ts=" + Date.now(), { cache:"no-cache" }); if(!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`); return res.json(); }
  function safeJson(t){ try{ return JSON.parse(t); }catch{ return null; } }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
})();
(() => {
  "use strict";

  const baseDir = window.location.pathname.replace(/\/[^\/]*$/, "");

  const API_ME     = `${baseDir}/api/me`;
  const API_LOGOUT = `${baseDir}/api/auth/logout`;
  const API_DB     = `${baseDir}/api/health/db`;
  const MENU_JSON  = `${baseDir}/config/menu.json`;

  // storage keys
  const KEY_THEME = "theme";
  const KEY_LAST_PAGE = "lastPage";
  const KEY_OPEN_GROUP = "menuOpenGroup"; // "Instructor" / "CourseManager" / "Admin"

  // DOM
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

  const GROUP_ORDER = ["Instructor", "CourseManager", "Admin"];
  const GROUP_TITLES_HE = {
    Instructor: "מדריך",
    CourseManager: "מרכז קורס",
    Admin: "אדמין"
  };

  document.addEventListener("DOMContentLoaded", async () => {
    // Theme
    applySavedTheme();
    themeToggle.addEventListener("click", toggleTheme);

    // iframe -> header page label
    contentFrame.addEventListener("load", () => {
      setHeaderPageName(contentFrame.getAttribute("src") || "");
    });

    logoutBtn.addEventListener("click", onLogout);

    goLoginBtn.addEventListener("click", () => {
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `login-otp.html?returnUrl=${returnUrl}`;
    });

    // default
    navigateTo("help.html", false);

    // Session
    const meStatus = await getMe();

    if (!meStatus.ok) {
      applyMeToHeader(meStatus);

      // prevent infinite loop: redirect only once per session
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

    // Load menu.json
    const cfg = await fetchJsonNoCache(MENU_JSON);
    const visibleGroups = getVisibleGroupsForRole(role);

    // Filter items by role + visible groups
    const allowedItems = (cfg.items || []).filter(it => {
      const rolesOk = Array.isArray(it.roles) && it.roles.includes(role);
      if (!rolesOk) return false;
      const g = normalizeGroup(it.group);
      return visibleGroups.includes(g);
    });

    // pick start page
    const start = pickStartPage(cfg, role, allowedItems);

    // render menu grouped + accordion
    renderMenuGroupedAccordion(allowedItems, visibleGroups, start);

    // navigate
    navigateTo(start, false);

    // DB
    const dbStatus = await getDbStatus();
    applyDbToHeader(dbStatus);
  });

  // ---------- API ----------
  async function getMe(){
    setSessionStatus("בודק…", "warn");
    try{
      const res = await fetch(API_ME, { credentials:"include", cache:"no-cache" });
      const text = await res.text().catch(()=> "");
      if(!res.ok) return { ok:false, http:res.status, body:text.slice(0,220) };
      return { ok:true, http:res.status, me: safeJson(text) || {} };
    }catch(e){
      return { ok:false, http:0, error:String(e?.message||e) };
    }
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
    }catch(e){
      return { ok:null, http:0, error:String(e?.message||e) };
    }
  }

  // ---------- HEADER ----------
  function applyMeToHeader(st){
    if(st.ok){
      const me = st.me || {};
      userNameEl.textContent = me.fullName || me.email || "מחובר";
      userRoleEl.textContent = me.roleName || "—";
      setSessionStatus("מחובר", "ok");
      logoutBtn.style.display = "inline-block";
    }else{
      userNameEl.textContent = "לא מחובר";
      userRoleEl.textContent = "—";
      setSessionStatus(`לא מחובר (${st.http ?? "?"})`, "err");
      logoutBtn.style.display = "none";
    }
  }

  function setSessionStatus(text, state){
    sessionText.textContent = text;
    sessionDot.classList.remove("ok","err");
    if(state==="ok") sessionDot.classList.add("ok");
    if(state==="err") sessionDot.classList.add("err");
  }

  function applyDbToHeader(st){
    if(st.ok === true){
      dbText.textContent = "תקין";
      dbDot.classList.remove("err");
      dbDot.classList.add("ok");
      return;
    }
    if(st.ok === false){
      dbText.textContent = `שגיאה (${st.http ?? "?"})`;
      dbDot.classList.remove("ok");
      dbDot.classList.add("err");
      return;
    }
    dbText.textContent = "לא נבדק";
    dbDot.classList.remove("ok","err");
  }

  function setHeaderPageName(pageOrUrl){
    pageTextEl.textContent = extractFileName(pageOrUrl);
  }

  function extractFileName(s){
    s = String(s||"").trim();
    if(!s) return "—";
    const noHash = s.split("#")[0];
    const parts = noHash.split("/").filter(Boolean);
    return parts.pop() || noHash;
  }

  // ---------- AUTH banner ----------
  function showAuthProblem(st){
    const code = st.http ?? "?";
    const extra = st.body ? ` | ${st.body}` : (st.error ? ` | ${st.error}` : "");
    authMsg.textContent = (`אין Session תקף (/api/me=${code}). ${extra}`).slice(0,220);
    authBanner.style.display = "flex";
  }
  function hideAuthProblem(){ authBanner.style.display = "none"; }

  // ---------- MENU (Grouped + Accordion upgrades) ----------
  function renderMenuGroupedAccordion(items, visibleGroups, initialPage){
    menuContainer.innerHTML = "";

    // bucket by group
    const buckets = new Map();
    for(const g of visibleGroups) buckets.set(g, []);
    for(const it of items){
      const g = normalizeGroup(it.group);
      if(!buckets.has(g)) buckets.set(g, []);
      buckets.get(g).push(it);
    }

    // determine which group should open:
    // 1) group of initialPage
    // 2) localStorage
    // 3) first visible group
    const pageGroup = findGroupOfPage(items, initialPage);
    const stored = localStorage.getItem(KEY_OPEN_GROUP);
    let openGroup = pageGroup || stored || visibleGroups[0] || "Instructor";

    // if stored not visible, fallback
    if (!visibleGroups.includes(openGroup)) openGroup = visibleGroups[0] || "Instructor";
    localStorage.setItem(KEY_OPEN_GROUP, openGroup);

    // keep references to group wrappers for true accordion behavior
    const groupUIs = new Map();

    for(const g of GROUP_ORDER){
      if(!visibleGroups.includes(g)) continue;

      const groupItems = buckets.get(g) || [];
      if(groupItems.length === 0) continue;

      // Title
      const title = document.createElement("div");
      title.className = "menuGroupTitle";
      title.dataset.group = g;

      const titleRight = document.createElement("div");
      titleRight.className = "right";
      titleRight.innerHTML = `<span>${escapeHtml(GROUP_TITLES_HE[g] || g)}</span>`;

      const count = document.createElement("span");
      count.className = "count";
      count.textContent = `${groupItems.length} פריטים`;

      const chev = document.createElement("span");
      chev.className = "chev";
      chev.textContent = "▸";

      title.appendChild(titleRight);
      title.appendChild(count);
      title.appendChild(chev);

      // Items wrap
      const wrap = document.createElement("div");
      wrap.className = "menuGroupItems";
      wrap.dataset.group = g;

      groupItems.forEach(it=>{
        const el = document.createElement("div");
        el.className = "menuItem";
        el.dataset.page = it.page;

        // ✅ אין row2 / אין שם קובץ פיזי
        el.innerHTML = `
          <div class="row1">
            <div class="icon">${escapeHtml(it.icon || "")}</div>
            <div class="label">${escapeHtml(it.label || "")}</div>
          </div>
        `;

        el.addEventListener("click", () => {
          // when clicking item, also open its group (and close others)
          setOpenGroup(g, groupUIs);
          navigateTo(it.page, true);
        });

        wrap.appendChild(el);
      });

      // divider
      const divider = document.createElement("div");
      divider.className = "menuGroupDivider";

      // title click => accordion open/close this group (true accordion)
      title.addEventListener("click", () => {
        const currentlyOpen = (localStorage.getItem(KEY_OPEN_GROUP) === g);
        if (currentlyOpen) {
          // allow closing all? -> we'll keep at least one open: re-open same
          setOpenGroup(g, groupUIs);
        } else {
          setOpenGroup(g, groupUIs);
        }
      });

      menuContainer.appendChild(title);
      menuContainer.appendChild(wrap);
      menuContainer.appendChild(divider);

      groupUIs.set(g, { title, wrap });
    }

    // apply open state
    setOpenGroup(openGroup, groupUIs);

    // mark active item (if any)
    markActive(initialPage);
  }

  function setOpenGroup(groupKey, groupUIs){
    localStorage.setItem(KEY_OPEN_GROUP, groupKey);

    groupUIs.forEach((ui, g) => {
      const isOpen = (g === groupKey);

      ui.title.classList.toggle("open", isOpen);
      ui.wrap.classList.toggle("open", isOpen);

      // chevron icon: we rotate via CSS class open, but keep symbol consistent
      const chev = ui.title.querySelector(".chev");
      if (chev) chev.textContent = "▸";
    });
  }

  function findGroupOfPage(items, page){
    const it = items.find(x => x.page === page);
    return it ? normalizeGroup(it.group) : null;
  }

  function markActive(page){
    document.querySelectorAll(".menuItem").forEach(el =>
      el.classList.toggle("active", el.dataset.page === page)
    );
  }

  function pickStartPage(cfg, role, allowedItems){
    const allowedPages = new Set(allowedItems.map(x=>x.page));
    const last = localStorage.getItem(KEY_LAST_PAGE);
    const roleDefault = (cfg.defaults && cfg.defaults[role]) ? cfg.defaults[role] : "help.html";

    if(last && allowedPages.has(last)) return last;
    if(allowedPages.has(roleDefault)) return roleDefault;
    if(allowedPages.has("help.html")) return "help.html";
    return allowedItems[0]?.page || "help.html";
  }

  function navigateTo(page, save){
    if(!page) return;

    markActive(page);
    contentFrame.src = page;
    setHeaderPageName(page);

    if(save) localStorage.setItem(KEY_LAST_PAGE, page);

    // also ensure the group of the page is open
    // (the next render will do it too, but this helps live)
    // we can't directly open here without groupUIs, so rely on click handlers + initial render.
  }

  function renderGuestMenu(){
    menuRoleLine.textContent = "תפקיד: Guest";
    menuContainer.innerHTML = "";

    const title = document.createElement("div");
    title.className = "menuGroupTitle open";
    title.innerHTML = `<div class="right"><span>גישה מוגבלת</span></div><span class="count">1 פריטים</span><span class="chev">▸</span>`;

    const wrap = document.createElement("div");
    wrap.className = "menuGroupItems open";

    const el = document.createElement("div");
    el.className = "menuItem active";
    el.dataset.page = "help.html";
    el.innerHTML = `
      <div class="row1">
        <div class="icon">❓</div>
        <div class="label">עזרה</div>
      </div>
    `;
    el.addEventListener("click", () => navigateTo("help.html", false));

    wrap.appendChild(el);

    menuContainer.appendChild(title);
    menuContainer.appendChild(wrap);
  }

  // ---------- LOGOUT ----------
  async function onLogout(){
    if(!confirm("להתנתק מהמערכת?")) return;
    try{ await fetch(API_LOGOUT, { method:"POST", credentials:"include" }); }catch{}
    localStorage.removeItem(KEY_LAST_PAGE);
    sessionStorage.clear();
    window.location.href = "login-otp.html";
  }

  // ---------- Role / Group rules ----------
  function normalizeRole(roleName){
    const r = String(roleName || "").trim().toLowerCase();

    if(r === "instructor" || r === "מדריך") return "Instructor";
    if(r === "coursemanager" || r === "course manager" || r === "מרכז קורס" || r === "רכז קורס") return "CourseManager";
    if(r === "admin" || r === "אדמין" || r === "מנהל" || r === "מנהל מערכת") return "Admin";

    return "Instructor";
  }

  // בדיוק לפי הדרישה שלך:
  function getVisibleGroupsForRole(role){
    if(role === "Instructor") return ["Instructor"];
    if(role === "CourseManager") return ["Instructor","CourseManager"];
    return ["Instructor","CourseManager","Admin"];
  }

  function normalizeGroup(group){
    const g = String(group || "").trim();
    if(!g) return "Instructor";
    const gl = g.toLowerCase();
    if(gl === "instructor" || gl === "מדריך") return "Instructor";
    if(gl === "coursemanager" || gl === "course manager" || gl === "מרכז קורס" || gl === "רכז קורס") return "CourseManager";
    if(gl === "admin" || gl === "אדמין") return "Admin";
    return "Admin"; // בטוח – שלא יופיע למדריך בטעות
  }

  // ---------- Theme ----------
  function applySavedTheme(){
    const v = localStorage.getItem(KEY_THEME) || "light";
    document.documentElement.setAttribute("data-theme", v);
    themeToggle.textContent = (v === "dark") ? "☀️" : "🌙";
  }
  function toggleTheme(){
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    const next = (cur === "dark") ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(KEY_THEME, next);
    themeToggle.textContent = (next === "dark") ? "☀️" : "🌙";
  }

  // ---------- Helpers ----------
  async function fetchJsonNoCache(url){
    const res = await fetch(url + "?ts=" + Date.now(), { cache:"no-cache" });
    if(!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return res.json();
  }
  function safeJson(t){ try{ return JSON.parse(t); }catch{ return null; } }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
})();

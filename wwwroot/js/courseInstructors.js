// js/instructorsCourses.js
// ייעוד: הצגת כלל המדריכים + ההסמכות שלהם לקורסים (בחלוקה לפי Activity Type),
// כולל עריכה (הוספה/הסרה) ושמירה.
// עובד עם ה-endpoints (אצלך זה api/api):
//   GET  {baseDir}/api/api/courses
//   GET  {baseDir}/api/api/instructors
//   GET  {baseDir}/api/api/activity-types
//   GET  {baseDir}/api/api/course-instructors/{courseId}   -> [instructorIds]
//   PUT  {baseDir}/api/api/course-instructors/{courseId}   -> { instructorIds: [...] }

(() => {
    "use strict";
  
    // baseDir כמו ב-app.js (התיקייה שבה יושב ה-HTML)
    const baseDir = window.location.pathname.replace(/\/[^\/]*$/, "");
  
    // אצלך עובד /api/api/*
    const API = (path) => `${baseDir}/api/api/${path}`;
  
    const COURSES_API = API("courses");
    const INSTRUCTORS_API = API("instructors");
    const ACTIVITY_TYPES_API = API("activity-types");
    const COURSE_INSTRUCTORS_API = API("course-instructors"); // + /{courseId}
  
    // DOM
    const elGrid = document.getElementById("grid");
    const elStatus = document.getElementById("status");
    const elCounters = document.getElementById("counters");
    const elQ = document.getElementById("q");
    const btnRefresh = document.getElementById("btnRefresh");
  
    // modal
    const backdrop = document.getElementById("backdrop");
    const btnClose = document.getElementById("btnClose");
    const btnCancel = document.getElementById("btnCancel");
    const btnSave = document.getElementById("btnSave");
    const modalTitle = document.getElementById("modalTitle");
    const modalSub = document.getElementById("modalSub");
    const modalMsg = document.getElementById("modalMsg");
    const coursesBox = document.getElementById("coursesBox");
    const courseFilter = document.getElementById("courseFilter");
    const btnSelectAllCourses = document.getElementById("btnSelectAllCourses");
    const btnClearAllCourses = document.getElementById("btnClearAllCourses");
  
    // Data
    let courses = [];
    let instructors = [];
    let activityTypes = [];
    let activityTypeNameById = new Map(); // activityTypeId -> typeName
  
    // courseId -> Set(instructorId)
    let courseToInstructorIds = new Map();
  
    // instructorId -> Set(courseId)
    let instructorToCourseIds = new Map();
  
    // Modal state
    let activeInstructor = null;      // { id, fullName, email }
    let stagedCourseIds = new Set();  // מה שסימנו במודל
    let dirtyCourseIds = new Set();   // אילו קורסים הושפעו (צריך PUT)
  
    init();
  
    async function init() {
      wireEvents();
      await refreshAll();
    }
  
    function wireEvents() {
      btnRefresh?.addEventListener("click", refreshAll);
      elQ?.addEventListener("input", render);
  
      btnClose?.addEventListener("click", closeModal);
      btnCancel?.addEventListener("click", closeModal);
  
      courseFilter?.addEventListener("input", renderCoursesInModal);
  
      btnSelectAllCourses?.addEventListener("click", () => {
        const f = (courseFilter.value || "").toLowerCase().trim();
        courses.forEach((c) => {
          const txt = courseDisplay(c).toLowerCase();
          if (!f || txt.includes(f)) stagedCourseIds.add(getCourseId(c));
        });
        renderCoursesInModal();
      });
  
      btnClearAllCourses?.addEventListener("click", () => {
        const f = (courseFilter.value || "").toLowerCase().trim();
        courses.forEach((c) => {
          const txt = courseDisplay(c).toLowerCase();
          if (!f || txt.includes(f)) stagedCourseIds.delete(getCourseId(c));
        });
        renderCoursesInModal();
      });
  
      btnSave?.addEventListener("click", saveInstructorCertifications);
  
      // סגירה בלחיצה על רקע
      backdrop?.addEventListener("click", (e) => {
        if (e.target === backdrop) closeModal();
      });
    }
  
    // =========================
    // LOAD
    // =========================
  
    async function refreshAll() {
      setStatus("טוען קורסים, מדריכים וסוגי פעילות…", false);
  
      courses = [];
      instructors = [];
      activityTypes = [];
      activityTypeNameById.clear();
      courseToInstructorIds.clear();
      instructorToCourseIds.clear();
  
      try {
        const [cs, ins, ats] = await Promise.all([
          fetchJson(COURSES_API),
          fetchJson(INSTRUCTORS_API),
          fetchJson(ACTIVITY_TYPES_API),
        ]);
  
        courses = Array.isArray(cs) ? cs : [];
        instructors = Array.isArray(ins) ? ins : [];
        activityTypes = Array.isArray(ats) ? ats : [];
  
        activityTypeNameById = new Map(
          activityTypes.map((a) => [getActivityTypeId(a), getActivityTypeName(a)])
        );
  
        setStatus("טוען שיוכים לכל הקורסים…", false);
        await loadAllCourseAssignments();  // courseId -> instructorIds
  
        rebuildInstructorMap();            // instructorId -> courseIds
        setStatus("נטען בהצלחה.", false, "ok");
  
        render();
      } catch (e) {
        console.error(e);
        setStatus("שגיאה בטעינה: " + (e?.message || e), true);
      }
    }
  
    async function loadAllCourseAssignments() {
      for (let i = 0; i < courses.length; i++) {
        const c = courses[i];
        const courseId = getCourseId(c);
        setStatus(`טוען שיוכים… (${i + 1}/${courses.length})`, false);
  
        const ids = await fetchJson(`${COURSE_INSTRUCTORS_API}/${encodeURIComponent(courseId)}`);
        courseToInstructorIds.set(courseId, new Set(Array.isArray(ids) ? ids : []));
      }
    }
  
    function rebuildInstructorMap() {
      instructorToCourseIds.clear();
  
      // init empty
      instructors.forEach((inst) => instructorToCourseIds.set(getInstructorId(inst), new Set()));
  
      for (const [courseId, instSet] of courseToInstructorIds.entries()) {
        for (const instId of instSet.values()) {
          if (!instructorToCourseIds.has(instId)) instructorToCourseIds.set(instId, new Set());
          instructorToCourseIds.get(instId).add(courseId);
        }
      }
    }
  
    // =========================
    // RENDER LIST (Instructor cards)
    // =========================
  
    function render() {
      const q = (elQ.value || "").toLowerCase().trim();
  
      const filtered = instructors
        .map((inst) => normalizeInstructor(inst))
        .filter((inst) => {
          if (!q) return true;
          return inst.fullName.toLowerCase().includes(q) || inst.email.toLowerCase().includes(q);
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "he"));
  
      const totalCerts = Array.from(instructorToCourseIds.values()).reduce(
        (sum, s) => sum + (s?.size || 0),
        0
      );
  
      elCounters.textContent = `מדריכים: ${instructors.length} · מוצגים: ${filtered.length} · סה"כ הסמכות: ${totalCerts}`;
  
      elGrid.innerHTML = "";
  
      filtered.forEach((inst) => {
        const card = document.createElement("div");
        card.className = "instCard";
  
        const top = document.createElement("div");
        top.className = "instTop";
  
        const left = document.createElement("div");
        left.innerHTML = `
          <div class="name">${escapeHtml(inst.fullName || "(ללא שם)")}</div>
          <div class="email">${escapeHtml(inst.email || "")}</div>
        `;
  
        const right = document.createElement("div");
        const btn = document.createElement("button");
        btn.className = "primary";
        btn.type = "button";
        btn.textContent = "✏️ ערוך הסמכות";
        btn.addEventListener("click", () => openModalForInstructor(inst));
        right.appendChild(btn);
  
        top.appendChild(left);
        top.appendChild(right);
  
        // הסמכות בחלוקה לפי ActivityType
        const badges = document.createElement("div");
        badges.className = "badges";
  
        const courseIds = instructorToCourseIds.get(inst.id) || new Set();
        const courseObjs = Array.from(courseIds)
          .map((cid) => courses.find((c) => getCourseId(c) === cid))
          .filter(Boolean);
  
        if (courseObjs.length === 0) {
          const chip = document.createElement("span");
          chip.className = "chip muted";
          chip.textContent = "אין הסמכות";
          badges.appendChild(chip);
        } else {
          const groups = groupCoursesByActivityType(courseObjs); // { typeName: [courses...] }
          const groupNames = Object.keys(groups).sort((a, b) => a.localeCompare(b, "he"));
  
          groupNames.forEach((typeName) => {
            // "כותרת" קבוצה
            const titleChip = document.createElement("span");
            titleChip.className = "chip muted";
            titleChip.textContent = typeName;
            badges.appendChild(titleChip);
  
            const list = groups[typeName]
              .sort((a, b) => courseDisplay(a).localeCompare(courseDisplay(b), "he"));
  
            // כדי לא להעמיס: עד 6 צ'יפים + "עוד"
            const show = list.slice(0, 6);
            show.forEach((c) => {
              const chip = document.createElement("span");
              chip.className = "chip";
              chip.textContent = courseShort(c);
              badges.appendChild(chip);
            });
  
            if (list.length > 6) {
              const more = document.createElement("span");
              more.className = "chip muted";
              more.textContent = `+${list.length - 6} נוספים`;
              badges.appendChild(more);
            }
          });
        }
  
        card.appendChild(top);
        card.appendChild(badges);
        elGrid.appendChild(card);
      });
    }
  
    function groupCoursesByActivityType(courseList) {
      const out = {};
      for (const c of courseList) {
        const typeId = getCourseActivityTypeId(c);
        const typeName = activityTypeNameById.get(typeId) || `ActivityType ${typeId ?? "?"}`;
        if (!out[typeName]) out[typeName] = [];
        out[typeName].push(c);
      }
      return out;
    }
  
    // =========================
    // MODAL (Edit certifications)
    // =========================
  
    function openModalForInstructor(inst) {
      activeInstructor = inst;
  
      modalTitle.textContent = `עריכת הסמכות: ${inst.fullName || inst.email || ""}`;
      modalSub.textContent = inst.email || "";
      modalMsg.textContent = "";
      modalMsg.className = "msg";
  
      // העתקה לשלב עריכה
      const current = instructorToCourseIds.get(inst.id) || new Set();
      stagedCourseIds = new Set(Array.from(current));
      dirtyCourseIds = new Set();
  
      courseFilter.value = "";
      renderCoursesInModal();
  
      backdrop.style.display = "flex";
      backdrop.setAttribute("aria-hidden", "false");
    }
  
    function closeModal() {
      backdrop.style.display = "none";
      backdrop.setAttribute("aria-hidden", "true");
      activeInstructor = null;
      stagedCourseIds = new Set();
      dirtyCourseIds = new Set();
      modalMsg.textContent = "";
    }
  
    // חובה לפי הבקשה: גם במסך העריכה — חלוקה לפי ActivityType
    function renderCoursesInModal() {
      const f = (courseFilter.value || "").toLowerCase().trim();
      coursesBox.innerHTML = "";
  
      // קיבוץ לפי ActivityType
      const grouped = {};
      for (const c of courses) {
        const txt = courseDisplay(c);
        if (f && !txt.toLowerCase().includes(f)) continue;
  
        const typeId = getCourseActivityTypeId(c);
        const typeName = activityTypeNameById.get(typeId) || `ActivityType ${typeId ?? "?"}`;
        if (!grouped[typeName]) grouped[typeName] = [];
        grouped[typeName].push(c);
      }
  
      const groupNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "he"));
  
      for (const typeName of groupNames) {
        // Header של קבוצה
        const header = document.createElement("div");
        header.className = "courseRow";
        header.style.background = "#eef2ff";
        header.style.borderRadius = "10px";
        header.style.margin = "8px 4px";
        header.style.borderBottom = "none";
        header.innerHTML = `<div class="courseName">${escapeHtml(typeName)}</div><div class="small"></div>`;
        coursesBox.appendChild(header);
  
        // קורסים בתוך הקבוצה
        const list = grouped[typeName].sort((a, b) => courseDisplay(a).localeCompare(bDisplay(b), "he"));
  
        for (const c of list) {
          const cid = getCourseId(c);
  
          const row = document.createElement("div");
          row.className = "courseRow";
  
          const left = document.createElement("div");
          left.innerHTML = `
            <div class="courseName">${escapeHtml(courseDisplay(c))}</div>
            <div class="courseMeta">${escapeHtml(courseFileHint(c))}</div>
          `;
  
          const right = document.createElement("div");
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = stagedCourseIds.has(cid);
  
          cb.addEventListener("change", () => {
            const before = stagedCourseIds.has(cid);
            if (cb.checked) stagedCourseIds.add(cid);
            else stagedCourseIds.delete(cid);
  
            const after = stagedCourseIds.has(cid);
            if (before !== after) dirtyCourseIds.add(cid);
          });
  
          right.appendChild(cb);
          row.appendChild(left);
          row.appendChild(right);
          coursesBox.appendChild(row);
        }
      }
  
      function bDisplay(x) { return courseDisplay(x); } // small helper for localeCompare line readability
    }
  
    async function saveInstructorCertifications() {
      if (!activeInstructor) return;
  
      btnSave.disabled = true;
      modalMsg.textContent = "שומר…";
      modalMsg.className = "msg";
  
      try {
        const instId = activeInstructor.id;
  
        if (dirtyCourseIds.size === 0) {
          modalMsg.textContent = "אין שינויים לשמירה.";
          modalMsg.className = "msg ok";
          btnSave.disabled = false;
          return;
        }
  
        let done = 0;
  
        for (const courseId of dirtyCourseIds.values()) {
          const set = courseToInstructorIds.get(courseId) || new Set();
  
          if (stagedCourseIds.has(courseId)) set.add(instId);
          else set.delete(instId);
  
          await putJson(`${COURSE_INSTRUCTORS_API}/${encodeURIComponent(courseId)}`, {
            instructorIds: Array.from(set),
          });
  
          courseToInstructorIds.set(courseId, set);
  
          done++;
          modalMsg.textContent = `שומר… (${done}/${dirtyCourseIds.size})`;
        }
  
        rebuildInstructorMap();
        render();
  
        modalMsg.textContent = "נשמר בהצלחה.";
        modalMsg.className = "msg ok";
  
        closeModal();
      } catch (e) {
        console.error(e);
        modalMsg.textContent = "שגיאה בשמירה: " + (e?.message || e);
        modalMsg.className = "msg error";
      } finally {
        btnSave.disabled = false;
      }
    }
  
    // =========================
    // Helpers (DTO mapping)
    // =========================
  
    function normalizeInstructor(inst) {
      const id = getInstructorId(inst);
      const fullName =
        inst.fullName ??
        inst.FullName ??
        ((inst.firstName ?? inst.FirstName ?? "") + " " + (inst.lastName ?? inst.LastName ?? "")).trim();
      const email = inst.email ?? inst.Email ?? "";
      return { id, fullName: fullName || email || "", email };
    }
  
    function getCourseId(c) {
      return c.id ?? c.courseId ?? c.CourseId;
    }
  
    function getInstructorId(i) {
      return i.id ?? i.instructorId ?? i.InstructorId;
    }
  
    function getCourseActivityTypeId(c) {
      return c.activityTypeId ?? c.ActivityTypeId ?? null;
    }
  
    function getActivityTypeId(a) {
      return a.activityTypeId ?? a.ActivityTypeId ?? a.id ?? a.Id;
    }
  
    function getActivityTypeName(a) {
      return a.typeName ?? a.TypeName ?? a.name ?? a.Name ?? "";
    }
  
    function courseDisplay(c) {
      // אם אצלך יש Provider/Department וכו' אפשר להוסיף פה
      const provider = c.provider ?? c.Provider ?? "";
      const name = c.courseName ?? c.CourseName ?? "";
      return (provider ? provider + " - " : "") + name;
    }
  
    function courseShort(c) {
      const provider = c.provider ?? c.Provider ?? "";
      const name = c.courseName ?? c.CourseName ?? "";
      return provider ? `${provider}: ${name}` : name;
    }
  
    function courseFileHint(c) {
      const id = getCourseId(c);
      const typeId = getCourseActivityTypeId(c);
      const typeName = activityTypeNameById.get(typeId) || `ActivityType ${typeId ?? "?"}`;
      return `CourseId=${id} · ${typeName}`;
    }
  
    // =========================
    // Network
    // =========================
  
    async function fetchJson(url) {
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        cache: "no-cache",
        headers: { Accept: "application/json" },
      });
  
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`GET ${url} -> ${res.status} ${t.slice(0, 200)}`);
      }
      return res.json();
    }
  
    async function putJson(url, body) {
      const res = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
  
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`PUT ${url} -> ${res.status} ${t.slice(0, 200)}`);
      }
    }
  
    // =========================
    // UI status helpers
    // =========================
  
    function setStatus(text, isError, cls) {
      elStatus.textContent = text;
      elStatus.className = "msg" + (isError ? " error" : cls === "ok" ? " ok" : "");
    }
  
    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c]));
    }
  })();
  
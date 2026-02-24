// בסיס ל-API – נחשב דינמית לפי מיקום הדף
const APP_PATH = new URL(".", window.location.href).pathname;
const API_BASE = `${window.location.origin}${APP_PATH}api`;

let occurrences = []; // מערך מופעים בזיכרון

document.addEventListener("DOMContentLoaded", initPage);

async function initPage() {
    const selType       = document.getElementById("activityType");
    const selCourse     = document.getElementById("course");
    const selInstructor = document.getElementById("instructor");

    const btnPreview        = document.getElementById("btnPreview");
    const btnClearInstances = document.getElementById("btnClearInstances");
    const btnSave           = document.getElementById("btnSave");
    const chkMulti          = document.getElementById("multiPerWeek");
    const startDateInput    = document.getElementById("startDate");

    // טריגרים
    selType.addEventListener("change", loadCourses);
    selCourse.addEventListener("change", loadInstructors);
    btnPreview.addEventListener("click", buildOccurrences);
    btnClearInstances.addEventListener("click", clearOccurrences);
    btnSave.addEventListener("click", saveActivityAndInstances);

    // שינוי מצב "מספר מופעים באותו שבוע"
    chkMulti.addEventListener("change", () => {
        const panel = document.getElementById("multiDaysPanel");
        const checked = chkMulti.checked;
        panel.style.display = checked ? "block" : "none";

        // אם מסומן – נסנכרן את היום לפי תאריך ההתחלה
        if (checked) {
            syncStartDateToMultiDays();
        }
    });

    // שינוי תאריך התחלה – אם multiPerWeek מסומן, נסמן אוטומטית את היום
    startDateInput.addEventListener("change", () => {
        if (chkMulti.checked) {
            syncStartDateToMultiDays();
        }
    });

    // טעינת סוגי פעילות
    await loadActivityTypes();
}

/* ========== פונקציה: לסמן אוטומטית את היום של תאריך ההתחלה ========== */
function syncStartDateToMultiDays() {
    const startDateStr = document.getElementById("startDate").value;
    if (!startDateStr) return;

    const d = new Date(startDateStr + "T00:00:00");
    if (isNaN(d.getTime())) return;

    const jsDay = d.getDay(); // 0=Sunday,1=Mon,...,6=Sat

    // אנחנו עובדים רק על א'-ה' (0–4)
    if (jsDay < 0 || jsDay > 4) {
        return;
    }

    const selector = `input[name='weekDaysMulti'][value='${jsDay}']`;
    const cb = document.querySelector(selector);
    if (cb) {
        cb.checked = true;
    }
}

/* ========== 1. טעינת ActivityTypes (רמות) ========== */
async function loadActivityTypes() {
    const selType   = document.getElementById("activityType");
    const selCourse = document.getElementById("course");
    const selInstr  = document.getElementById("instructor");

    selType.innerHTML   = "<option value=''>טוען סוגי פעילות…</option>";
    selCourse.innerHTML = "<option value=''>בחר רמה קודם…</option>";
    selInstr.innerHTML  = "<option value=''>בחר קורס קודם…</option>";
    selCourse.disabled  = true;
    selInstr.disabled   = true;

    try {
        const resp = await fetch(`${API_BASE}/activity-types`, { cache: "no-cache", credentials: "include" });
        if (!resp.ok) {
            selType.innerHTML = "<option value=''>שגיאה בטעינת סוגי פעילות</option>";
            return;
        }
        const list = await resp.json();
        if (!Array.isArray(list) || list.length === 0) {
            selType.innerHTML = "<option value=''>אין סוגי פעילות</option>";
            return;
        }

        selType.innerHTML = "<option value=''>בחר רמה…</option>";
        for (const t of list) {
            const id   = t.ActivityTypeId ?? t.activityTypeId;
            const name = t.TypeName       ?? t.typeName;
            if (!id || !name) continue;
            const opt = document.createElement("option");
            opt.value = id;
            opt.textContent = name;
            selType.appendChild(opt);
        }
    } catch (e) {
        console.error("ACTIVITY TYPES ERROR", e);
        selType.innerHTML = "<option value=''>שגיאה בטעינת סוגי פעילות</option>";
    }
}

/* ========== 2. קורסים לפי סוג פעילות ========== */
async function loadCourses() {
    const typeId   = document.getElementById("activityType").value;
    const selCourse = document.getElementById("course");
    const selInstr  = document.getElementById("instructor");

    selInstr.innerHTML = "<option value=''>בחר קורס קודם…</option>";
    selInstr.disabled  = true;

    if (!typeId) {
        selCourse.innerHTML = "<option value=''>בחר רמה קודם…</option>";
        selCourse.disabled  = true;
        return;
    }

    selCourse.disabled  = true;
    selCourse.innerHTML = "<option value=''>טוען קורסים…</option>";

    try {
        const resp = await fetch(`${API_BASE}/courses/by-type/${encodeURIComponent(typeId)}`, {
            cache: "no-cache", credentials: "include"
        });
        if (!resp.ok) {
            selCourse.innerHTML = "<option value=''>שגיאה בטעינת קורסים</option>";
            return;
        }

        const list = await resp.json();
        if (!Array.isArray(list) || list.length === 0) {
            selCourse.innerHTML = "<option value=''>אין קורסים לרמה זו</option>";
            return;
        }

        selCourse.innerHTML = "<option value=''>בחר קורס…</option>";
        for (const c of list) {
            const id   = c.CourseId   ?? c.courseId;
            const name = c.CourseName ?? c.courseName;
            if (!id || !name) continue;
            const opt = document.createElement("option");
            opt.value = id;
            opt.textContent = name;
            selCourse.appendChild(opt);
        }
        selCourse.disabled = false;
    } catch (e) {
        console.error("COURSES ERROR", e);
        selCourse.innerHTML = "<option value=''>שגיאה בטעינת קורסים</option>";
    }
}

/* ========== 3. מדריכים לפי קורס ========== */
async function loadInstructors() {
    const courseId = document.getElementById("course").value;
    const selInstr = document.getElementById("instructor");

    if (!courseId) {
        selInstr.innerHTML = "<option value=''>בחר קורס קודם…</option>";
        selInstr.disabled  = true;
        return;
    }

    selInstr.disabled  = true;
    selInstr.innerHTML = "<option value=''>טוען מדריכים…</option>";

    try {
        const resp = await fetch(`${API_BASE}/instructors/by-course/${encodeURIComponent(courseId)}`, {
            cache: "no-cache", credentials: "include"
        });
        if (!resp.ok) {
            selInstr.innerHTML = "<option value=''>שגיאה בטעינת מדריכים</option>";
            return;
        }

        const list = await resp.json();
        if (!Array.isArray(list) || list.length === 0) {
            selInstr.innerHTML = "<option value=''>אין מדריכים לקורס זה</option>";
            return;
        }

        selInstr.innerHTML = "<option value=''>בחר מדריך…</option>";
        for (const i of list) {
            const id    = i.InstructorId ?? i.instructorId;
            const name  = i.FullName     ?? i.fullName;
            const email = i.Email        ?? i.email;
            if (!id || !name) continue;
            const opt = document.createElement("option");
            opt.value = id;
            opt.textContent = email ? `${name} (${email})` : name;
            selInstr.appendChild(opt);
        }
        selInstr.disabled = false;
    } catch (e) {
        console.error("INSTRUCTORS ERROR", e);
        selInstr.innerHTML = "<option value=''>שגיאה בטעינת מדריכים</option>";
    }
}

/* ========== 4. בניית מופעים (Preview) ========== */
function buildOccurrences() {
    const startDateStr = document.getElementById("startDate").value;
    const startHourStr = document.getElementById("startHour").value;
    const endHourStr   = document.getElementById("endHour").value;
    const repeatMode   = document.getElementById("repeatMode").value;
    const repeatCount  = parseInt(document.getElementById("repeatCount").value || "1", 10);
    const rooms        = parseInt(document.getElementById("roomsCount").value || "1", 10);
    const reqIns       = parseInt(document.getElementById("reqInstructors").value || "1", 10);
    const multi        = document.getElementById("multiPerWeek").checked;
    const selectedDays = Array.from(document.querySelectorAll("input[name='weekDaysMulti']:checked"))
                              .map(cb => parseInt(cb.value, 10))
                              .sort((a,b)=>a-b);

    showMsg("", false);

    if (!startDateStr) {
        showMsg("יש לבחור תאריך התחלה", true);
        return;
    }
    if (!startHourStr || !endHourStr) {
        showMsg("יש לבחור שעות התחלה וסיום", true);
        return;
    }
    if (multi) {
        if (repeatMode !== "weekly") {
            showMsg("מופעים מרובים באותו שבוע אפשריים רק בחזרתיות שבועית", true);
            return;
        }
        if (!selectedDays.length) {
            showMsg("סימנת 'מספר מופעים באותו שבוע' – בחר לפחות יום אחד (א׳–ה׳)", true);
            return;
        }
    }

    const baseDate = new Date(startDateStr + "T00:00:00");
    if (isNaN(baseDate.getTime())) {
        showMsg("תאריך התחלה לא תקין", true);
        return;
    }

    occurrences = [];

    const [sh, sm] = startHourStr.split(":").map(x => parseInt(x, 10));
    const [eh, em] = endHourStr.split(":").map(x => parseInt(x, 10));

    const addOccurrence = (d) => {
        const start = new Date(d);
        start.setHours(sh, sm ?? 0, 0, 0);

        const end = new Date(d);
        end.setHours(eh, em ?? 0, 0, 0);

        occurrences.push({
            startUtc: start,
            endUtc: end,
            roomsCount: rooms,
            requiredInstructors: reqIns
        });
    };

    if (multi && repeatMode === "weekly") {
        // מופעים מרובים באותו שבוע – על בסיס ראשון של אותו שבוע
        const baseWeekStart = new Date(baseDate);
        const jsDow = baseWeekStart.getDay(); // 0=Sunday ...
        baseWeekStart.setDate(baseWeekStart.getDate() - jsDow); // לראשון

        for (let w = 0; w < repeatCount; w++) {
            for (const off of selectedDays) {
                const d = new Date(baseWeekStart);
                d.setDate(baseWeekStart.getDate() + w * 7 + off);
                addOccurrence(d);
            }
        }
    } else {
        // מופע אחד בכל יחידת חזרתיות
        for (let i = 0; i < repeatCount; i++) {
            const d = new Date(baseDate);
            if (repeatMode === "weekly") {
                d.setDate(d.getDate() + i * 7);
            } else if (repeatMode === "monthly") {
                d.setMonth(d.getMonth() + i);
            }
            addOccurrence(d);
        }
    }

    renderOccurrences();
    showMsg("המופעים עודכנו בתצוגה מקדימה", false);
}

/* ========== 5. רינדור טבלת מופעים (כולל יום בשבוע) ========== */
function renderOccurrences() {
    const tbody   = document.getElementById("instancesBody");
    const counter = document.getElementById("instancesCounter");

    const dayNames = ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"];

    tbody.innerHTML = "";
    occurrences.forEach((occ, idx) => {
        const tr = document.createElement("tr");

        const start = occ.startUtc;
        const end   = occ.endUtc;

        const dateStr = start.toISOString().substring(0,10);
        const dayName = dayNames[start.getDay()];
        const timeStr = start.toTimeString().substring(0,5) +
                        " - " +
                        end.toTimeString().substring(0,5);

        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${dateStr}</td>
            <td>${dayName}</td>
            <td>${timeStr}</td>
            <td>${occ.roomsCount}</td>
            <td>${occ.requiredInstructors}</td>
            <td><button type="button" class="danger" data-idx="${idx}">X</button></td>
        `;
        tbody.appendChild(tr);
    });

    counter.textContent = `${occurrences.length} מופעים`;

    tbody.querySelectorAll("button.danger").forEach(btn => {
        btn.addEventListener("click", () => {
            const i = parseInt(btn.getAttribute("data-idx"), 10);
            if (!isNaN(i)) {
                occurrences.splice(i, 1);
                renderOccurrences();
            }
        });
    });
}

/* ========== 6. נקה מופעים ========== */
function clearOccurrences() {
    occurrences = [];
    renderOccurrences();
    showMsg("כל המופעים נמחקו מהרשימה", false);
}

/* ========== 7. שמירה ל-API ========== */
async function saveActivityAndInstances() {
    const activityTypeId   = document.getElementById("activityType").value;
    const courseId         = document.getElementById("course").value;
    const leadInstructorId = document.getElementById("instructor").value;
    const name             = document.getElementById("activityName").value.trim();
    const deadlineVal      = document.getElementById("deadline").value;

    showMsg("", false);

    if (!activityTypeId || !courseId || !leadInstructorId || !name) {
        showMsg("חובה לבחור רמה, קורס, מדריך ולהזין שם פעילות", true);
        return;
    }

    if (occurrences.length === 0) {
        showMsg("לא נוצרו מופעים. לחץ Preview לפני שמירה.", true);
        return;
    }

    const payload = {
        activityName: name,
        activityTypeId: Number(activityTypeId),   // 👈 ילך ל-ActivityTypeId
        courseId: Number(courseId),              // 👈 ב-DTO בלבד, כרגע לא נשמר בטבלה
        leadInstructorId: Number(leadInstructorId),
        applicationDeadlineUtc: deadlineVal ? new Date(deadlineVal).toISOString() : null,
        instances: occurrences.map(o => ({
            startUtc: o.startUtc.toISOString(),
            endUtc: o.endUtc.toISOString(),
            roomsCount: o.roomsCount,
            requiredInstructors: o.requiredInstructors
        }))
    };
    

    try {
        const resp = await fetch(`${API_BASE}/activities`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            credentials: "include",
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const txt = await resp.text();
            console.error("SAVE ERROR:", resp.status, txt);
            showMsg("שגיאה בשמירה ל-API", true);
            return;
        }

        const data = await resp.json().catch(()=>({}));
        console.log("SAVE OK", data);
        showMsg("הפעילות והמופעים נשמרו בהצלחה", false);

        occurrences = [];
        renderOccurrences();
    } catch (e) {
        console.error("SAVE FETCH ERROR", e);
        showMsg("שגיאה בשמירה ל-API", true);
    }
}

/* ========== 8. הודעות ========== */
function showMsg(text, isError) {
    const ok  = document.getElementById("msgOk");
    const err = document.getElementById("msgErr");
    ok.style.display  = "none";
    err.style.display = "none";

    if (!text) return;

    if (isError) {
        err.textContent = text;
        err.style.display = "block";
    } else {
        ok.textContent = text;
        ok.style.display = "block";
    }
}

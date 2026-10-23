// ==========================
// CONFIG
// ==========================
const API_BASE = "/simcenter/PocusSchedualer/api/api";

// ==========================
// GLOBAL STATE
// ==========================
let courses = [];
let activityTypes = [];
let currentUser = null;

// ==========================
// HELPERS
// ==========================
async function apiGet(url) {
    const res = await fetch(`${API_BASE}${url}`, {
        credentials: "include"
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }

    return res.json();
}

function showMessage(msg, isError = false) {
    const el = document.getElementById("message");
    if (!el) return;

    el.innerText = msg;
    el.style.color = isError ? "red" : "green";
}

// ==========================
// LOAD DATA
// ==========================
async function loadCurrentUser() {
    try {
        currentUser = await apiGet("/me");
        document.getElementById("userRole").innerText = currentUser.role || "Admin";
    } catch (err) {
        console.error("User load failed:", err);
        showMessage("שגיאה בטעינת משתמש", true);
    }
}

async function loadCourses() {
    try {
        courses = await apiGet("/activities/courses");
        renderCourses();
    } catch (err) {
        console.error("Courses load failed:", err);
        showMessage("שגיאה בטעינת קורסים", true);
    }
}

async function loadActivityTypes() {
    try {
        activityTypes = await apiGet("/activity-types");
    } catch (err) {
        console.error("Activity types load failed:", err);
    }
}

// ==========================
// RENDER
// ==========================
function renderCourses() {
    const container = document.getElementById("coursesContainer");
    if (!container) return;

    container.innerHTML = "";

    courses.forEach(course => {
        const div = document.createElement("div");
        div.className = "course-card";

        div.innerHTML = `
            <div class="course-title">${course.name}</div>
            <div class="course-desc">${course.description || ""}</div>
            <div class="course-actions">
                <button onclick="editCourse(${course.id})">עריכה</button>
                <button onclick="deleteCourse(${course.id})">מחיקה</button>
            </div>
        `;

        container.appendChild(div);
    });
}

// ==========================
// CRUD
// ==========================
async function addCourse() {
    const name = document.getElementById("courseName").value.trim();
    const description = document.getElementById("courseDescription").value.trim();

    if (!name) {
        showMessage("יש להזין שם קורס", true);
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/activities/courses`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                name,
                description
            })
        });

        if (!res.ok) throw new Error();

        showMessage("קורס נוסף בהצלחה");
        await loadCourses();

    } catch (err) {
        console.error(err);
        showMessage("שגיאה בהוספת קורס", true);
    }
}

async function deleteCourse(id) {
    if (!confirm("למחוק קורס?")) return;

    try {
        const res = await fetch(`${API_BASE}/activities/courses/${id}`, {
            method: "DELETE",
            credentials: "include"
        });

        if (!res.ok) throw new Error();

        showMessage("קורס נמחק");
        await loadCourses();

    } catch (err) {
        console.error(err);
        showMessage("שגיאה במחיקה", true);
    }
}

function editCourse(id) {
    const course = courses.find(c => c.id === id);
    if (!course) return;

    document.getElementById("courseName").value = course.name;
    document.getElementById("courseDescription").value = course.description || "";

    // אופציונלי: שמירת ID לעריכה עתידית
    window.editingCourseId = id;
}

// ==========================
// INIT
// ==========================
async function initPage() {
    showMessage("טוען נתונים...");

    try {
        await loadCurrentUser();
        await Promise.all([
            loadCourses(),
            loadActivityTypes()
        ]);

        showMessage("הטעינה הושלמה");
    } catch (err) {
        console.error(err);
        showMessage("שגיאה בטעינת הדף", true);
    }
}

document.addEventListener("DOMContentLoaded", initPage);
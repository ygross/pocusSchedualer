const _dir = window.location.pathname.replace(/\/[^\/]*$/, "");
const API  = `${window.location.origin}${_dir}/api/api`;

const $ = id => document.getElementById(id);

function showMsg(text, type) {
  const el = $("msgBox");
  el.textContent = text;
  el.className = "msg " + type;
  el.style.display = "";
  if (type === "ok") setTimeout(() => { el.style.display = "none"; }, 4000);
}

async function load() {
  const res = await fetch(`${API}/me`, { credentials: "include" });
  if (!res.ok) { showMsg("טעינת פרטים נכשלה – " + res.status, "err"); return; }
  const d = await res.json();

  $("meName").textContent     = d.fullName  || d.email || "—";
  $("meRole").textContent     = d.roleName  || d.role  || "—";
  $("email").value            = d.email     || "";
  $("fullName").value         = d.fullName  || "";
  $("phone").value            = d.phone     || "";
  $("department").value       = d.department|| "";
  $("role").value             = d.roleName  || d.role  || "";
}

async function save() {
  const fullName = $("fullName").value.trim();
  if (!fullName) { showMsg("שם מלא הוא שדה חובה", "err"); return; }

  $("btnSave").disabled = true;
  try {
    const res = await fetch(`${API}/me`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        phone:      $("phone").value.trim()      || null,
        department: $("department").value.trim() || null,
      }),
    });
    if (!res.ok) throw new Error("שמירה נכשלה – " + res.status);
    $("meName").textContent = fullName;
    showMsg("✔ הפרטים עודכנו בהצלחה", "ok");
  } catch (e) {
    showMsg(e.message, "err");
  } finally {
    $("btnSave").disabled = false;
  }
}

// theme toggle
const themeBtn = $("themeToggle");
themeBtn?.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  themeBtn.textContent = next === "dark" ? "🌙" : "🌞";
});
if (localStorage.getItem("theme") === "light") themeBtn && (themeBtn.textContent = "🌞");

$("btnSave").addEventListener("click", save);
load();

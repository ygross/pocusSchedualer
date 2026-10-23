const _dir    = window.location.pathname.replace(/\/[^\/]*$/, "");
const API_BASE = `${window.location.origin}${_dir}/api/api`;
const $ = id => document.getElementById(id);

// ─── helpers ──────────────────────────────────────────────────────────────────
async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Accept": "application/json", ...(opts.headers || {}) },
    ...opts
  });
  if (res.status === 401) { window.top.location.href = `${_dir}/login-otp.html`; return null; }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${res.status} ${t}`.trim());
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : null;
}

function fmtDate(utcStr) {
  if (!utcStr) return "";
  const d = new Date(utcStr);
  return d.toLocaleDateString("he-IL", { day:"2-digit", month:"2-digit", year:"numeric",
    hour:"2-digit", minute:"2-digit", timeZone:"Asia/Jerusalem" });
}

function showResult(text, kind, bullets) {
  const el = $("resultBox");
  el.className = "result-box " + (kind || "ok");
  let html = text;
  if (bullets && bullets.length) {
    html += `<ul>${bullets.map(b => `<li>${b}</li>`).join("")}</ul>`;
  }
  el.innerHTML = html;
  el.style.display = "block";
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ─── load activities ──────────────────────────────────────────────────────────
async function loadActivities() {
  try {
    const rows = await fetchJson(`${API_BASE}/lead/activities`) || [];
    const sel = $("activitySelect");
    sel.innerHTML = `<option value="">— בחר קורס —</option>`;
    rows.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.activityId ?? a.ActivityId ?? a.id;
      opt.textContent = a.activityName ?? a.ActivityName ?? a.name ?? `פעילות ${opt.value}`;
      sel.appendChild(opt);
    });
    if (!rows.length) {
      sel.innerHTML = `<option value="">אין קורסים מוגדרים עבורך</option>`;
    }
  } catch(e) {
    showResult("שגיאה בטעינת קורסים: " + e.message, "err");
  }
}

// ─── on activity change ───────────────────────────────────────────────────────
async function onActivityChange() {
  const activityId = +$("activitySelect").value || 0;
  const instSel = $("instanceSelect");
  const instInfo = $("instanceInfo");

  instSel.innerHTML = `<option value="">טוען מופעים…</option>`;
  instSel.disabled = true;
  instInfo.style.display = "none";
  $("resultBox").style.display = "none";

  if (!activityId) {
    instSel.innerHTML = `<option value="">— קודם בחר קורס —</option>`;
    return;
  }

  try {
    const instances = await fetchJson(
      `${API_BASE}/leadcalendar/activities/${activityId}/instances`) || [];

    instSel.innerHTML = `<option value="">— בחר מופע —</option>`;
    instances.forEach(i => {
      const opt = document.createElement("option");
      opt.value = i.instanceId;
      const start = fmtDate(i.startUtc);
      const loc   = i.location ? ` | ${i.location}` : "";
      const cnt   = i.assignedCount > 0 ? ` (${i.assignedCount} מדריכים)` : " (אין שיבוצים)";
      opt.textContent = `${start}${loc}${cnt}`;
      opt.dataset.info = JSON.stringify(i);
      instSel.appendChild(opt);
    });

    if (!instances.length) {
      instSel.innerHTML = `<option value="">אין מופעים לקורס זה</option>`;
    } else {
      instSel.disabled = false;
    }
  } catch(e) {
    instSel.innerHTML = `<option value="">שגיאה בטעינת מופעים</option>`;
    showResult("שגיאה בטעינת מופעים: " + e.message, "err");
  }
}

// ─── on instance change ───────────────────────────────────────────────────────
function onInstanceChange() {
  const sel  = $("instanceSelect");
  const info = $("instanceInfo");
  const opt  = sel.options[sel.selectedIndex];

  if (!sel.value || !opt?.dataset?.info) {
    info.style.display = "none";
    return;
  }

  try {
    const d = JSON.parse(opt.dataset.info);
    const start = fmtDate(d.startUtc);
    const end   = fmtDate(d.endUtc);
    const loc   = d.location || "—";
    const cnt   = d.assignedCount;
    info.innerHTML = `<b>מופע:</b> ${start} עד ${end} | <b>מיקום:</b> ${loc} | <b>מדריכים משובצים:</b> ${cnt}`;
    info.style.display = "block";

    if (cnt === 0) {
      showResult("⚠ לא קיימים מדריכים משובצים למופע זה — ההודעה לא תישלח לאף אחד.", "warn");
    } else {
      $("resultBox").style.display = "none";
    }
  } catch { info.style.display = "none"; }
}

// ─── send ─────────────────────────────────────────────────────────────────────
async function sendMessage() {
  const instanceId = +$("instanceSelect").value || 0;
  const message    = ($("msgBody").value || "").trim();
  const subject    = ($("msgSubject").value || "").trim();
  const channel    = document.querySelector('input[name="channel"]:checked')?.value || "email";

  if (!instanceId) { showResult("נא לבחור מופע.", "err"); return; }
  if (!message)    { showResult("נא להזין תוכן הודעה.", "err"); return; }

  const btn = $("sendBtn");
  btn.disabled = true;
  btn.textContent = "שולח…";
  $("resultBox").style.display = "none";

  try {
    const result = await fetchJson(
      `${API_BASE}/leadcalendar/instances/${instanceId}/send-custom-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, subject: subject || undefined, channel })
      });

    if (!result) { showResult("לא התקבלה תשובה מהשרת.", "err"); return; }

    if (result.status === "no-recipients") {
      showResult("לא נמצאו מדריכים משובצים למופע זה.", "warn");
    } else if (result.status === "whatsapp-not-configured") {
      showResult("ווטסאפ אינו מוגדר במערכת. פנה לאדמין.", "warn");
    } else if (result.ok) {
      const ch = channel === "email" ? "מייל" : "ווטסאפ";
      let txt = `✓ ההודעה נשלחה ב-${ch} ל-${result.sent} מתוך ${result.total} מדריכים.`;
      if (result.failed > 0) txt += ` ${result.failed} נכשלו.`;
      showResult(txt, result.failed === 0 ? "ok" : "warn", result.errors || []);
    } else {
      showResult("שגיאה בשליחה: " + (result.error || result.status), "err");
    }
  } catch(e) {
    showResult("שגיאה: " + e.message, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = "📤 שלח הודעה";
  }
}

// expose inline handlers
window.onActivityChange = onActivityChange;
window.onInstanceChange = onInstanceChange;
window.sendMessage      = sendMessage;

// ─── init ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  $("themeToggle")?.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    $("themeToggle").textContent = next === "dark" ? "🌙" : "☀️";
  });
  if (localStorage.getItem("theme") === "dark") $("themeToggle").textContent = "🌙";
  else $("themeToggle").textContent = "☀️";

  await loadActivities();
});

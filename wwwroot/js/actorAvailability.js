/* actorAvailability.js – Actor self-service availability page */
(function () {
  "use strict";

  const base = (() => {
    const p = window.location.pathname.replace(/\/[^/]*$/, "");
    return p.replace(/\/$/, "");
  })();
  const API    = `${base}/api/api/actors`;
  const API_ME = `${base}/api/api/me`;

  let instances = [];
  let myAvailability = new Set();
  let loggedInActorId = null;

  async function init() {
    // If logged-in user is an Actor, skip the picker and load directly
    try {
      const meRes = await fetch(API_ME, { credentials: "include" });
      if (meRes.ok) {
        const me = await meRes.json();
        if (me.isActor) {
          loggedInActorId = me.instructorId; // instructorId stores ActorId for actors
          const pickerRow = document.getElementById("actorSel").closest(".select-row");
          if (pickerRow) pickerRow.style.display = "none";
          document.getElementById("noteField").style.display = "flex";
          document.getElementById("table-wrap").style.display = "block";
          await loadForActor(loggedInActorId);
          return;
        }
      }
    } catch {}

    // Non-actor user (admin/instructor) — show actor picker
    let actors;
    try {
      const res = await fetch(`${API}`, { credentials: "include" });
      actors = res.ok ? await res.json() : [];
    } catch { actors = []; }

    const sel = document.getElementById("actorSel");
    sel.innerHTML = `<option value="">בחר שחקן…</option>` +
      actors.map(a => {
        const gender = a.gender === "Male" ? "גבר" : a.gender === "Female" ? "אישה" : "אחר";
        const age    = a.ageGroup === "Adult" ? "מבוגר" : a.ageGroup === "Child" ? "ילד" : "קשיש";
        return `<option value="${a.actorId}">${esc(a.fullName)} (${gender}, ${age})</option>`;
      }).join("");
  }

  async function loadForActor(actorId) {
    try {
      const [upRes, avRes] = await Promise.all([
        fetch(`${API}/upcoming-instances`, { credentials: "include" }),
        fetch(`${API}/${actorId}/availability`, { credentials: "include" }),
      ]);
      instances = upRes.ok ? await upRes.json() : [];
      const myList = avRes.ok ? await avRes.json() : [];
      myAvailability = new Set(myList.map(x => x.instanceId));
    } catch {
      instances = [];
      myAvailability = new Set();
    }
    renderTable(actorId);
  }

  async function onActorChange() {
    const actorId = document.getElementById("actorSel").value;
    if (!actorId) {
      document.getElementById("table-wrap").style.display = "none";
      document.getElementById("noteField").style.display = "none";
      return;
    }
    document.getElementById("noteField").style.display = "flex";
    document.getElementById("table-wrap").style.display = "block";
    await loadForActor(actorId);
  }

  function renderTable(actorId) {
    const tbody = document.getElementById("tbody");
    const empty = document.getElementById("empty-msg");

    if (!instances.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    tbody.innerHTML = instances.map(inst => {
      const start   = new Date(inst.startUtc);
      const dateStr = start.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
      const timeStr = start.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
      const avail   = myAvailability.has(inst.instanceId);

      return `<tr>
        <td class="date-cell">${dateStr}</td>
        <td>${timeStr}</td>
        <td>${esc(inst.activityName)}<br><small style="color:#6b7280">${esc(inst.courseName)} · ${esc(inst.typeName)}</small></td>
        <td>
          ${avail
            ? `<button class="btn btn-unavailable" onclick="toggleAvail(${actorId},${inst.instanceId},false)">ביטול זמינות</button>
               <span class="badge badge-available" style="margin-right:8px">זמין</span>`
            : `<button class="btn btn-available" onclick="toggleAvail(${actorId},${inst.instanceId},true)">אני זמין</button>`
          }
        </td>
      </tr>`;
    }).join("");
  }

  async function toggleAvail(actorId, instanceId, available) {
    const note = document.getElementById("noteInput")?.value?.trim() || null;
    if (available) {
      await fetch(`${API}/${actorId}/activity-instances/${instanceId}/availability`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      myAvailability.add(instanceId);
    } else {
      await fetch(`${API}/${actorId}/activity-instances/${instanceId}/availability`, {
        method: "DELETE", credentials: "include",
      });
      myAvailability.delete(instanceId);
    }
    renderTable(actorId);
    showToast();
  }

  function showToast() {
    const t = document.getElementById("toast");
    t.style.display = "block";
    setTimeout(() => { t.style.display = "none"; }, 2000);
  }

  function esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  window.onActorChange = onActorChange;
  window.toggleAvail   = toggleAvail;

  init();
})();

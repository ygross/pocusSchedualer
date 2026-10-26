/* adminActors.js – Actor CRUD management page */
(function () {
  "use strict";

  const base = (() => {
    const p = window.location.pathname.replace(/\/[^/]*$/, "");
    return p.replace(/\/$/, "");
  })();
  const API = `${base}/api/api/admin/actors`;

  let editing = null; // actorId being edited, or null for new

  const GENDER_LABEL = { Male: "גבר", Female: "אישה", Other: "אחר" };
  const AGE_LABEL    = { Adult: "מבוגר", Child: "ילד", Elderly: "קשיש" };

  function badgeGender(g) {
    const cls = g === "Male" ? "male" : g === "Female" ? "female" : "other";
    return `<span class="badge badge-${cls}">${GENDER_LABEL[g] || g}</span>`;
  }
  function badgeAge(a) {
    const cls = a === "Adult" ? "adult" : a === "Child" ? "child" : "elderly";
    return `<span class="badge badge-${cls}">${AGE_LABEL[a] || a}</span>`;
  }
  function badgeStatus(s) {
    const cls = s === "active" ? "active" : "inactive";
    const lbl = s === "active" ? "פעיל" : "לא פעיל";
    return `<span class="badge badge-${cls}">${lbl}</span>`;
  }

  async function load() {
    const gender = document.getElementById("fGender").value;
    const age    = document.getElementById("fAge").value;
    const status = document.getElementById("fStatus").value;
    const qs = new URLSearchParams();
    if (gender) qs.set("gender", gender);
    if (age)    qs.set("ageGroup", age);
    if (status) qs.set("status", status);

    let rows;
    try {
      const res = await fetch(`${API}?${qs}`, { credentials: "include" });
      if (!res.ok) { document.getElementById("tbody").innerHTML = ""; return; }
      rows = await res.json();
    } catch { document.getElementById("tbody").innerHTML = ""; return; }

    const tbody = document.getElementById("tbody");
    const empty = document.getElementById("empty-msg");

    if (!rows.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${esc(r.fullName)}</strong></td>
        <td>${badgeGender(r.gender)}</td>
        <td>${badgeAge(r.ageGroup)}</td>
        <td>${r.phone ? esc(r.phone) : "—"}</td>
        <td>${r.email ? esc(r.email) : "—"}</td>
        <td>${badgeStatus(r.status)}</td>
        <td>
          <button class="action-btn btn-ghost" onclick="openModal(${r.actorId})">עריכה</button>
          <button class="action-btn btn-danger" style="margin-right:4px" onclick="del(${r.actorId},'${esc(r.fullName)}')">מחק</button>
        </td>
      </tr>`).join("");
  }

  async function openModal(actorId) {
    editing = actorId || null;
    document.getElementById("modal-title").textContent = editing ? "עריכת שחקן" : "הוסף שחקן";

    if (editing) {
      const res = await fetch(`${API}/${editing}`, { credentials: "include" });
      const r = await res.json();
      document.getElementById("f-name").value   = r.fullName  || "";
      document.getElementById("f-gender").value = r.gender    || "Male";
      document.getElementById("f-age").value    = r.ageGroup  || "Adult";
      document.getElementById("f-phone").value  = r.phone     || "";
      document.getElementById("f-email").value  = r.email     || "";
      document.getElementById("f-status").value = r.status    || "active";
      document.getElementById("f-notes").value  = r.notes     || "";
    } else {
      document.getElementById("f-name").value   = "";
      document.getElementById("f-gender").value = "Male";
      document.getElementById("f-age").value    = "Adult";
      document.getElementById("f-phone").value  = "";
      document.getElementById("f-email").value  = "";
      document.getElementById("f-status").value = "active";
      document.getElementById("f-notes").value  = "";
    }
    document.getElementById("modal-overlay").classList.add("open");
  }

  function closeModal() {
    document.getElementById("modal-overlay").classList.remove("open");
    editing = null;
  }

  async function save() {
    const name = document.getElementById("f-name").value.trim();
    if (!name) { alert("שם מלא הוא שדה חובה"); return; }

    const body = {
      fullName: name,
      gender:   document.getElementById("f-gender").value,
      ageGroup: document.getElementById("f-age").value,
      phone:    document.getElementById("f-phone").value.trim() || null,
      email:    document.getElementById("f-email").value.trim() || null,
      status:   document.getElementById("f-status").value,
      notes:    document.getElementById("f-notes").value.trim() || null,
    };

    const url    = editing ? `${API}/${editing}` : API;
    const method = editing ? "PUT" : "POST";

    const res = await fetch(url, {
      method, credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) { alert("שגיאה בשמירה"); return; }
    closeModal();
    load();
  }

  async function del(actorId, name) {
    if (!confirm(`למחוק את ${name}?`)) return;
    const res = await fetch(`${API}/${actorId}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { alert("שגיאה במחיקה"); return; }
    load();
  }

  function esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // Expose to global for inline event handlers
  window.load        = load;
  window.openModal   = openModal;
  window.closeModal  = closeModal;
  window.save        = save;
  window.del         = del;

  // Close modal on overlay click
  document.getElementById("modal-overlay").addEventListener("click", e => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });

  load();
})();

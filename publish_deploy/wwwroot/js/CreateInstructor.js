(() => {
    "use strict";
  
    // ✅ חייב להיות כמו login-otp.js כדי לעבוד תחת:
    // https://localrecord.med.ad.bgu.ac.il/simcenter/PocusSchedualer/
    const API = "api/api";
  
    const $ = (id) => document.getElementById(id);
  
    function show(text, ok) {
      const msg = $("msg");
      msg.style.display = "block";
      msg.className = "msg " + (ok ? "ok" : "error");
      msg.textContent = text;
    }
  
    function getQueryParam(name) {
      const qs = new URLSearchParams(window.location.search);
      return qs.get(name);
    }
  
    async function createInstructor() {
      const btn = $("btnCreate");
      btn.disabled = true;
  
      const email = ($("email").value || "").trim().toLowerCase();
      const firstName = ($("firstName").value || "").trim();
      const lastName  = ($("lastName").value || "").trim();
  
      if (!email || !firstName || !lastName) {
        show("נא למלא אימייל, שם פרטי ושם משפחה", false);
        btn.disabled = false;
        return;
      }
  
      try {
        const r = await fetch(`${API}/instructors/onboard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, firstName, lastName })
        });
  
        if (!r.ok) {
          show(`יצירת מדריך נכשלה (HTTP ${r.status})`, false);
          btn.disabled = false;
          return;
        }
  
        show("הבקשה נשלחה. המדריך ממתין לאישור מנהל.", true);
  
        setTimeout(() => {
          window.location.href = `login-otp.html?email=${encodeURIComponent(email)}`;
        }, 900);
  
      } catch {
        show("שגיאת רשת בעת יצירת מדריך.", false);
        btn.disabled = false;
      }
    }
  
    document.addEventListener("DOMContentLoaded", () => {
      const emailFromUrl = getQueryParam("email");
      if (emailFromUrl) $("email").value = decodeURIComponent(emailFromUrl);
  
      $("btnCreate").addEventListener("click", createInstructor);
  
      ["email", "firstName", "lastName"].forEach(id => {
        $(id).addEventListener("keydown", (e) => {
          if (e.key === "Enter") createInstructor();
        });
      });
    });
  })();
  
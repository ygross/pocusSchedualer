// js/login-otp.js
// מטרה: Email -> בדיקה ב-INSTRUCTORS + שליחת OTP -> אימות OTP -> מעבר ל-app.html
// בלי redirect אוטומטי לשום דף אחר כשאימייל לא קיים.

(() => {
  "use strict";

  const API_BASE = "api/api"; // שנה אם צריך: "/simcenter/PocusSchedualer/api"
  const LOGIN_SUCCESS_REDIRECT = "app.html";

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", () => {
    const emailInput = $("email");
    const otpInput = $("otp");
    const btnSend = $("btnSend");
    const btnVerify = $("btnVerify");
    const otpSection = $("otpSection");
    const msg = $("msg");

    const missing = [];
    if (!emailInput) missing.push("#email");
    if (!btnSend) missing.push("#btnSend");
    if (!otpSection) missing.push("#otpSection");
    if (!otpInput) missing.push("#otp");
    if (!btnVerify) missing.push("#btnVerify");
    if (!msg) missing.push("#msg");

    if (missing.length) {
      console.error("login-otp.js missing elements:", missing.join(", "));
      return;
    }

    // טען אימייל אחרון אם קיים
    const lastEmail = sessionStorage.getItem("otp_email");
    if (lastEmail && !emailInput.value) emailInput.value = lastEmail;

    btnSend.addEventListener("click", sendOtp);
    btnVerify.addEventListener("click", verifyOtp);

    emailInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendOtp();
    });
    otpInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") verifyOtp();
    });

    function showMessage(text, isError = false) {
      msg.textContent = text;
      msg.className = "msg " + (isError ? "error" : "success");
    }

    function normalizeUrl(base, path) {
      const b = String(base || "").replace(/\/+$/, "");
      const p = String(path || "").replace(/^\/+/, "");
      return `${b}/${p}`;
    }

    async function safeFetch(url, options) {
      const r = await fetch(url, options);
      let data = null;
      const ct = r.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        try { data = await r.json(); } catch {}
      } else {
        try { data = await r.text(); } catch {}
      }
      return { r, data };
    }

    async function sendOtp() {
      const email = emailInput.value.trim();
      if (!email) return showMessage("יש להזין אימייל", true);

      sessionStorage.setItem("otp_email", email);

      btnSend.disabled = true;
      showMessage("בודק מדריך ושולח קוד...");

      try {
        const url = normalizeUrl(API_BASE, "auth/otp/request");
        const { r, data } = await safeFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // ✅ קריטי לשמירת Session/Cookie
          body: JSON.stringify({ email })
        });

        // אם השרת מחזיר 404 כשהאימייל לא קיים ב-INSTRUCTORS
        if (r.status === 404) {
          otpSection.style.display = "none";
          showMessage("האימייל לא נמצא ברשימת המדריכים (INSTRUCTORS)", true);
          return;
        }

        if (!r.ok) {
          const msgTxt =
            (data && (data.message || data.detail)) ? (data.message || data.detail) :
            "שגיאה בשליחת הקוד";
          throw new Error(msgTxt);
        }

        otpSection.style.display = "block";
        showMessage("קוד נשלח למייל");
        otpInput.value = "";
        otpInput.focus();
      } catch (err) {
        showMessage(err?.message || "שגיאה בשליחת הקוד", true);
      } finally {
        btnSend.disabled = false;
      }
    }

    async function verifyOtp() {
      const email = emailInput.value.trim();
      const code = otpInput.value.trim();
    
      if (!email) return showMessage("יש להזין אימייל", true);
      if (!code) return showMessage("יש להזין קוד", true);
    
      btnVerify.disabled = true;
      btnSend.disabled = true;
      showMessage("מאמת קוד...");
    
      try {
        // 1️⃣ אימות OTP
        const verifyUrl = normalizeUrl(API_BASE, "auth/otp/verify");
        const verifyRes = await fetch(verifyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, code })
        });
    
        if (!verifyRes.ok) {
          throw new Error("קוד שגוי או שפג תוקפו");
        }
    
        showMessage("הקוד אומת. בודק התחברות…");
    
        // 2️⃣ בדיקה שה-Cookie/Session באמת נוצר
        const meUrl = normalizeUrl(API_BASE, "me");
        const meRes = await fetch(meUrl, {
          method: "GET",
          credentials: "include"
        });
    
        if (!meRes.ok) {
          throw new Error("ההתחברות לא נשמרה (Cookie לא נוצר)");
        }
    
        const me = await meRes.json();
    
        if (!me || !me.email) {
          throw new Error("התקבל Session לא תקין");
        }
    
        // ✅ רק עכשיו מותר Redirect
        showMessage("התחברת בהצלחה ✔ מעביר לאפליקציה");
        setTimeout(() => {
          window.location.replace("app.html");
        }, 400);
    
      } catch (err) {
        showMessage(err.message || "שגיאה בהתחברות", true);
      } finally {
        btnVerify.disabled = false;
        btnSend.disabled = false;
      }
    }
    
  });
})();

(function () {
  const el = document.createElement("div");
  el.id = "pageTimestamp";
  el.style.cssText = [
    "position:fixed", "bottom:8px", "left:10px", "z-index:9999",
    "font-size:11px", "font-weight:700", "font-family:Arial,sans-serif",
    "background:rgba(0,0,0,.45)", "color:rgba(255,255,255,.75)",
    "padding:3px 9px", "border-radius:8px", "pointer-events:none",
    "backdrop-filter:blur(4px)", "letter-spacing:.3px"
  ].join(";");

  function fmt(d) {
    return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  }

  el.textContent = "עדכון: " + fmt(new Date());

  document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(el);
  });

  // Refresh timestamp whenever fetch completes (data reload)
  const _fetch = window.fetch;
  window.fetch = function (...args) {
    return _fetch.apply(this, args).then(res => {
      el.textContent = "עדכון: " + fmt(new Date());
      return res;
    });
  };
})();

(function () {
  /* ── Inject CSS ── */
  const style = document.createElement("style");
  style.textContent = `
    .pc-wrapper {
      border: 1px solid rgba(255,255,255,.13);
      border-radius: 14px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    :root[data-theme="light"] .pc-wrapper,
    body:not(.theme-dark) .pc-wrapper {
      border-color: rgba(15,23,42,.12);
    }
    .pc-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 12px;
      gap: 10px;
      cursor: pointer;
      user-select: none;
      min-height: 32px;
      background: rgba(255,255,255,.05);
    }
    :root[data-theme="light"] .pc-bar,
    body:not(.theme-dark) .pc-bar {
      background: rgba(15,23,42,.04);
    }
    .pc-bar-title {
      font-size: 12px;
      font-weight: 800;
      opacity: .75;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pc-btn {
      border: none;
      background: rgba(148,163,184,.18);
      color: inherit;
      border-radius: 6px;
      padding: 2px 9px;
      font-size: 11px;
      cursor: pointer;
      flex-shrink: 0;
      font-family: inherit;
    }
    .pc-btn:hover { background: rgba(148,163,184,.30); }
    .pc-body {
      max-height: 0;
      overflow: hidden;
      transition: max-height .25s ease;
    }
    .pc-body.open { max-height: 900px; }

    /* Scale-down everything inside the body */
    .pc-body .topbar,
    .pc-body .page-title-row,
    .pc-body .appbar,
    .pc-body header {
      margin-top: 0 !important;
      padding: 8px 10px !important;
      gap: 8px !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }
    .pc-body .title-card,
    .pc-body .user-card,
    .pc-body .left-card,
    .pc-body .page-user,
    .pc-body .userbox,
    .pc-body .hcol {
      padding: 8px 12px !important;
      border-radius: 10px !important;
      gap: 4px !important;
    }
    .pc-body .title        { font-size: 13px !important; font-weight: 900 !important; }
    .pc-body .subtitle,
    .pc-body .subsubtitle  { font-size: 10px !important; }
    .pc-body .user-title,
    .pc-body .user-title-text { font-size: 10px !important; font-weight: 800 !important; }
    .pc-body .user-line    { font-size: 10px !important; }
    .pc-body .status-pill  { font-size: 10px !important; padding: 3px 6px !important; }
    .pc-body .dot          { width: 7px !important; height: 7px !important; }
    .pc-body .theme-toggle { padding: 4px 7px !important; font-size: 13px !important; }
    /* Hide old per-card collapse buttons */
    .pc-body .pc-collapse-btn,
    .pc-body .collapse-btn { display: none !important; }
  `;
  document.head.appendChild(style);

  /* ── Wrap a header element ── */
  function wrap(el) {
    if (!el || el.dataset.pcDone) return;
    el.dataset.pcDone = "1";

    // Extract title text without moving DOM nodes
    const titleNode = el.querySelector(".title, h1, h2, .page-title, .appbar-title");
    const titleText = (titleNode ? titleNode.textContent : document.title).trim().slice(0, 60);

    // Build wrapper AROUND el using a placeholder
    const wrapper = document.createElement("div");
    wrapper.className = "pc-wrapper";

    const bar = document.createElement("div");
    bar.className = "pc-bar";
    bar.innerHTML = `<span class="pc-bar-title">${titleText}</span>`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pc-btn";
    btn.textContent = "▼ פרטים";
    bar.appendChild(btn);

    const body = document.createElement("div");
    body.className = "pc-body"; // starts collapsed

    // Swap el with wrapper, put el inside body
    el.parentNode.insertBefore(wrapper, el);
    body.appendChild(el);
    wrapper.appendChild(bar);
    wrapper.appendChild(body);

    bar.addEventListener("click", () => {
      const open = body.classList.toggle("open");
      btn.textContent = open ? "▲ סגור" : "▼ פרטים";
    });
  }

  function init() {
    // Target all known header/topbar patterns
    const SELECTORS = [
      ".topbar",
      ".page-title-row",
      ".appbar",
      "header.topbar",
    ];
    SELECTORS.forEach(sel =>
      document.querySelectorAll(sel).forEach(wrap)
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

const _dir = window.location.pathname.replace(/\/[^\/]*$/, "");
const API  = `${window.location.origin}${_dir}/api/api`;

const $ = id => document.getElementById(id);
let chartInstance = null;

// ── helpers ────────────────────────────────────────────────────────────────
function esc(v) {
  return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function showErr(msg) {
  const el = $("errBox");
  el.textContent = msg;
  el.style.display = msg ? "" : "none";
}

// ── KPI ────────────────────────────────────────────────────────────────────
function renderKpis(s) {
  $("kpiTypes").textContent      = s.typesCount      ?? 0;
  $("kpiCourses").textContent    = s.coursesCount    ?? 0;
  $("kpiActivities").textContent = s.activitiesCount ?? 0;
  $("kpiInstances").textContent  = s.instancesCount  ?? 0;
  $("kpiHours").textContent      = (+(s.totalHours ?? 0)).toFixed(1);
}

// ── Chart ──────────────────────────────────────────────────────────────────
function renderChart(byType) {
  const labels   = byType.map(t => t.typeName);
  const courses  = byType.map(t => t.coursesCount);
  const acts     = byType.map(t => t.activitiesCount);

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const gridColor = isDark ? "rgba(255,255,255,.08)" : "rgba(15,23,42,.08)";
  const textColor = isDark ? "#9ab" : "#475569";

  chartInstance = new Chart($("chartCanvas"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Courses",
          data: courses,
          backgroundColor: "rgba(59,130,246,.70)",
          borderRadius: 5,
        },
        {
          label: "Activities",
          data: acts,
          backgroundColor: "rgba(34,197,94,.60)",
          borderRadius: 5,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { size: 12 } } },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, stepSize: 1 },
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 12 } },
        },
      },
    },
  });
}

// ── Tree ───────────────────────────────────────────────────────────────────
function buildTree(tree) {
  const container = $("treeContainer");
  if (!tree || !tree.length) {
    container.innerHTML = "<div style='color:var(--muted);padding:16px'>No data</div>";
    return;
  }

  container.innerHTML = tree.map(type => {
    const courseCount = type.courses?.length ?? 0;
    const actCount    = type.courses?.reduce((s, c) => s + (c.activities?.length ?? 0), 0) ?? 0;

    const coursesHtml = (type.courses ?? []).map(course => {
      const actHtml = (course.activities ?? []).map(act => `
        <div class="tree-activity">
          <span class="act-dot"></span>
          <span class="act-name">${esc(act.activityName)}</span>
          <span class="act-meta">${act.instanceCount} instances &middot; ${(+act.totalHours).toFixed(1)}h</span>
        </div>
      `).join("");

      return `
        <div class="tree-course">
          <div class="tree-course-header" onclick="toggleNode(this)">
            <span class="chevron">&#9654;</span>
            <span class="tree-course-name">${esc(course.courseName)}</span>
            ${!course.isActive ? '<span class="inactive-badge">inactive</span>' : ""}
            <span class="badge badge-activity">${course.activities?.length ?? 0} activities</span>
            <span class="badge badge-course">${course.instructorsCount} instructors</span>
          </div>
          <div class="tree-activities hidden">${actHtml || '<div style="padding:6px 10px;font-size:12px;color:var(--muted2)">No activities</div>'}</div>
        </div>`;
    }).join("");

    return `
      <div class="tree-type">
        <div class="tree-type-header" onclick="toggleNode(this)">
          <span class="chevron open">&#9654;</span>
          <span class="tree-type-name">${esc(type.typeName)}</span>
          <span class="badge badge-type">${courseCount} courses</span>
          <span class="badge badge-activity">${actCount} activities</span>
        </div>
        <div class="tree-courses">${coursesHtml || '<div style="padding:4px 0;font-size:12px;color:var(--muted2)">No courses</div>'}</div>
      </div>`;
  }).join("");
}

function toggleNode(header) {
  const chevron  = header.querySelector(".chevron");
  const children = header.nextElementSibling;
  if (!children) return;
  const isOpen = !children.classList.contains("hidden");
  children.classList.toggle("hidden", isOpen);
  chevron.classList.toggle("open", !isOpen);
}

function setAllNodes(open) {
  document.querySelectorAll(".tree-courses, .tree-activities").forEach(el => {
    el.classList.toggle("hidden", !open);
  });
  document.querySelectorAll(".chevron").forEach(ch => {
    ch.classList.toggle("open", open);
  });
}

// ── load ───────────────────────────────────────────────────────────────────
async function load() {
  showErr("");
  try {
    const [meRes, statsRes, treeRes] = await Promise.all([
      fetch(`${API}/me`,                    { credentials: "include" }),
      fetch(`${API}/admin/center-stats`,    { credentials: "include" }),
      fetch(`${API}/admin/activity-tree`,   { credentials: "include" }),
    ]);

    if (meRes.ok) {
      const me = await meRes.json();
      $("meName").textContent = me.fullName || me.email || "-";
      $("meRole").textContent = me.roleName || "-";
    }

    if (!statsRes.ok) throw new Error("center-stats " + statsRes.status);
    if (!treeRes.ok)  throw new Error("activity-tree " + treeRes.status);

    const statsData = await statsRes.json();
    const treeData  = await treeRes.json();

    renderKpis(statsData.summary ?? statsData);
    renderChart(statsData.byType ?? []);
    buildTree(treeData);

  } catch (e) {
    showErr(e.message);
  }
}

// ── init ───────────────────────────────────────────────────────────────────
(function init() {
  const themeBtn = $("themeToggle");
  themeBtn?.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    themeBtn.textContent = next === "dark" ? "\u{1F319}" : "\u{1F31E}";
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    load();
  });
  if (localStorage.getItem("theme") === "light" && themeBtn) themeBtn.textContent = "\u{1F31E}";

  $("btnRefresh")?.addEventListener("click", load);
  $("btnExpandAll")?.addEventListener("click",   () => setAllNodes(true));
  $("btnCollapseAll")?.addEventListener("click", () => setAllNodes(false));

  load();
})();

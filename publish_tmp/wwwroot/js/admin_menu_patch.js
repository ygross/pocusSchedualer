
/* Replace renderMenuByGroups in app.js */

function renderMenuByGroups(items, roles, start) {
  menuContainer.innerHTML = "";

  const orderedGroups = ["Instructor","CourseManager","Admin"];
  const groupsToShow = orderedGroups.filter(g => roles.includes(g));

  for (const group of groupsToShow) {
    const groupItems = items.filter(item => normalizeGroup(item.group) === group);
    if (!groupItems.length) continue;

    const title = document.createElement("div");
    title.className = "menuGroupTitle";
    title.textContent = GROUP_TITLES[group] || group;
    menuContainer.appendChild(title);

    const sectionOrder = ["מדריכים","פעילויות","דוחות","כללי"];
    const sections = [...new Set(groupItems.map(x => String(x.section || "").trim()).filter(Boolean))];

    const orderedSections = [
      ...sectionOrder.filter(s => sections.includes(s)),
      ...sections.filter(s => !sectionOrder.includes(s))
    ];

    for (const section of orderedSections) {
      const sectionTitle = document.createElement("div");
      sectionTitle.className = "menuSectionTitle";
      sectionTitle.textContent = section;
      menuContainer.appendChild(sectionTitle);

      for (const item of groupItems.filter(x => (x.section || "").trim() === section)) {
        addMenuButton(item, item.page === start);
      }
    }
  }
}

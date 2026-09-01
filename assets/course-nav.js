(() => {
  "use strict";

  const toggle = document.querySelector("#course-menu-toggle");
  if (!toggle) return;

  const courses = [
    ["kafka", "Kafka", "Event · 日志与流"],
    ["opensearch", "OpenSearch", "Document · 检索"],
    ["redis", "Redis", "Key · 内存数据"],
    ["postgresql", "PostgreSQL", "Row · 关系数据库"]
  ];
  const path = location.pathname.split("/").filter(Boolean);
  const current = courses.find(([key]) => path.includes(key))?.[0] || "";
  const menu = document.createElement("aside");
  menu.id = "course-menu";
  menu.className = "course-menu";
  menu.hidden = true;
  menu.setAttribute("aria-label", "切换课程");
  menu.innerHTML = `<header><strong>切换课程</strong><span>4 COURSES</span></header><nav>${courses.map(([key, name, note], index) =>
    `<a href="../${key}/" data-course="${key}" ${key === current ? 'aria-current="page"' : ""}><b>${String(index + 1).padStart(2, "0")}</b><span><strong>${name}</strong><small>${note}</small></span></a>`
  ).join("")}</nav>`;
  document.body.append(menu);
  toggle.setAttribute("aria-controls", menu.id);

  const close = (restoreFocus = false) => {
    menu.classList.remove("is-open");
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (restoreFocus) toggle.focus({ preventScroll: true });
  };
  const open = () => {
    menu.hidden = false;
    menu.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    menu.querySelector("[aria-current='page']")?.focus({ preventScroll: true });
  };

  toggle.addEventListener("click", event => {
    event.stopPropagation();
    menu.classList.contains("is-open") ? close() : open();
  });
  document.addEventListener("click", event => {
    if (menu.classList.contains("is-open") && !menu.contains(event.target)) close();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && menu.classList.contains("is-open")) {
      event.preventDefault();
      close(true);
    }
  });
})();

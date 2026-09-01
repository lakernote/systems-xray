(() => {
  "use strict";

  if (/^#slide-\d+$/.test(location.hash)) {
    location.replace(`./kafka/${location.hash}`);
    return;
  }

  const courses = [...document.querySelectorAll("[data-shortcut]")];
  const object = document.querySelector("#focus-object");
  const kind = document.querySelector("#focus-kind");
  const id = document.querySelector("#focus-id");
  const flow = document.querySelector("#focus-flow");
  const scanObject = document.querySelector(".scan-object");
  const tabs = [...document.querySelectorAll("[data-filter]")];
  const pageLabel = document.querySelector("#directory-page");
  const pagePrev = document.querySelector("#directory-prev");
  const pageNext = document.querySelector("#directory-next");
  const pageSize = 4;
  let filter = "all";
  let page = 0;

  const preview = course => {
    courses.forEach(link => link.classList.toggle("is-selected", link === course));
    const styles = getComputedStyle(course);
    document.documentElement.style.setProperty("--accent", styles.getPropertyValue("--course-accent").trim() || "#d45d13");
    document.documentElement.style.setProperty("--soft", styles.getPropertyValue("--course-soft").trim() || "#fff0e2");
    scanObject.classList.add("is-changing");
    window.setTimeout(() => {
      kind.textContent = course.dataset.kind;
      object.textContent = course.dataset.object;
      id.textContent = course.dataset.id;
      flow.textContent = course.dataset.flow;
      scanObject.classList.remove("is-changing");
    }, 90);
  };

  courses.forEach(course => {
    course.addEventListener("pointerenter", () => preview(course));
    course.addEventListener("focus", () => preview(course));
  });

  const renderDirectory = () => {
    const matching = courses.filter(course => filter === "all" || course.dataset.category === filter);
    const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
    page = Math.max(0, Math.min(page, pageCount - 1));
    const current = matching.slice(page * pageSize, page * pageSize + pageSize);
    courses.forEach(course => { course.hidden = !current.includes(course); });
    pageLabel.textContent = `${String(page + 1).padStart(2, "0")} / ${String(pageCount).padStart(2, "0")}`;
    pagePrev.disabled = page === 0;
    pageNext.disabled = page === pageCount - 1;
    if (current[0]) preview(current[0]);
  };

  tabs.forEach(tab => tab.addEventListener("click", () => {
    filter = tab.dataset.filter;
    page = 0;
    tabs.forEach(item => item.setAttribute("aria-selected", String(item === tab)));
    renderDirectory();
  }));
  pagePrev.addEventListener("click", () => { page -= 1; renderDirectory(); });
  pageNext.addEventListener("click", () => { page += 1; renderDirectory(); });

  addEventListener("keydown", event => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.target.matches("input,textarea,select")) return;
    const course = courses.find(link => link.dataset.shortcut === event.key);
    if (course) location.href = course.href;
  });

  renderDirectory();
})();

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

  const preview = course => {
    courses.forEach(link => link.classList.toggle("is-selected", link === course));
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

  addEventListener("keydown", event => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.target.matches("input,textarea,select")) return;
    const course = courses.find(link => link.dataset.shortcut === event.key);
    if (course) location.href = course.href;
  });
})();

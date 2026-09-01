(() => {
  "use strict";
  const slides = window.PG_COURSE || [];
  const stage = document.querySelector("#slide-stage");
  const prev = document.querySelector("#prev");
  const next = document.querySelector("#next");
  const overview = document.querySelector("#overview");
  const deep = document.querySelector("#deep-panel");
  const scrim = document.querySelector("#deep-scrim");
  let index = 0;
  let lastFocus = null;
  const esc = value => String(value ?? "").replace(/[&<>\"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[ch]);
  const inline = value => esc(value).replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  const plain = value => String(value ?? "").replaceAll("`", "");
  const two = n => String(n).padStart(2, "0");

  function footerMarkup(item) {
    return `<div class="slide-footer">
      <section><span>本页结论</span><p>${esc(item.takeaway)}</p></section>
      <section><span>关键参数 / 事实</span><dl>${item.facts.map(row => `<div><dt>${esc(row[0])}</dt><dd>${esc(row[1])}</dd></div>`).join("")}</dl></section>
      <section><span>设计取舍</span><p class="gain">＋ ${esc(item.tradeoff[0])}</p><p class="cost">− ${esc(item.tradeoff[1])}</p></section>
      <section><span>实现伪代码</span><pre><code>${esc(item.pseudo)}</code></pre></section>
    </div>`;
  }

  function slideMarkup(item, i) {
    return `<article class="slide mode-${esc(item.mode)}" data-stage="${esc(item.stage)}" data-index="${i}" aria-hidden="true">
      <header class="slide-heading">
        <div><span>${esc(item.section)}</span><h1>${inline(item.question)}</h1><p>${esc(item.lede)}</p></div>
        <div class="slide-identity"><small>${esc(item.layer)}</small><code>${two(i + 1)}</code></div>
      </header>
      <div class="visual-board" data-mode="${esc(item.mode)}">${window.renderPgVisual(item)}
        <div class="story-rail">${item.story.map((text, step) => `<p><b>${two(step + 1)}</b><span>${esc(text)}</span></p>`).join("")}</div>
      </div>
      ${footerMarkup(item)}
    </article>`;
  }

  function render() {
    stage.innerHTML = slides.map(slideMarkup).join("");
    const grid = document.querySelector("#overview-grid");
    let currentStage = "";
    grid.innerHTML = slides.map((item, i) => {
      const divider = item.stage !== currentStage ? `<h3>${esc(item.stageName)}</h3>` : "";
      currentStage = item.stage;
      return `${divider}<button type="button" data-overview-index="${i}"><span>${two(i + 1)}</span><b>${inline(item.question)}</b><small>${esc(item.section)}</small></button>`;
    }).join("");
  }

  function parseHash() {
    const match = location.hash.match(/slide-(\d+)/);
    return match ? Math.max(0, Math.min(slides.length - 1, Number(match[1]) - 1)) : 0;
  }

  function show(target, updateHash = true) {
    index = Math.max(0, Math.min(slides.length - 1, target));
    document.querySelectorAll(".slide").forEach((slide, i) => {
      slide.classList.toggle("is-active", i === index);
      slide.setAttribute("aria-hidden", i === index ? "false" : "true");
    });
    const item = slides[index];
    document.querySelector("#page-count").textContent = `${two(index + 1)} / ${two(slides.length)}`;
    document.querySelector("#header-count").textContent = `${two(index + 1)} / ${two(slides.length)}`;
    document.querySelector("#page-title").textContent = plain(item.shortTitle);
    document.querySelector("#header-title").textContent = plain(item.question);
    prev.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    next.querySelector("strong").textContent = index === slides.length - 1 ? "已学完" : "下一页";
    if (updateHash) history.replaceState(null, "", `#slide-${index + 1}`);
    document.title = `${two(index + 1)} · ${plain(item.shortTitle)} | Systems X-Ray`;
  }

  function openDeep(component = null) {
    const item = slides[index];
    lastFocus = document.activeElement;
    document.querySelector("#deep-kicker").textContent = `DEEP DIVE · ${item.section}`;
    document.querySelector("#deep-title").textContent = component?.name || plain(item.question);
    document.querySelector("#deep-stage").textContent = `${component ? "物理组件" : "当前边界"} · ${item.stageName}`;
    document.querySelector("#deep-boundary").textContent = component ? `${component.detail} ${item.deep.boundary}` : item.deep.boundary;
    const failures = component ? [`如果 ${component.name} 在这里阻塞或失败，当前事务不会无代价地越过这个边界。`, ...item.deep.failures] : item.deep.failures;
    document.querySelector("#deep-failure").innerHTML = failures.slice(0, 3).map(text => `<li>${esc(text)}</li>`).join("");
    document.querySelector("#deep-inspect").innerHTML = item.deep.inspect.map(row => `<p><span>${esc(row[0])}</span><code>${esc(row[1])}</code></p>`).join("");
    document.querySelector("#deep-question").textContent = item.deep.question;
    document.querySelector("#deep-answer-text").textContent = item.deep.answer;
    document.querySelector("#deep-answer").removeAttribute("open");
    const related = slides.map((slide, i) => ({slide, i})).filter(row => row.slide.stage === item.stage && row.i !== index).sort((a,b) => Math.abs(a.i-index)-Math.abs(b.i-index)).slice(0,2);
    document.querySelector("#deep-related").innerHTML = related.map(row => `<button type="button" data-related-index="${row.i}"><span>${two(row.i + 1)}</span>${inline(row.slide.question)}</button>`).join("");
    document.querySelector("#deep-source").href = item.source;
    deep.classList.add("is-open"); deep.setAttribute("aria-hidden", "false"); deep.inert = false;
    scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add("is-open"));
    document.querySelector("#deep-toggle").setAttribute("aria-expanded", "true");
    document.querySelector("#close-deep").focus({preventScroll:true});
  }

  function closeDeep() {
    deep.classList.remove("is-open"); deep.setAttribute("aria-hidden", "true"); deep.inert = true;
    scrim.classList.remove("is-open"); document.querySelector("#deep-toggle").setAttribute("aria-expanded", "false");
    setTimeout(() => { if (!scrim.classList.contains("is-open")) scrim.hidden = true; }, 180);
    lastFocus?.focus?.({preventScroll:true});
  }
  function openOverview() {
    lastFocus = document.activeElement; closeDeep(); overview.classList.add("is-open"); overview.setAttribute("aria-hidden","false"); overview.inert = false;
    document.querySelector("#open-overview").setAttribute("aria-expanded","true"); document.querySelector("#close-overview").focus({preventScroll:true});
  }
  function closeOverview() {
    overview.classList.remove("is-open"); overview.setAttribute("aria-hidden","true"); overview.inert = true;
    document.querySelector("#open-overview").setAttribute("aria-expanded","false"); lastFocus?.focus?.({preventScroll:true});
  }

  render(); show(parseHash(), false);
  prev.addEventListener("click", () => show(index - 1)); next.addEventListener("click", () => show(index + 1));
  document.querySelector("#deep-toggle").addEventListener("click", () => openDeep()); document.querySelector("#close-deep").addEventListener("click", closeDeep); scrim.addEventListener("click", closeDeep);
  document.querySelector("#open-overview").addEventListener("click", openOverview); document.querySelector("#close-overview").addEventListener("click", closeOverview);
  document.addEventListener("click", event => {
    const hot = event.target.closest("[data-component]"); if (hot) openDeep({name:hot.dataset.component,detail:hot.dataset.detail || ""});
    const ov = event.target.closest("[data-overview-index]"); if (ov) { show(Number(ov.dataset.overviewIndex)); closeOverview(); }
    const rel = event.target.closest("[data-related-index]"); if (rel) { show(Number(rel.dataset.relatedIndex)); closeDeep(); }
  });
  addEventListener("hashchange", () => show(parseHash(), false));
  addEventListener("keydown", event => {
    if (event.key === "Escape") { if (overview.classList.contains("is-open")) closeOverview(); else if (deep.classList.contains("is-open")) closeDeep(); }
    if (overview.classList.contains("is-open") || deep.classList.contains("is-open")) return;
    if (["ArrowRight","PageDown"," "].includes(event.key)) { event.preventDefault(); show(index + 1); }
    if (["ArrowLeft","PageUp"].includes(event.key)) { event.preventDefault(); show(index - 1); }
    if (event.key.toLowerCase() === "o") openOverview();
    if (event.key.toLowerCase() === "n") openDeep();
  });
})();

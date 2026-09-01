# Desktop UI Standard

## Target and acceptance

Systems X-Ray currently targets desktop learning. Treat `1440×900` and `1920×1080` as the primary acceptance viewports. The lesson should feel like a focused presentation canvas with web-native navigation and interaction.

Do not optimize or remove desktop content for phone layouts unless the user explicitly asks for mobile support. Existing responsive CSS may remain, but it is not a release blocker.

## Frame anatomy

Use one stable frame across all courses:

```text
global header: brand · course identity · progress · course switcher · contents/deep dive
lesson canvas: question · orientation · main explanatory visual
summary strip: conclusion · parameters/facts · trade-off · pseudocode/evidence entry
transport: previous · progress/mainline · next
```

The learner should not need to scroll the page or an inner panel during ordinary slide navigation. If the content does not fit, split the lesson.

## Hierarchy

- The question title is the largest text and must make sense in isolation.
- The orientation line says where the learner is and what to watch.
- The diagram owns the largest share of the canvas.
- The direct conclusion is readable without opening another panel.
- Supporting labels are secondary but not tiny.

Recommended ranges for common desktop viewports:

- slide title: `34–56px` depending on length;
- orientation/body: `16–22px`;
- component label: `14–20px`;
- metadata/eyebrow: `11–13px`, uppercase or monospace sparingly;
- critical text: never below `12px`.

Avoid long all-caps labels in Chinese and avoid dense monospace text outside values, paths, protocol fields, or pseudocode.

## Light visual language

- Use warm white/paper surfaces and dark blue-black ink.
- Avoid large black or dark panels. Small code/pseudocode panels may be dark for contrast.
- Use one course accent color and restrained neutral borders.
- Prefer a thin border plus subtle depth; do not stack heavy shadows.
- Keep corner radii consistent: small controls, medium components, larger lesson canvas.
- Use texture/grid only as a faint spatial aid, never as the dominant decoration.

The page should feel engineered and calm, not futuristic, game-dark, or dashboard-heavy.

## Controls and navigation

- Interactive targets are at least `44×44px`.
- Previous/next are persistent and visually dominant enough to discover immediately.
- `←` and `→` change slides; the browser Back button returns to the prior slide.
- Course switching has the same position and behavior in every course.
- Current course and current slide are unmistakable.
- Focus, hover, active, disabled, and selected states are all distinct.
- Never rely on hover for required teaching content.

## Progressive disclosure

Keep on the slide:

- the mechanism needed to answer the title;
- the default behavior;
- success/failure boundary;
- the few configuration values that change the conclusion;
- the main trade-off.

Put in a deep-dive panel:

- long source references;
- full request/response examples;
- extended configuration tables;
- alternative failure timelines;
- commands for reproducing or measuring the behavior.

The panel must add evidence or depth. It must not repeat the slide or hide an essential answer.

## Interaction and motion

Good interaction changes the model:

- toggle `acks=1` vs `acks=all` and show the ACK boundary move;
- fail a primary and show promotion plus potential unavailable/lost state;
- advance refresh/merge and show visibility or disk reclamation change;
- adjust consumer count and show assignment/rebalance consequences.

Avoid UI controls that merely open decorative cards. If a component is clickable, the result should explain that component's inputs, state, outputs, configuration, and trade-off in the current mechanism.

## Desktop visual QA

At both target viewports verify:

- no document-level horizontal scroll;
- no scrollbars inside the main lesson canvas;
- title, diagram, summary strip, and navigation all fit;
- no content is hidden behind fixed bars;
- diagrams remain legible at 100% browser zoom;
- current slide survives refresh/deep link;
- browser Back/Forward traverses slide history;
- keyboard focus is visible;
- animation off/reduced still leaves the mechanism clear.


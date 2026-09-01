---
name: systems-xray-course-builder
description: Design, implement, or review Systems X-Ray interactive desktop principle courses in this repository. Use for Kafka, OpenSearch, Redis, PostgreSQL, JVM, Spring Boot, Kubernetes, or other middleware lessons; slide order; teaching copy; physical diagrams; state animations; and cross-course UI consistency. Do not use for unrelated websites or ordinary documentation.
---

# Systems X-Ray Course Builder

Build a desktop-first interactive course that lets a learner follow one concrete object through the real system. Treat the course as a guided technical investigation, not a collection of feature cards or a static slide dump.

## Read the right references

- Read [references/teaching-playbook.md](references/teaching-playbook.md) before designing or reordering a course.
- Read [references/diagram-grammar.md](references/diagram-grammar.md) before creating or changing a technical visual.
- Read [references/desktop-ui.md](references/desktop-ui.md) before changing layout, navigation, typography, or motion.
- Read [references/technical-review.md](references/technical-review.md) before approving technical content or doing a whole-course review.
- Also respect the repository's [course authoring rules](../../../docs/course-authoring.md).

## Non-negotiable course contract

1. Choose one named protagonist and preserve its identity across the whole course.
2. Begin with the learner's business intent and a high-level physical map.
3. Follow real causal order from API to process, memory, network, storage, replica, visibility, read, failure, and recovery.
4. Let every slide answer exactly one question.
5. Show state change as `Before → Current → After` whenever a mechanism mutates state.
6. Make every arrow state who initiates, what moves, why it moves, and when the step is complete.
7. Separate `accepted`, `acknowledged`, `durable`, `committed`, `visible`, and `processed` when they differ.
8. Explain the default first. Introduce a non-default configuration only with its reason, benefit, cost, and failure boundary.
9. Derive concise pseudocode from official behavior or source semantics. Do not paste long source listings into the lesson.
10. End with production reasoning: core operations, performance, high availability, consistency, failure modes, configuration trade-offs, and comparison with another system.

## Required workflow

### 1. Establish the learning contract

Write down:

- protagonist and stable example data;
- starting business action and final observable result;
- the 5–9 questions the learner should be able to answer;
- system/version/configuration scope;
- success conditions and at least one failure branch.

Do not start by enumerating classes, APIs, or configuration names.

### 2. Research in two layers

Use official documentation, protocol descriptions, and source behavior as the truth layer. Use strong courses, books, and visual explainers only to improve sequencing and explanation.

For each important claim, identify:

- actor and active/passive direction;
- data or operation transferred;
- in-memory and on-disk state before and after;
- acknowledgement condition;
- visibility condition;
- recovery behavior;
- configuration and trade-off.

### 3. Design the course spine

Use this order unless the system requires a justified variation:

```text
Business action
→ high-level physical map
→ request/object anatomy
→ routing and coordination
→ write/update/delete path
→ visibility and read/search path
→ physical storage
→ replication and acknowledgement
→ failure and recovery
→ performance
→ high availability
→ consistency guarantees
→ configuration trade-offs
→ cross-system comparison
```

Introduce a term before relying on it. If one slide needs two state transitions or more than eight explained components, split it.

### 4. Draw for explanation

Choose one diagram purpose per slide: topology, handoff sequence, physical containment, state transition, or comparison. Keep one dominant reading path and one highlighted current actor. Use labels on arrows and visible boundary nesting. See the diagram grammar for exact rules.

### 5. Implement as an interactive desktop lesson

Use the repository's static HTML/CSS/JavaScript architecture unless the user explicitly requests another stack. Keep the light visual system, common header/course switcher, 16:9 teaching canvas, summary strip, and previous/next navigation.

Use motion only when it explains a transition. Prefer a deliberate learner action that moves the same diagram from before to after. Never use decorative autoplay as a substitute for an explanation.

### 6. Review and verify

Review the entire course in order, not isolated slides. Verify at least `1440×900` and `1920×1080` desktop viewports. The teaching canvas must not require horizontal or internal scrolling, controls must be at least 44px, browser Back must return to the previous slide, and no critical text may depend on hover alone.

Mobile compatibility is not a current acceptance requirement. Do not spend course-design time compressing or hiding desktop teaching content for phone screens unless the user explicitly reopens that scope.

## Stop conditions

Do not approve a slide when any of these is true:

- it is a row of boxes with no mechanism or state change;
- the title names a topic instead of asking a useful question;
- an arrow has no direction or payload meaning;
- the diagram mixes logical and physical boundaries without labeling them;
- “success” is asserted without an acknowledgement or visibility condition;
- a config value appears without explaining whether it is default and why it is used;
- the bottom summary repeats the slide verbatim;
- important content is hidden in “more details” merely to make the slide look empty;
- content is made to fit by shrinking type or adding a scrollbar.


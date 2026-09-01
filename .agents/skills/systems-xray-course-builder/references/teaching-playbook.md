# Teaching Playbook

## What to learn from strong explainers

Use several teaching traditions together; each solves a different problem.

### ByteByteGo: establish the map

Borrow the strengths of a sparse, layered overview:

- show the system boundary and major layers first;
- give the eye one dominant route through the picture;
- use short callouts for the few ideas that matter now;
- make comparison and grouping visible through position, not paragraphs.

Do not stop at the overview. A clean architecture map is orientation, not proof of how the mechanism works.

Reference: [Why is Kafka fast?](https://blog.bytebytego.com/p/why-is-kafka-so-fast-how-does-it)

### Focused animation courses: advance one state at a time

The useful pattern in focused middleware animations is “one question, one local mechanism, one visible state change.” A Page Cache lesson should animate the bytes and acknowledgement boundary; an HW lesson should animate offsets and replica state. It should not redraw the whole platform on every frame.

Reference used for this project: [动画讲解 Kafka 运行原理](https://www.bilibili.com/video/BV1ds4y1h7zn/)

### Confluent architecture course: build concepts in dependency order

Borrow the progression from primitives to planes and guarantees:

```text
event / record
→ topic / partition / offset
→ broker and storage
→ producer and consumer
→ data plane and control plane
→ replication, durability, ordering, transactions
```

This prevents a learner from encountering ISR, HW, rebalance, or transactions before understanding the state those mechanisms protect.

Reference: [Apache Kafka Architecture and Internals](https://developer.confluent.io/courses/architecture/get-started/)

### DDIA: teach the tension before the mechanism

Before presenting a design, state the problem it solves and the competing goals. Then explain the mechanism, the failure mode, and the cost. This turns “Kafka uses X” into a portable design principle the learner can compare with Redis, OpenSearch, and PostgreSQL.

Reference: [Designing Data-Intensive Applications](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781098119058/)

### Jepsen: make guarantees observable

Translate vague claims into an observable property:

- What history is allowed?
- What must never happen?
- What may be delayed?
- Which fault is injected?
- What trace, counter, or response proves the result?

Use this pattern for leader failure, stale reads, duplicate delivery, lost acknowledgement, split brain, and recovery.

Reference: [Jepsen analyses](https://jepsen.io/analyses)

## The golden lesson arc

Use this arc for a mechanism that spans several slides:

1. **Scenario** — a concrete production action with stable example data.
2. **Question** — one thing the learner cannot yet explain.
3. **Map** — highlight where this step occurs in the whole system.
4. **Before** — show the relevant state before the operation.
5. **Action** — show the active component, payload, and state mutation.
6. **After** — show the new state and what remains unchanged.
7. **Success** — define acknowledgement, durability, or visibility precisely.
8. **Failure** — change one condition and walk the alternative path.
9. **Trade-off** — connect the mechanism to latency, throughput, durability, availability, memory, disk, or operational cost.
10. **Transfer** — compare how another system solves the same tension.

Do not force all ten steps onto one slide. Use 2–4 consecutive slides and keep the data-flow context stable.

## One-slide content formula

Every slide should contain:

- a question title;
- a one-sentence orientation line;
- one main visual;
- a direct answer;
- the behavior-changing parameters/facts;
- one benefit and one cost;
- short pseudocode only when it reveals decision order.

The slide body explains. The bottom strip summarizes and enables transfer. The deep-dive panel holds evidence, validation commands, long failure timelines, or extended parameter tables. These three layers must not repeat the same text.

## Cross-system learning lens

Use the same questions for every technology so the learner builds transferable intuition:

| Lens | Questions |
|---|---|
| Core operations | What is the complete data path for create/read/update/delete—or their real equivalents? |
| Performance | Where are batching, caching, sequential I/O, zero-copy, pipelining, parallelism, or reduced coordination used? |
| High availability | Who replicates, who detects failure, who elects/promotes, and what state may be lost? |
| Consistency | What ordering, isolation, visibility, and durability guarantees exist, and under which configuration? |
| Trade-off | Which resource or guarantee is exchanged for latency, throughput, availability, or simplicity? |
| Comparison | Why does another system make a different choice for the same problem? |

Do not force database CRUD terms onto an append-only log. Explain the true semantic operation first—for example append, tombstone, retention, MVCC version, or immutable segment replacement.

## Pseudocode rules

Pseudocode should expose a decision or state transition, not mimic a class listing:

```text
target = route(index, id, routing ?? id)
result = primary.apply(operation)
for replica in active_replicas(target):
    replica.apply(result.concrete_operation)
return when required_copies_ack()
```

Annotate what the learner should notice. Keep it under roughly 12 lines. Put exact source paths and long excerpts in evidence notes, not the main slide.

## Common teaching failures

- **Glossary order**: listing terms before the learner has a problem requiring them.
- **Poster diagram**: a large map with everything visible but no current action.
- **Card cemetery**: repeated boxes with nouns, no data, state, or completion condition.
- **Premature exceptions**: teaching a custom routing key or advanced option before the default.
- **Magic success**: an ACK appears without naming required copies or persistence policy.
- **Hidden essentials**: critical facts live only behind a click.
- **Decorative animation**: dots move, but state and guarantees never change.

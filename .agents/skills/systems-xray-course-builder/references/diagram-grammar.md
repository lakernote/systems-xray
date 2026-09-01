# Diagram Grammar

## Start from the CRUD/data path

The default diagram is the operation's data flow: request, routing, state change, acknowledgement, visibility, and later cleanup/recovery. A physical topology is optional. Add hosts, processes, operating-system layers, or disks only when their location or boundary changes the explanation.

Do not make the learner traverse an infrastructure map merely to understand a CRUD operation.

## First choose what the diagram must prove

Use only one primary diagram type on a slide.

| Diagram type | Use it to answer | Required content |
|---|---|---|
| CRUD/data flow | “This operation goes through which decisions and states?” | request, routing, current state, mutation, response, visibility |
| Physical topology | “Does location or boundary change the behavior?” | only the relevant host/process/node/disk boundaries |
| Handoff sequence | “Who calls whom, in what order?” | actors, numbered arrows, payload, ACK/return path |
| Physical containment | “What is inside what?” | cluster → node → process → memory/file nesting |
| State transition | “What changed?” | Before/Current/After and named state variables |
| Comparison | “Why choose A instead of B?” | same dimensions, explicit win/loss, no mixed scales |

Prefer CRUD/data flow. Do not use a topology to explain timing, or a sequence to imply physical containment.

## The arrow contract

Every arrow must answer four questions:

1. Who initiates it?
2. What crosses the boundary: request, bytes, operation, metadata, page, record, or acknowledgement?
3. What triggers it?
4. When is this step considered complete?

Label arrows with verbs and payloads such as `append ProduceRequest`, `replica fetch(offset=43)`, `fsync WAL`, or `return after quorum ACK`. Avoid labels like `process`, `data`, or `flow`.

Use:

- solid arrow for actual data/operation transfer;
- dashed arrow for metadata, control, dependency, or asynchronous relation;
- return arrow for ACK/result when its timing changes the guarantee;
- muted previous/next path and one accent-colored current path.

## Boundary grammar

Draw real containment only when it matters. When relevant, use this order:

```text
region / availability zone
└── physical or virtual host
    └── process / container / JVM
        ├── thread or execution context
        ├── heap / native memory / buffer
        └── OS boundary
            ├── socket / page cache
            └── block device / file
```

Logical objects such as topic, index, table, consumer group, or shard assignment must not visually masquerade as physical hosts. Label logical and physical boundaries explicitly.

## Show state, not just nouns

Attach the protagonist to the state it currently inhabits. Show at least one concrete value:

- Kafka: key, partition, batch, offset, LEO/HW/LSO;
- OpenSearch: `_id`, routing, seq_no, VersionMap entry, segment docID/liveDocs;
- Redis: key, dict bucket, encoding, TTL, replication offset;
- PostgreSQL: tuple version, xmin/xmax, page LSN, WAL LSN.

For mutation, display values before and after:

```text
Before: docID 7 live, price=249
Current: docID 42 appended, docID 7 liveDocs=false
After merge: only docID 42 copied to the new segment
```

## Density and reading order

- One dominant left-to-right or top-to-bottom reading path.
- Prefer 3–7 explained components; split above 8.
- Highlight one current actor and one protagonist.
- Keep supporting detail close to the component it explains.
- Use whitespace as grouping; do not fill every part of the canvas.
- A learner should identify the start, current step, and result within three seconds.

If a system-wide overview needs more components, group them into named layers and defer internal detail to later slides.

## Color and shape semantics

Use the shared light palette:

| Meaning | Color |
|---|---|
| Paper/background | `#FBFAF6` / `#F5F1E8` |
| Ink | `#172033` |
| Muted text | `#66738A` |
| Kafka accent | `#D45D13` |
| OpenSearch accent | `#087F75` |
| Redis accent | `#C74235` |
| PostgreSQL accent | `#2D67C7` |
| Success/available | green only |
| Fault/data loss danger | red only |

Use the course accent for the current action, not for every border. Never encode meaning by color alone; add text, shape, icon, or line style.

Keep shapes stable:

- rounded container: boundary or scope;
- squared unit: component or stored structure;
- cylinder/file strip only for actual durable storage;
- pill: protagonist identity or current state value;
- small badge: step, role, version, or status.

## Motion rules

Animate only when state changes:

- move the same protagonist along a labeled path;
- reveal an ACK after its required condition becomes true;
- change a state value in place;
- cross-fade old/new versions during update or merge;
- highlight failure and reroute on learner action.

Keep durations short and deliberate. Pause after each meaningful transition. Respect `prefers-reduced-motion`. The static state before and after must remain understandable without animation.

## Diagram review questions

- Can the learner follow the CRUD/data path without first decoding infrastructure?
- Are physical boundaries included only where they change behavior or guarantees?
- Is the active side of replication clear: push, pull, or coordinated operation?
- Is the protagonist visible at this step?
- Does the arrow carry a named payload or operation?
- Does the diagram show what changed and what did not?
- Can the success condition be inferred from the return path?
- Would removing any box make the explanation clearer? If yes, remove it.

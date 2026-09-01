# Technical Review Standard

## Truth and pedagogy are separate layers

Use version-matched official documentation, protocols, and source semantics to establish facts. Use blogs, courses, and diagrams to improve explanation, not to settle disputed technical behavior.

For every major mechanism, record:

- product/version and relevant mode;
- default behavior;
- non-default configuration shown in the example;
- active/passive direction;
- success and visibility conditions;
- failure and recovery behavior;
- performance, availability, durability, and consistency costs.

If behavior changes by version, protocol generation, deployment mode, or managed service, say so on the slide or in the evidence panel.

## Define overloaded success words

Never use these as synonyms unless the system truly makes them equivalent:

| Term | Question to answer |
|---|---|
| Accepted | Did a component admit the request into its queue or execution path? |
| Acknowledged | Which component/copies completed what condition before replying? |
| Durable | Which failure can occur without losing the operation? Memory, process, host, zone? |
| Committed | Which protocol state makes the value safe/eligible for readers? |
| Visible | Which read path can observe it: point GET, searcher, follower, snapshot? |
| Processed | Did the downstream business action finish, and was its progress recorded? |

Use these definitions in diagrams and summaries. A successful API response is not automatically durable, searchable, replicated, or processed.

## The mechanism audit

For every write/update/delete/read/search flow, answer in order:

1. Which node receives the request?
2. How is the logical target resolved?
3. How is the target partition, shard, key slot, page, or row selected?
4. Which thread/event loop executes it?
5. What in-memory state changes?
6. What log/file/page changes?
7. Who initiates replication, and what exact operation/data is replicated?
8. How many/which replicas must respond?
9. What does the client response prove?
10. When can each read path observe the result?
11. What happens if failure occurs before or after the response?
12. Which background process later compacts, merges, checkpoints, expires, or reclaims space?

Delete/update slides must name where the logical deletion is represented and when physical bytes are actually reclaimed.

## Configuration audit

For every configuration shown, include:

- actual setting name;
- default for the stated version/mode;
- why the example changes it;
- behavior before and after;
- benefit;
- latency/throughput/durability/availability/memory/disk/operational cost;
- interacting settings that may invalidate the conclusion.

Never present an arbitrary example such as `routing=tenant-17` before teaching the default (`_id`-based routing, if applicable) and the reason to override it.

## System-specific questions

### Kafka

- Is the message still an object, serialized bytes, a record batch, or a log entry at this step?
- How were topic metadata and partition leader chosen?
- Which producer thread owns batching and network I/O?
- Is replication follower-pull or leader-push, and how do LEO/HW/ISR change?
- What do `acks`, `min.insync.replicas`, idempotence, and transactions each guarantee?
- Is “delete” retention, tombstone plus compaction, or filesystem segment removal?
- When does a consumer fetch, process, and commit its offset, and what duplicates/loss can result?

### OpenSearch

- Is routing default `_id` or an explicit routing value, and which shard formula applies?
- Does the primary execute a script and send a concrete replica operation?
- What changes in VersionMap, IndexWriter buffer, translog, Lucene segments, liveDocs, and sequence numbers?
- Does the acknowledgement depend on all assigned shard copies, and how does `wait_for_active_shards` affect admission rather than completion?
- Why can real-time GET see a document before Search, and what does refresh change?
- Where is deletion recorded, and when does merge reclaim bytes?

### Redis

- Which event loop/thread executes the command, and when are I/O threads involved?
- Which dictionary/object encoding represents the value now?
- Does expiry happen passively, actively, or both?
- When does AOF/RDB make the write recoverable, and what can be lost under each fsync policy?
- Is replication asynchronous, and what does `WAIT` improve without turning it into strict durability?
- What happens during Sentinel/Cluster failover, resharding, and client redirection?

### PostgreSQL

- Which backend process owns the query and transaction?
- How do parser, rewriter, planner, executor, buffer manager, and storage manager participate?
- Which tuple version and xmin/xmax values are visible to this snapshot?
- Is WAL inserted/flushed before the dirty data page, and what does commit ACK prove?
- How do checkpoint, background writer, and crash recovery interact?
- Is replication synchronous or asynchronous, and what exact synchronous commit level is configured?
- What do locks prevent that MVCC alone does not?

## Whole-course review

Review slides sequentially and make a dependency list. Fail the review if a term is relied on before definition, if state values change inconsistently, or if the same protagonist silently changes identity.

For each section, check:

- **mechanism**: complete causal path;
- **implementation depth**: relevant process, memory, network, and durable structures are distinguished without becoming the course's organizing axis;
- **guarantee**: success/visibility/failure boundary is explicit;
- **production use**: default, tuning, diagnosis, and trade-off are actionable;
- **transfer**: one comparison shows why another system chooses differently;
- **visual truth**: diagrams agree with text and pseudocode.

Remove slides that only restate a definition or repeat the previous diagram without adding a state transition, guarantee, failure, or trade-off.

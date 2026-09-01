# Kafka 课程内容审查

审查基线：Apache Kafka 4.1。课程目标不是罗列 Kafka 的所有类名，而是让学习者能沿着一条 `Event #A1024` 的数据路径，解释写入、存储、复制、读取、处理、提交、失败恢复与设计取舍。

## 当前结论

- 共 77 页，固定使用「上一页 / 下一页」推进；1440×900 和 1920×1080 桌面视口均要求主页面无滚动。
- 主线完整：业务事实 → Producer → Partition → Broker → Segment → Replica → Consumer Group → 业务副作用 → Offset Commit。
- 讲解顺序已从“组件目录”改为“问题 → 状态变化 → 配置 → 取舍 → 故障验证”。
- 伪代码只表达设计不变量，不要求学习者追 Kafka 源码类名。
- 关键技术事实以 Apache Kafka 4.1 文档和源码为准；外部课程仅用于借鉴教学结构。

## 2026-09 教学增强

| 模块 | 增强内容 | 要解决的理解障碍 |
|---|---|---|
| 开场 | 新增“为什么不直接同步调用下游” | 先理解 Kafka 解决的业务冲突，再进入术语。 |
| Retention | 独立讲整段删除、Log Start Offset 与 Consumer 越界 | 避免把 Commit 误认为消息删除。 |
| Compaction Update | 用同 Key 的 V1/V2 展示 append-new + clean-old | 说明 Kafka 没有原地 Update，旧新版本会暂时共存。 |
| Tombstone Delete | 展示旧值、Tombstone、第一次 Cleaner、删除窗口 | 说明“逻辑删除”和“物理回收”不是同一时刻。 |
| DelayedProduce | 展示 Handler 释放、Purgatory watch、Follower 推进与唤醒 | 解释 `acks=all` 等副本为什么不会占死 Handler。 |
| KRaft 控制面 | 展示故障检测、Controller 决策、Metadata Log 提交与传播 | 解释新 Leader 如何成为全局一致的元数据结论。 |
| Transaction | 拆成 Coordinator、HW/LSO、Offsets in Transaction 三页 | 区分复制提交、事务可见与 Kafka→Kafka EOS。 |
| DelayedFetch | 展示不足 `fetch.min.bytes` 时的条件等待 | 解释长轮询不是线程 sleep。 |
| 积压 | 用到达率、Fetch 率、处理率、安全 Commit 率建模 | 让 Lag 从结果数字变成可定位的速率方程。 |
| 并发消费 | 比较一线程一 Consumer 与 poll + workers | 解释线程安全、Partition 顺序和连续完成水位。 |
| 延迟预算 | 汇总 Producer、Broker、副本、Fetch、业务五段延迟 | 避免把端到端延迟误判成单次 Broker RTT。 |

## 已纠正的关键边界

1. `min.insync.replicas` 约束 `acks=all` 写入是否被接纳，不是 Consumer 读取 HW 的额外条件。
2. `acks=all` 等待当前 ISR 的复制条件；不等于所有配置副本，也不等于每条消息逐盘 `fsync`。
3. Follower 主动向 Leader 发 Fetch；不是 Leader Push 副本。
4. 普通读取不越过 HW；`read_committed` 还受 LSO 约束，并过滤 Abort 数据。
5. Retention 按关闭 Segment 回收且不等待 Consumer；Compaction 重写关闭 Segment，不修改幸存 Record 的 Offset。
6. Compact Topic 的 Update 是追加新版本；Delete 是 `key + null value` Tombstone，物理清理稍后发生。
7. KafkaConsumer 不是线程安全的；并发 Worker 只能提交每个 Partition 无空洞的连续完成水位。
8. Offset Commit 只保存恢复位置，不自动提交数据库、HTTP 或缓存副作用。

## 逐段验收问题

### Producer

- 为什么 `send()` 返回不代表 Broker 已确认？
- Key、Partition 数和顺序保证之间是什么关系？
- BufferPool 满了为何会把背压传回业务线程？
- ACK 丢失后为什么会重试，幂等 Producer 如何识别重复批次？

### Broker 与存储

- Offset 在哪里分配，RecordBatch 与 Record 是什么关系？
- Segment 四类文件分别解决什么定位或事务问题？
- 为什么 ACK 与物理介质落盘不是同一个边界？
- DelayedProduce / DelayedFetch 如何把“等待条件”从 Handler 中剥离？

### 高可用与一致性

- RF、ISR、LEO、HW、minISR、acks 分别回答什么问题？
- KRaft Controller Quorum 与 Partition Replica 是不是同一套复制？
- HW 已推进时，为什么 `read_committed` 仍可能暂时读不到？
- Kafka 事务能覆盖外部数据库吗？不能时用什么边界设计？

### Consumer

- Group、Member、Partition 和 Coordinator 各自负责什么？
- Rebalance 为什么发生，Cooperative 与 Static Membership 分别减少什么成本？
- Position 与 Committed Offset 为什么会不同，处理 42 后为何提交 43？
- poll + worker 模式为什么不能提交“最大的已完成 Offset”？

### 生产故障

- Lag 增长是 Producer 太快、Fetch 太慢、处理太慢还是 Commit 太慢？
- 一条坏消息怎样隔离，同时保留原 Topic/Partition/Offset 与重放证据？
- 调大 `linger.ms`、`fetch.min.bytes`、`acks` 或事务分别会影响哪段延迟？
- 哪个状态证明消息写入成功，哪个状态证明业务副作用成功？

## 后续独立课程，不挤进本主线

- Kafka Connect、Kafka Streams、MirrorMaker 与跨集群复制。
- KRaft/Raft 的完整选举、日志匹配、快照与成员变更。
- Tiered Storage 与远端 Fetch。
- TLS/SASL/ACL 的证书和权限运维。
- 容量模型、压测、完整 JMX 面板和故障演练实验。

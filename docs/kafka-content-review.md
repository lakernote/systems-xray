# Kafka 课程逐页审查

审查基线：Apache Kafka 4.1。目标范围不是“Kafka 所有功能”，而是把一条消息从业务对象、Producer、网络、Broker、物理日志与副本，一直讲到 Consumer 处理、提交和恢复。

## 审查结果

- 共 66 页；每页现在都直接显示「这一步发生什么 / 生产配置 / 为什么这样设计 / 实现模型」。
- 新增 2 个此前缺少的生产主题：`auto.offset.reset`、`pause/resume` 背压。
- 修正 8 类易误解表述：消息大小的压缩边界、Schema 发布顺序、BufferPool 指标、`acks=all`、`min.insync.replicas`、LSO、Consumer 心跳与 `poll()`、事务场景下的 Lag。
- 讲义的核心解释已经进入 PPT；抽屉只保留更长配置表与实现依据，不再承担基础理解。

## 逐页结论

| 页 | 页面 | 审查结论 |
|---:|---|---|
| 01 | 一条 Event 的完整旅程 | 通过：定义单一主角、范围与最终恢复点。 |
| 02 | 先看整张地图 | 已重构：逐 Broker 展示 6 个 Partition 的 Leader/Follower Replica；高亮 #A1024 的 Produce、P1 副本、C0 Fetch 与 Offset 42→43，并补齐 Metadata、Group Coordinator、`__consumer_offsets` 控制面。 |
| 03 | Event 在代码里出生 | 通过：业务对象、`topic/key/value/headers`、`ProducerRecord` 与代码注释完整。 |
| 04 | send 不是直接发网络 | 通过：区分应用线程、入批、Sender、Future 与 `max.block.ms`。 |
| 05 | 拦截器经过 Event | 通过：`onSend` 位于序列化/分区之前，慢拦截器会增加调用线程延迟。 |
| 06 | 先认识集群，再发送 | 通过：`bootstrap.servers` 只负责发现，Metadata 才保存 Leader 路由。 |
| 07 | 对象变成字节 | 通过：Key/Value 分别序列化，Header value 原本就是 `byte[]`。 |
| 08 | 字节太大会在哪里失败 | 已修正：Producer 约束未压缩批次/请求，Broker Topic 上限看压缩后批次，首个超大 Fetch Batch 可为保证前进而返回。 |
| 09 | Schema 也要演进 | 已修正：BACKWARD 常 Reader-first，FORWARD 常 Writer-first，发布顺序不能一概而论。 |
| 10 | Key 选择 Partition | 通过：显式 Partition 优先，Key 使用序列化后字节的 Murmur2；示例哈希与 P1 已复算。 |
| 11 | Key 不是免费的顺序 | 通过：热点 Key、空 Key Sticky 行为、扩 Partition 重映射与局部顺序取舍齐全。 |
| 12 | 进入 ProducerBatch | 通过：按 TopicPartition 建队列，`batch.size/linger.ms/compression` 的因果关系清楚。 |
| 13 | Buffer 满了，send 会卡住 | 已修正：指标改为真实的 `bufferpool-wait-ratio` / `bufferpool-wait-time-total`。 |
| 14 | 压缩发生在 Batch 级别 | 通过：压缩发生在 RecordBatch，通常由 Broker 原样存储/复制，端点承担主要压缩 CPU。 |
| 15 | 找到 P1 Leader | 已调序：Producer 先依据 Metadata 找到 P1 Leader，随后才能按 Broker Drain 并组装请求。 |
| 16 | Sender 组装请求 | 通过：Ready、Drain、按 Broker 合并 ProduceRequest、后台网络线程边界清楚。 |
| 17 | 一条连接上可以有多个请求 | 通过：`max.in.flight=5`、幂等序列与关闭幂等后的乱序风险准确。 |
| 18 | 经过操作系统与网络 | 通过：Kafka Protocol、Java NIO、TLS 用户态、内核 TCP、NIC 边界清楚。 |
| 19 | Broker 接住请求 | 通过：Acceptor、Processor、RequestChannel、Handler、KafkaApis、ReplicaManager 分工清楚。 |
| 20 | 请求先过安全闸门 | 通过：认证、ACL 与 Quota 位于业务追加前；不把安全检查混入日志格式。 |
| 21 | Broker 校验字节，不校验业务 | 通过：Broker 验证协议、权限、大小、时间戳和批次，不理解 JSON/业务 Schema。 |
| 22 | Offset 由 Leader 分配 | 通过：Leader 以当前日志末端为批次分配 baseOffset，Record 用 delta 得到最终位置。 |
| 23 | Topic 到 Segment | 通过：`Topic → Partition → Segment → RecordBatch → Record` 层级完整。 |
| 24 | 真正落盘的是 RecordBatch | 已调序：先解释物理写入单元，再展开承载它的四类 Segment 文件。 |
| 25 | 变成四类文件 | 通过：`.log/.index/.timeindex/.txnindex` 作用和相同 baseOffset 命名准确。 |
| 26 | Active Segment 什么时候滚动 | 通过：大小/时间任一条件触发 Roll，Partition 日志连续而文件分段。 |
| 27 | Kafka 删除的是旧 Segment | 通过：Delete、Compact、Tombstone 与 Active Segment 不直接删除的边界清楚。 |
| 28 | 先写 Page Cache | 通过：`write()` 先进入 Linux Page Cache，writeback 与逐条 ACK 不是同一时刻。 |
| 29 | 磁盘路径也会成为瓶颈 | 通过：`log.dirs`、Retention、Replica 容量乘数、盘满与慢盘故障链完整。 |
| 30 | Follower 主动拉取副本 | 通过：复制方向是 Follower Fetch Leader，不是 Leader Push。 |
| 31 | LEO、ISR、HW 一次讲清 | 已修正：HW 是当前 ISR 的复制边界；普通可见性还要求 ISR 数量达到 `minISR`。 |
| 32 | acks=0/1/all 差在哪 | 已修正：`acks=all` 等待每个当前 ISR，并要求 ISR 数量达到 `minISR`；不是只等 `minISR` 个副本。 |
| 33 | min.insync.replicas 是写入底线 | 已补版本说明：经典 RF=3/minISR=2 语义准确；Kafka 4.1 启用 ELR 时需按 ELR 重新判断。 |
| 34 | 成功最终回到 Callback | 通过：ProduceResponse、correlation id、Batch 完成、Buffer 归还、RecordMetadata 关系清楚。 |
| 35 | 重试由总时间预算约束 | 通过：`delivery.timeout.ms` 约束排队、等待 ACK 与可重试失败的总生命周期。 |
| 36 | Broker 如何识别重复批次 | 通过：PID、Epoch、Sequence 的单会话单 Partition 幂等边界准确。 |
| 37 | Leader 挂了，消息去哪 | 通过：ISR 选主、Leader Epoch、Metadata 刷新、unclean election 风险清楚。 |
| 38 | 事务消息何时对 Consumer 可见 | 已修正：`read_committed` 的可见末端是 LSO，LSO 不超过 HW；中止数据与事务标记不会交给业务。 |
| 39 | 为什么 Broker 坏了，消息还能继续走 | 已重构为高可用蓝图：副本布局、ISR/ELR、安全确认边界与 Leader Epoch 换主组成一套机制，并直接展示实现伪代码与可用性代价。 |
| 40 | Consumer Group 到底是什么 | 通过：组内分摊、组间广播、Partition 决定并行上限。 |
| 41 | Group Coordinator 在哪里 | 通过：Coordinator 管成员与 Offset，Fetch 仍直达 Partition Leader，`__consumer_offsets` 作用清楚。 |
| 42 | 第一次 poll 为什么会等 | 通过：Coordinator 发现、入组、分配、初始化 Position；Classic 与新 Consumer Protocol 均有说明。 |
| 43 | 分区怎么分才算好 | 已调序：先由 Assignor 决定 Partition 所有权，再为每个已分配 Partition 初始化读取位置。 |
| 44 | 没有有效 Commit 时从哪开始 | 新增：完整解释 `earliest/latest/by_duration/none`，并强调只在无有效恢复点时生效。 |
| 45 | 什么会触发 Rebalance | 通过：成员、会话、Poll、订阅与 Partition 变化齐全。 |
| 46 | 为什么有的 Rebalance 会全停 | 通过：Eager 全撤销与 Cooperative 增量转移区别清楚。 |
| 47 | 重启一次，不必立刻换分区 | 通过：Static Membership 的稳定 ID、Session 等待与故障接管变慢取舍齐全。 |
| 48 | 活着不等于处理得动 | 已修正：Classic 的心跳配置在客户端；Consumer Protocol 的心跳/会话由 Broker 控制。 |
| 49 | Rebalance 风暴怎么查 | 已修正：使用真实 `rebalance-rate-per-hour` 等观测名，并按应用/Coordinator/部署分层排查。 |
| 50 | poll() 不是一次简单网络请求 | 已修正：不再声称所有心跳都由 poll 线程同步推进；强调预取、协议差异与应用进度租约。 |
| 51 | Fetch 直接找 Partition Leader | 通过：Position 决定读哪里，Metadata 决定找谁，一个 Broker 请求可合并多个 Partition。 |
| 52 | Broker 如何定位 offset 42 | 通过：Segment floor、稀疏 OffsetIndex 与少量顺序扫描链路准确。 |
| 53 | Consumer 读的是缓存还是磁盘 | 通过：Kafka 主要依赖 OS Page Cache，不在 JVM 堆维护第二份消息缓存。 |
| 54 | 热数据怎样少复制一次 | 通过：明文可走 `transferTo/sendfile`；TLS 通常进入用户态加密路径。 |
| 55 | Fetch 是延迟与吞吐的拨杆 | 通过：`fetch.min.bytes/fetch.max.wait/fetch.max/per-partition/max.poll.records` 的不同层级清楚。 |
| 56 | 字节怎样重新变成对象 | 通过：批次解析、CRC、解压、Key/Value 反序列化与 Poison Pill 风险清楚。 |
| 57 | Consumer 最终拿到哪些字段 | 通过：ConsumerRecord 多出 topic/partition/offset/timestamp/leader epoch 等位置上下文。 |
| 58 | 真正的风险在业务处理 | 通过：Kafka ACK、业务副作用、Offset Commit 三者不等价。 |
| 59 | 下游变慢时先停某些 Partition | 新增：`pause/resume` 不触发 Rebalance，仍需 poll，并按 Partition 管在途顺序与 Commit。 |
| 60 | 当前位置不等于已提交位置 | 通过：Position 与 Committed Offset 分离；处理 offset 42 后提交下一 Offset 43。 |
| 61 | Offset 什么时候提交 | 已强化：Auto Commit 不知道业务是否成功；Sync/Async 与按 Partition 批量提交取舍清楚。 |
| 62 | Kafka 的一致性，到底保证到哪一层 | 已重构为一致性蓝图：拆开 Partition 顺序、HW 日志提交、LSO 事务可见性和外部业务副作用，并以崩溃伪代码说明 at-least-once 与幂等边界。 |
| 63 | 一条坏消息不能卡死 Partition | 通过：有限重试、Retry Topic、DLQ 证据、顺序损失与原 Offset 推进完整。 |
| 64 | Lag 到底是哪两个 Offset 相减 | 已修正：常见 Group Lag 用 Log End−Committed；`read_committed` 客户端 Fetch Lag 相对 LSO。 |
| 65 | Kafka 为什么写磁盘、做复制，还能保持高吞吐 | 已重构为高性能蓝图：Partition 并行、Batch 摊销、顺序追加、Page Cache、预取与少拷贝被组合成一条实现流水线，并列出延迟、资源和 CPU 代价。 |
| 66 | 用五问验收心智模型 | 通过：路由、存储、持久性、所有权、恢复五个问题可作为课程验收。 |

## 当前刻意不放进本章的内容

这些不是“一条消息从产生到消费”主线的缺页，建议以后作为独立章节：

- KRaft Controller、Metadata Log 与集群控制面。
- Kafka Connect、Kafka Streams、MirrorMaker 与跨集群复制。
- Tiered Storage、远端 Fetch 与冷数据成本模型。
- TLS/SASL/ACL 的部署实战与证书生命周期。
- 容量规划、压测方法、完整指标面板和故障演练。

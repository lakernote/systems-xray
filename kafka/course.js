(() => {
  "use strict";

  const DOCS = {
    producer: "https://kafka.apache.org/41/configuration/producer-configs/",
    consumer: "https://kafka.apache.org/41/configuration/consumer-configs/",
    design: "https://kafka.apache.org/41/design/design/",
    protocol: "https://kafka.apache.org/41/design/protocol/",
    distribution: "https://kafka.apache.org/41/implementation/distribution/",
    rebalance: "https://kafka.apache.org/41/operations/consumer-rebalance-protocol/",
    consumerApi: "https://kafka.apache.org/41/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html",
    broker: "https://kafka.apache.org/41/configuration/broker-configs/"
  };

  const page = (after, chapter, section, title, question, intro, nodes, facts, takeaway, note, mode = "flow") => ({
    after, chapter, section, title, question, intro, nodes, facts, takeaway, note, mode
  });

  window.SYSTEMS_XRAY_ADVANCED_SLIDES = [
    page("04 · INTERCEPTOR", "PRODUCER · 路由准备", "04A · METADATA BOOTSTRAP", "先认识集群，再发送", "Producer 怎么知道集群里有哪些 Broker？", "bootstrap.servers 只是入口；真正的 Topic、Partition 与 Leader 路由来自 Metadata。", [
      ["BOOTSTRAP", "broker0:9092", "连接任意可用入口"],
      ["REQUEST", "MetadataRequest", "询问 Topic 与 Leader"],
      ["RESPONSE", "Cluster metadata", "Broker · Partition · Epoch"],
      ["CLIENT CACHE", "P1 → Broker 1", "后续请求直接命中 Leader"]
    ], [["metadata.max.age.ms", "定期强制刷新"], ["max.block.ms", "等待 Metadata 的上限"], ["常见问题", "只配一台入口并不等于单点"]], "bootstrap 负责发现；Metadata 才负责路由。", {
      summary: "KafkaProducer 第一次发送时会通过 bootstrap.servers 连接任意可用 Broker，发送 MetadataRequest，并缓存 Topic 的分区、Leader 与 Leader Epoch。Leader 变化或路由错误会触发刷新。",
      config: [["bootstrap.servers", "至少 2~3 个可用入口"], ["metadata.max.age.ms", "300000"], ["metadata.max.idle.ms", "300000"], ["max.block.ms", "60000"]],
      gain: "客户端可直达每个 Partition Leader，不需要中心代理。", cost: "Metadata 过期或网络隔离时，send 可能等待并最终超时。", code: "bootstrap.servers\n  → MetadataRequest\n  → Cluster(partitions, leaders, epochs)\n  → client metadata cache", source: DOCS.producer
    }),

    page("05 · SERIALIZER", "PRODUCER · 数据契约", "05A · SIZE LIMITS", "字节太大会在哪里失败", "一条消息到底能有多大？", "大小限制是一条链；最小的那一环决定消息能否通过。", [
      ["CLIENT", "max.request.size", "ProduceRequest 上限"],
      ["BROKER", "message.max.bytes", "Broker 接收上限"],
      ["TOPIC", "max.message.bytes", "Topic 可覆盖 Broker"],
      ["CONSUMER", "max.partition.fetch.bytes", "读取单分区上限"]
    ], [["Producer 上限", "未压缩 RecordBatch / 请求"], ["Broker 上限", "压缩后的 RecordBatch"], ["特殊", "首个超大 Fetch Batch 仍可能返回"]], "消息大小不是一个配置，而是一条端到端契约。", {
      summary: "max.request.size 限制请求并实际约束未压缩 RecordBatch；Broker/Topic 的消息上限检查压缩后的 RecordBatch。Consumer 的首个超大批次可突破常规 Fetch 上限以保证继续前进。只调大一处会造成能写不能读或客户端先失败。",
      config: [["max.request.size", "Producer 请求上限"], ["message.max.bytes", "Broker 默认 RecordBatch 上限"], ["max.message.bytes", "Topic 覆盖值"], ["max.partition.fetch.bytes", "Consumer 单分区读取上限"]],
      gain: "限制大消息可保护 Broker 内存、网络与复制链路。", cost: "阈值不一致会形成隐蔽的生产故障；过大消息显著拉高延迟。", code: "serialized record\n → Producer request limit\n → Broker/topic batch limit\n → Consumer fetch limit", source: DOCS.producer
    }, "compare"),

    page("05 · SERIALIZER", "PRODUCER · 数据契约", "05B · SCHEMA EVOLUTION", "Schema 也要演进", "Consumer 升级慢于 Producer，会不会读坏？", "Kafka Broker 不理解业务字段；兼容性必须由 Serializer、Schema Registry 与发布流程共同保证。", [
      ["JSON", "字段直观", "体积大 · 约束弱"],
      ["AVRO", "Schema ID", "紧凑 · 演进成熟"],
      ["PROTOBUF", "字段编号", "跨语言 · 强契约"],
      ["REGISTRY", "Compatibility", "BACKWARD / FORWARD / FULL"]
    ], [["BACKWARD", "先升级 Reader，再升级 Writer"], ["FORWARD", "先升级 Writer，再升级 Reader"], ["FULL", "两边滚动顺序更自由"]], "Broker 存字节；Schema 系统保存这些字节的意义。", {
      summary: "Kafka 不验证 JSON、Avro 或 Protobuf。生产系统通常让消息携带 schema id 或版本，并在发布前检查兼容性。发布顺序取决于规则：BACKWARD 常先升级 Reader，FORWARD 常先升级 Writer，不能把 Reader-first 当作所有策略的通用答案。",
      config: [["value.serializer", "JSON / Avro / Protobuf"], ["compatibility", "BACKWARD / FORWARD / FULL"], ["headers", "content-type, schema-version"], ["发布顺序", "由兼容模式决定"]],
      gain: "跨语言和滚动升级时仍能安全解析历史消息。", cost: "需要额外的 Schema Registry、兼容性规则和 CI 检查。", code: "value object\n → serializer + schema id\n → bytes in Kafka\n → deserializer resolves schema", source: DOCS.design
    }, "compare"),

    page("06 · PARTITIONER", "PRODUCER · 分区", "06A · PARTITION EDGE CASES", "Key 不是免费的顺序", "有 Key 就一定分得均匀吗？", "Key 换来局部顺序，但热点 Key、空 Key 与扩分区都会改变系统行为。", [
      ["EXPLICIT", "partition = 1", "最强控制 · 最难扩展"],
      ["KEYED", "hash(key) % N", "同 Key 同 Partition"],
      ["NULL KEY", "sticky partition", "更好批次 · 无 Key 顺序"],
      ["EXPAND", "N: 6 → 12", "大部分 Key 会重新映射"]
    ], [["热点现象", "P1 lag / bytes 明显偏高"], ["治理", "Key 加盐或拆业务维度"], ["代价", "Key 加盐会破坏原始顺序"]], "分区策略是在顺序、均衡与可扩展性之间做选择。", {
      summary: "显式 partition 优先，其次是 Key 哈希；无 Key 时默认策略倾向让记录黏在同一 Partition 形成更大批次。热点 Key 会让单分区成为瓶颈，扩容还会改变取模结果。",
      config: [["partitioner.class", "可自定义"], ["partitioner.ignore.keys", "默认 false"], ["partition 数", "决定最大消费并行度"], ["Key 设计", "业务有序维度"]],
      gain: "合理 Key 可以同时获得并行与局部顺序。", cost: "热点、扩容重映射与自定义分区器都会增加运维复杂度。", code: "explicit partition\n  else hash(serializedKey) % count\n  else sticky partition", source: DOCS.producer
    }, "compare"),

    page("07 · ACCUMULATOR", "PRODUCER · 内存", "07A · BUFFER POOL", "Buffer 满了，send 会卡住", "异步发送为什么也可能阻塞业务线程？", "RecordAccumulator 的内存来自 BufferPool；申请不到空间时，业务线程会等待。", [
      ["APP THREAD", "append(record)", "准备放入 P1 deque"],
      ["BUFFER POOL", "buffer.memory", "可复用 ByteBuffer"],
      ["PRESSURE", "no free buffer", "等待 Sender 释放"],
      ["TIMEOUT", "max.block.ms", "超时抛异常"]
    ], [["指标", "bufferpool-wait-ratio"], ["指标", "bufferpool-wait-time-total"], ["根因", "Broker/网络慢或发送过快"]], "异步只把等待后移；下游持续变慢时，背压最终会回到业务线程。", {
      summary: "Producer 不是无限队列。BufferPool 无法分配新批次时，send 会在 max.block.ms 内等待；如果 Sender 长期无法发送或确认，最终抛 TimeoutException。",
      config: [["buffer.memory", "33554432"], ["batch.size", "16384"], ["max.block.ms", "60000"], ["delivery.timeout.ms", "120000"]],
      gain: "有界内存避免 Producer 在故障时把 JVM 撑爆。", cost: "背压会表现为业务线程延迟，必须配合超时、限流和监控。", code: "RecordAccumulator.append\n → BufferPool.allocate\n → wait for memory\n → max.block.ms timeout", source: DOCS.producer
    }),

    page("07 · ACCUMULATOR", "PRODUCER · 批处理", "07B · COMPRESSION", "压缩发生在 Batch 级别", "compression.type 到底压缩什么？", "Kafka 压缩整个 RecordBatch，而不是单条 value；批次越完整，压缩率通常越好。", [
      ["RECORDS", "3 serialized records", "相同字段重复出现"],
      ["BATCH", "ProducerBatch", "共享协议头"],
      ["CODEC", "zstd / lz4", "一次压缩整个批次"],
      ["BROKER", "compressed batch", "通常原样存储与复制"]
    ], [["gzip", "高压缩 · CPU 高"], ["lz4", "低延迟 · 压缩快"], ["zstd", "压缩率与速度平衡"]], "linger 与 batch.size 不只影响请求数，也影响压缩率。", {
      summary: "压缩在 ProducerBatch 级别完成。Broker 通常不解压再重压，而是把 RecordBatch 追加、复制并返回给 Consumer；Consumer 最终解压。",
      config: [["compression.type", "none/gzip/snappy/lz4/zstd"], ["batch.size", "影响批次容量"], ["linger.ms", "影响聚合时间"], ["CPU", "Producer 与 Consumer 承担"]],
      gain: "减少网络和磁盘字节，通常显著提高吞吐。", cost: "增加端点 CPU；小批次时收益有限，极端压缩还会增加尾延迟。", code: "records\n → MemoryRecordsBuilder\n → compressed RecordBatch\n → broker stores same batch", source: DOCS.producer
    }),

    page("08 · SENDER", "PRODUCER · 并发", "08A · IN-FLIGHT REQUESTS", "一条连接上可以有多个请求", "重试会不会把消息顺序打乱？", "NetworkClient 允许多个请求在途；幂等模式用序列号保护同一 Partition 的顺序。", [
      ["REQUEST 17", "P1 seq 40–42", "网络中"],
      ["REQUEST 18", "P1 seq 43–45", "网络中"],
      ["FAIL", "17 timeout", "旧请求准备重试"],
      ["GUARD", "PID + sequence", "Broker 去重并检查顺序"]
    ], [["max.in.flight", "默认 5"], ["enable.idempotence", "默认 true（无冲突配置时）"], ["风险", "关闭幂等 + 重试可能乱序"]], "高并发提高吞吐；幂等序列号守住单分区顺序。", {
      summary: "max.in.flight.requests.per.connection 控制一个连接可同时等待多少响应。关闭幂等时，较早批次重试可能落到较晚批次之后；启用幂等后 Broker 用 PID、epoch 和 sequence 拒绝重复或越序批次。",
      config: [["max.in.flight.requests.per.connection", "5"], ["enable.idempotence", "true"], ["acks", "all"], ["retries", "大值"]],
      gain: "允许网络流水线化，同时在幂等模式下保序。", cost: "状态机更复杂；配置冲突会禁用幂等或直接报错。", code: "ProduceRequest(seq=40) ─┐\nProduceRequest(seq=43) ─┼→ broker\nPID + epoch + sequence guard", source: DOCS.producer
    }),

    page("11 · BROKER REQUEST PATH", "BROKER · 接入", "11A · AUTH ACL QUOTA", "请求先过安全闸门", "连上 Broker 就能写任何 Topic 吗？", "认证回答“你是谁”，ACL 回答“你能做什么”，Quota 限制“你能做多快”。", [
      ["TLS / SASL", "principal=order-svc", "认证与加密"],
      ["ACL", "WRITE orders.created", "授权 Topic 操作"],
      ["QUOTA", "producer_byte_rate", "按用户或 client 限流"],
      ["HANDLER", "ProduceRequest", "通过后才进入存储路径"]
    ], [["常见错误", "TOPIC_AUTHORIZATION_FAILED"], ["限流表现", "throttle_time_ms"], ["生产建议", "最小权限 + 独立 principal"]], "网络连通只是第一层；安全与配额决定请求是否被接纳。", {
      summary: "Broker 在请求处理路径中识别 principal，检查 Topic WRITE/DESCRIBE ACL，并应用客户端配额。被限流的请求可能延迟响应，而不是立即失败。",
      config: [["security.protocol", "SSL / SASL_SSL 等"], ["authorizer.class.name", "启用 ACL"], ["producer_byte_rate", "客户端配额"], ["client.id", "配额与观测维度"]],
      gain: "多租户环境能隔离权限与吞吐，避免单个 Producer 拖垮集群。", cost: "证书、SASL、ACL 与配额会增加发布和故障排查复杂度。", code: "connection → authentication\n → authorization(WRITE)\n → quota check\n → KafkaApis", source: DOCS.broker
    }),

    page("11 · BROKER REQUEST PATH", "BROKER · 校验", "11B · BROKER VALIDATION", "Broker 校验字节，不校验业务", "Broker 收到 RecordBatch 会检查什么？", "它检查协议、CRC、大小、时间戳与序列；不会检查 orderId 是否为空。", [
      ["PROTOCOL", "request version", "字段结构可解析"],
      ["BATCH", "CRC + size", "字节未损坏且未超限"],
      ["TIME", "timestamp policy", "CreateTime / LogAppendTime"],
      ["IDEMPOTENCE", "PID + sequence", "重复与乱序检测"]
    ], [["不检查", "JSON/Avro 业务字段"], ["可能错误", "CORRUPT_MESSAGE"], ["可能错误", "INVALID_RECORD / OUT_OF_ORDER_SEQUENCE"]], "Kafka 保证日志协议正确；业务语义仍由应用与 Schema 系统保证。", {
      summary: "Leader 在追加前校验 RecordBatch 的协议结构、CRC、大小、时间戳规则，以及幂等/事务序列。Broker 对 value 的业务 Schema 不知情。",
      config: [["message.max.bytes", "RecordBatch 大小"], ["message.timestamp.type", "CreateTime/LogAppendTime"], ["message.timestamp.before.max.ms", "允许的过去偏差"], ["message.timestamp.after.max.ms", "允许的未来偏差"]],
      gain: "Broker 能防止损坏字节和错误序列污染日志。", cost: "语义错误仍可能成为一条完全合法的 Kafka Record。", code: "validate RecordBatch\n  CRC · size · timestamp\n  producerId · epoch · sequence\nthen append", source: DOCS.protocol
    }),

    page("11 · BROKER REQUEST PATH", "BROKER · 追加", "11C · OFFSET ASSIGNMENT", "Offset 由 Leader 分配", "#A1024 的 offset 42 是谁算出来的？", "Producer 不携带最终 offset；P1 Leader 以当前日志末尾为这批 Record 分配连续位置。", [
      ["INCOMING", "3 records", "还没有最终 offset"],
      ["P1 LEADER", "LEO = 40", "日志末端位置"],
      ["APPEND", "baseOffset = 40", "批次覆盖 40..42"],
      ["EVENT", "#A1024 → 42", "得到稳定逻辑地址"]
    ], [["Offset 范围", "只在 Partition 内唯一"], ["Leader Epoch", "辅助识别截断与换主"], ["不代表", "全局消息编号"]], "TopicPartition + offset 才能唯一定位一条日志记录。", {
      summary: "Partition Leader 在 append 时为 RecordBatch 分配 base offset，并据每条 Record 的 offset delta 得到最终 offset。Offset 只在单个 Partition 内单调递增。",
      config: [["Topic", "orders.created"], ["Partition", "1"], ["baseOffset", "40"], ["#A1024 offset", "42"]],
      gain: "追加日志无需全局协调，Partition 可并行扩展。", cost: "跨 Partition 没有天然全局顺序；换主时还要结合 Leader Epoch。", code: "P1 logEndOffset = 40\nappend batch(count=3)\nbaseOffset=40, deltas=0..2\n#A1024 offset=42", source: DOCS.protocol
    }),

    page("12 · LOGICAL STORAGE", "STORAGE · 格式", "13A · RECORD BATCH FORMAT", "真正落盘的是 RecordBatch", ".log 文件里一批记录长什么样？", "批次头描述偏移、时间戳、压缩与幂等状态；Record 用 delta 压缩重复信息。", [
      ["BATCH HEADER", "baseOffset · CRC", "LeaderEpoch · magic · attributes"],
      ["PRODUCER STATE", "PID · epoch · baseSequence", "幂等/事务信息"],
      ["RECORD 0", "offsetDelta=0", "timestampDelta · key · value · headers"],
      ["RECORD 2", "offsetDelta=2", "#A1024 · final offset 42"]
    ], [["压缩单位", "整个 RecordBatch"], ["CRC 覆盖", "attributes 到 Records"], ["收益", "共享字段 + delta 降低体积"]], "Kafka 的物理基本单元是 RecordBatch，不是裸 value。", {
      summary: "Magic v2 RecordBatch 头包含 baseOffset、batchLength、partitionLeaderEpoch、CRC、attributes、lastOffsetDelta、时间戳、producerId/epoch/baseSequence 等；每条 Record 保存 delta 与 key/value/headers。",
      config: [["magic", "2"], ["attributes", "压缩/时间戳/事务标志"], ["lastOffsetDelta", "2"], ["CRC", "检测批次损坏"]],
      gain: "批次共享元数据，支持高效压缩、幂等、事务与顺序读写。", cost: "单条消息的物理定位要先理解批次头和 delta。", code: "RecordBatch {\n baseOffset, leaderEpoch, CRC, attributes,\n producerId, epoch, baseSequence,\n records[{offsetDelta, timestampDelta, key, value, headers}]\n}", source: DOCS.protocol
    }),

    page("13 · LOG FILES", "STORAGE LIFECYCLE · Segment", "13B · SEGMENT ROLL", "Active Segment 什么时候滚动", "为什么会出现新的 .log / .index 文件组？", "先暂停 #A1024 的即时写入主线：看看 Active Segment 后来如何滚动成新的文件组。", [
      ["ACTIVE", "baseOffset 40", "持续 append"],
      ["TRIGGER", "segment.bytes / ms", "或索引达到容量"],
      ["CLOSE", "40.log becomes closed", "通常不再追加"],
      ["NEW", "43.log becomes active", "下一条从 offset 43 开始"]
    ], [["segment.bytes", "默认 1 GiB"], ["segment.ms", "时间滚动"], ["segment.jitter.ms", "错开集群同时滚动"]], "Segment 是文件管理边界；Partition 才是连续日志。", {
      summary: "LogSegment 滚动后，旧文件组关闭，新文件组名使用下一条记录的 baseOffset。滚动把清理、索引、删除和恢复成本限制在可管理范围。",
      config: [["log.segment.bytes", "1073741824"], ["log.roll.ms / hours", "时间条件"], ["log.roll.jitter.ms", "避免同时滚动"], ["segment.index.bytes", "索引容量"]],
      gain: "Retention 与 Compaction 可以按 Segment 管理，不必重写整条 Partition。", cost: "过小会制造海量文件，过大又让清理和恢复粒度太粗。", code: "active segment 40.*\n → roll condition\n → close 40.*\n → create 43.log/index/timeindex/txnindex", source: DOCS.design
    }),

    page("13 · LOG FILES", "STORAGE LIFECYCLE · 清理", "13C · RETENTION & COMPACTION", "Kafka 删除的是旧 Segment", "消息过期时，会从文件中挖掉一条记录吗？", "这是存储生命周期旁支：Retention 按旧 Segment 删除，Compaction 则重写已关闭的 Segment。", [
      ["DELETE POLICY", "retention.ms / bytes", "整段旧 Segment 删除"],
      ["COMPACT POLICY", "latest value per key", "后台 Cleaner 重写"],
      ["TOMBSTONE", "key + null value", "表示删除 Key"],
      ["ACTIVE SEGMENT", "not cleaned now", "继续接收新记录"]
    ], [["cleanup.policy", "delete / compact / delete,compact"], ["注意", "Retention 不看 Consumer 是否读完"], ["恢复风险", "Lag 超过保留期会丢历史"]], "Kafka 保留由时间/空间策略决定，不由消费确认决定。", {
      summary: "delete 策略按时间或空间删除旧 Segment；compact 策略后台重写旧段，只保证最终保留每个 Key 的最新值，顺序与 offset 仍保持但会出现空洞。",
      config: [["cleanup.policy", "delete / compact"], ["retention.ms", "时间保留"], ["retention.bytes", "Partition 空间上限"], ["delete.retention.ms", "tombstone 保留窗口"]],
      gain: "能同时支持事件历史和状态快照型 Topic。", cost: "清理异步且按 Segment；Consumer 落后过久可能越过可读历史。", code: "closed segments\n → retention delete\n or log cleaner compact by key\nactive segment remains append-only", source: DOCS.design
    }, "compare"),

    page("14 · PHYSICAL WRITE", "STORAGE · 故障", "14A · STORAGE FAILURE", "磁盘路径也会成为瓶颈", "Broker 磁盘满或 Page Cache 压力大时，会发生什么？", "Kafka 顺序 I/O 很高效，但容量、文件系统与缓存压力仍会直接影响追加和 Fetch。", [
      ["DISK FULL", "ENOSPC", "Leader append 失败"],
      ["PAGE CACHE", "memory pressure", "热页被回收 · 读放大"],
      ["JBOD", "log.dirs failure", "目录故障与副本迁移"],
      ["SKEW", "hot partition", "单盘吞吐被打满"]
    ], [["看什么", "磁盘使用率 / await / page faults"], ["看什么", "UnderReplicatedPartitions"], ["动作", "扩容、迁移副本、修复热点 Key"]], "顺序写不是无限快；容量规划必须同时看字节率、保留期与副本数。", {
      summary: "磁盘满会让 Leader 追加失败；Page Cache 压力会把热读变成物理读；多 log.dirs/JBOD 下单目录故障还会影响其上的副本。热点 Partition 可能只打满一块盘。",
      config: [["log.dirs", "一个或多个数据目录"], ["replication.factor", "容量乘数"], ["retention", "决定稳态占用"], ["segment.bytes", "文件管理粒度"]],
      gain: "顺序日志与 OS Cache 可把通用磁盘发挥到很高吞吐。", cost: "磁盘、页缓存和分区分布都需要持续容量治理。", code: "append → Page Cache → filesystem\nfailures: ENOSPC / I/O error / cache miss\nresult: append error or replica lag", source: DOCS.design
    }),

    page("14 · PHYSICAL WRITE", "REPLICATION · 拉取", "16 · FOLLOWER FETCH", "Follower 主动拉取副本", "Leader 写完后，副本怎样拿到 #A1024？", "Follower ReplicaFetcher 像特殊 Consumer 一样，按自己的 LEO 向 Leader 发 FetchRequest。", [
      ["LEADER B1", "P1 LEO=43", "已有 offset 42"],
      ["FETCHER B0", "fetch from offset 40", "Follower 主动请求"],
      ["APPEND B0", "append 40..42", "写入本地 P1 replica"],
      ["FETCHER B2", "same process", "另一份副本独立追赶"]
    ], [["方向", "Follower → Leader Fetch"], ["不是", "Leader 主动推送"], ["监控", "replica lag / ISR shrink"]], "Kafka 复制是拉模型；每个 Follower 独立追赶 Leader 日志。", {
      summary: "Partition Follower 的 ReplicaFetcher 按本地 log end offset 向 Leader 请求后续 RecordBatch，并追加到自己的日志。Leader 根据 Follower 的抓取进度判断它是否仍在 ISR。",
      config: [["replica.fetch.max.bytes", "副本单次抓取上限"], ["replica.fetch.wait.max.ms", "最长等待"], ["replica.lag.time.max.ms", "落后时间阈值"], ["replication.factor", "3（示例）"]],
      gain: "Follower 控制自己的抓取节奏，复制路径与普通 Fetch 机制复用。", cost: "慢盘或网络抖动会造成副本落后并缩小 ISR。", code: "Follower LEO\n → FetchRequest to Leader\n → append returned batches\n → report new fetch offset", source: DOCS.distribution
    }),

    page("14 · PHYSICAL WRITE", "REPLICATION · 可见性", "17 · ISR LEO HW", "LEO、ISR、HW 一次讲清", "Leader 有 offset 42，Consumer 就能读了吗？", "LEO 是各副本末端；ISR 是及时追赶的副本集合；HW 是当前 ISR 的复制边界；满足 minISR 后，普通读取才会看到提交范围。", [
      ["B1 LEADER", "LEO 43", "已含 0..42"],
      ["B0 FOLLOWER", "LEO 43", "已追上"],
      ["B2 FOLLOWER", "LEO 41", "仍落后"],
      ["HIGH WATERMARK", "HW 41 → 43", "ISR 追上后推进"]
    ], [["LEO", "下一条将写入的 offset"], ["HW", "当前 ISR 的复制边界"], ["可见前提", "ISR 数量 ≥ minISR"]], "写到 Leader 只是 append；复制到当前 ISR 且 ISR 数量达标后，记录才进入普通可见范围。", {
      summary: "每个副本有自己的 LEO。Leader 维护 ISR，并以当前 ISR 中最低复制进度推进 High Watermark。Kafka 4.1 的普通可见性还要求当前 ISR 数量不低于 min.insync.replicas。",
      config: [["LEO", "log end offset"], ["HW", "high watermark"], ["ISR", "in-sync replicas"], ["replica.lag.time.max.ms", "ISR 资格的重要阈值"]],
      gain: "HW 给读取提供只包含同步副本数据的稳定边界。", cost: "慢副本会限制 HW 推进或被移出 ISR，影响延迟与容错。", code: "Leader LEO = 43\nFollower LEOs = 43, 41\nHW = min(ISR replicated offsets)\nthen advances when followers catch up", source: DOCS.distribution
    }),

    page("14 · PHYSICAL WRITE", "REPLICATION · ACK", "18 · ACK MODES", "acks=0/1/all 差在哪", "Producer 什么时候认为发送成功？", "ACK 模式决定 Producer 等待的确认边界，不改变 Leader 先追加日志的事实。", [
      ["acks=0", "不等响应", "最低延迟 · 不知道是否失败"],
      ["acks=1", "Leader 本地追加", "Leader 随后故障可能丢"],
      ["acks=all", "等待每个当前 ISR", "且 ISR 数量必须达 minISR"],
      ["CALLBACK", "RecordMetadata / error", "异步通知业务"]
    ], [["推荐生产", "acks=all + idempotence"], ["准确含义", "等待每个当前 ISR"], ["关键搭档", "ISR.size ≥ min.insync.replicas"]], "acks=all 等的是当前 ISR 全部确认；它不等所有配置副本，也不等逐条 fsync。", {
      summary: "acks=0 不等待；acks=1 等 Leader 本地追加；acks=all 等待每个当前 ISR 副本确认，并且当前 ISR 数量必须达到 min.insync.replicas。它不意味着所有配置副本，也不意味着逐条 fsync。",
      config: [["acks", "0 / 1 / all"], ["enable.idempotence", "true"], ["request.timeout.ms", "等待响应上限"], ["delivery.timeout.ms", "整个发送生命周期上限"]],
      gain: "可以按业务在延迟、可观测错误与持久性之间选择。", cost: "更强 ACK 通常更依赖副本健康，故障时写入可能停住。", code: "acks=0: send and forget\nacks=1: leader append\nacks=all: ISR commit condition\n→ callback/future", source: DOCS.producer
    }, "compare"),

    page("14 · PHYSICAL WRITE", "REPLICATION · 可用性", "19 · MIN ISR", "min.insync.replicas 是写入底线", "只剩一个 ISR 时，acks=all 还能写吗？", "只有 acks=all 时，Broker 才用 min.insync.replicas 拒绝过于脆弱的写入。", [
      ["RF=3", "B1 · B0 · B2", "三份配置副本"],
      ["ISR=2", "B1 · B0", "满足 minISR=2"],
      ["ISR=1", "only B1", "低于写入底线"],
      ["REJECT", "NOT_ENOUGH_REPLICAS", "停写保护数据"]
    ], [["典型组合", "RF=3, minISR=2, acks=all"], ["权衡", "容忍 1 台故障，第二台故障停写"], ["误区", "minISR 不等于 replication.factor"]], "minISR 用可用性换数据安全：副本不足时宁可拒写。", {
      summary: "当 Producer 使用 acks=all 且当前 ISR 数小于 min.insync.replicas 时，Leader 拒绝 ProduceRequest。常见 RF=3、minISR=2 可承受一台副本故障。Kafka 4.1 若启用 Eligible Leader Replicas，minISR 的故障语义需要结合 ELR 单独判断。",
      config: [["replication.factor", "3"], ["min.insync.replicas", "2"], ["acks", "all"], ["unclean.leader.election.enable", "通常 false"], ["Kafka 4.1 ELR", "启用时需按 ELR 语义复核"]],
      gain: "防止只剩单副本时继续确认、随后又丢失唯一副本。", cost: "ISR 健康不足时牺牲写可用性，业务必须处理重试或降级。", code: "if acks=all && ISR.size < minISR\n  reject produce\nelse\n  wait for commit condition", source: DOCS.broker
    }),

    page("14 · PHYSICAL WRITE", "PRODUCER · 响应", "20 · PRODUCE RESPONSE", "成功最终回到 Callback", "send 返回的 Future 什么时候才算完成？", "Broker 返回每个 Partition 的错误与 baseOffset；Sender 完成批次并调用 Callback。", [
      ["BROKER", "ProduceResponse", "P1 baseOffset=40"],
      ["NETWORK CLIENT", "correlation id", "匹配在途请求"],
      ["SENDER", "completeBatch", "记录指标 · 释放 Buffer"],
      ["APPLICATION", "RecordMetadata", "#A1024 offset=42"]
    ], [["Future.get()", "会阻塞等待最终结果"], ["callback", "不要执行慢业务"], ["close/flush", "确保未完成批次得到处理"]], "send() 返回只代表已受理；Callback 成功才代表 ACK 条件完成。", {
      summary: "NetworkClient 用 correlation id 匹配响应，Sender 按 Partition 完成 ProducerBatch，为每条 Record 计算 offset 并触发 Future/Callback，同时归还 BufferPool 内存。",
      config: [["callback", "异步成功/失败入口"], ["RecordMetadata.offset", "42"], ["flush", "等待当前记录完成"], ["close", "有超时地完成并释放资源"]],
      gain: "业务线程无需同步等待网络往返，仍能拿到精确结果。", cost: "忽略 Callback/Future 会把真正的发送失败变成静默丢数。", code: "ProduceResponse\n → Sender.completeBatch\n → deallocate buffer\n → Future<RecordMetadata> + callback", source: DOCS.producer
    }),

    page("14 · PHYSICAL WRITE", "PRODUCER · 失败", "21 · RETRY BUDGET", "重试由总时间预算约束", "retries 很大，会不会永远重试？", "不会。delivery.timeout.ms 是从入批到成功/失败的总预算，内部还受请求超时与退避影响。", [
      ["ATTEMPT 1", "request.timeout", "Leader 切换中"],
      ["BACKOFF", "retry.backoff.ms", "避免热循环"],
      ["METADATA", "refresh leader", "P1 → Broker 2"],
      ["DEADLINE", "delivery.timeout.ms", "预算耗尽最终失败"]
    ], [["可重试", "NOT_LEADER、网络错误等"], ["不可重试", "序列化、授权、消息过大"], ["业务层", "不要无界二次重试"]], "重试的边界应是业务允许的最长交付时间，而不是次数。", {
      summary: "Sender 对可重试错误执行退避、Metadata 刷新与再次发送；但记录不能超过 delivery.timeout.ms。不可重试错误会直接完成失败。",
      config: [["retries", "大值"], ["retry.backoff.ms", "100"], ["request.timeout.ms", "30000"], ["delivery.timeout.ms", "120000"]],
      gain: "自动吸收短暂网络抖动与 Leader 切换。", cost: "超时预算过长会让业务看到长尾；应用再无界重试会制造重复和雪崩。", code: "attempt → retriable error\n → backoff + metadata refresh\n → retry while now < delivery deadline", source: DOCS.producer
    }),

    page("14 · PHYSICAL WRITE", "PRODUCER · 幂等", "22 · IDEMPOTENT PRODUCER", "Broker 如何识别重复批次", "响应丢了，Producer 重试同一批，Kafka 会写两次吗？", "幂等 Producer 为每个 Partition 带 PID、Producer Epoch 与递增 Sequence。", [
      ["INIT", "PID=73 · epoch=0", "Broker 分配身份"],
      ["SEND", "P1 baseSeq=40", "批次携带序列"],
      ["RETRY", "same PID + seq", "响应丢失后重发"],
      ["BROKER", "duplicate detected", "返回原结果，不再追加"]
    ], [["范围", "单 Producer 会话、单 Partition"], ["不等于", "业务端到端 Exactly-once"], ["默认", "现代客户端在配置不冲突时启用"]], "幂等消除 Kafka 写入重试重复；业务副作用仍需单独设计。", {
      summary: "Broker 维护每个 PID/Partition 的最近 sequence。相同 sequence 重试会被识别为重复；间隙或倒退可能得到 OUT_OF_ORDER_SEQUENCE。Producer Epoch 用于隔离旧实例。",
      config: [["enable.idempotence", "true"], ["acks", "all"], ["retries", "> 0"], ["max.in.flight", "≤ 5"]],
      gain: "在网络不确定性下实现 Kafka 日志内的 exactly-once append。", cost: "它不覆盖数据库写入、HTTP 调用或应用重启后的任意业务去重。", code: "batch(PID, epoch, baseSequence)\n → broker producer state\n → append once or return duplicate result", source: DOCS.producer
    }),

    page("14 · PHYSICAL WRITE", "CLUSTER · 换主", "23 · LEADER FAILURE", "Leader 挂了，消息去哪", "Broker 1 故障后，P1 会怎样继续？", "Controller 从 ISR 中选择新 Leader，Producer 刷新 Metadata 后把重试发到新节点。", [
      ["FAIL", "B1 unavailable", "旧 P1 Leader 消失"],
      ["ELECT", "B0 from ISR", "成为新 Leader"],
      ["EPOCH", "leader epoch +1", "隔离旧 Leader"],
      ["CLIENT", "refresh + retry", "请求改发 B0"]
    ], [["优先", "只从 ISR 选主"], ["unclean election", "可能用落后副本换可用性"], ["现象", "短暂 NOT_LEADER / timeout"]], "ISR 决定安全候选；Leader Epoch 防止旧 Leader 继续写。", {
      summary: "Controller 发现 Leader 失效后，通常从 ISR 选择新 Leader并提升 Leader Epoch。客户端收到路由错误或连接失败后刷新 Metadata 并重试。",
      config: [["unclean.leader.election.enable", "通常 false"], ["leader.imbalance.per.broker.percentage", "首选副本均衡"], ["metadata.max.age.ms", "客户端兜底刷新"], ["delivery.timeout.ms", "覆盖切换窗口"]],
      gain: "多数节点故障可由客户端自动恢复，无需业务改路由。", cost: "换主产生短暂停顿；允许 unclean election 可能丢失尚未复制的数据。", code: "leader failure\n → controller elects ISR replica\n → leader epoch increments\n → clients refresh metadata", source: DOCS.distribution
    }),

    page("14 · PHYSICAL WRITE", "TRANSACTION · 可见性", "24 · TRANSACTIONS & LSO", "事务消息何时对 Consumer 可见", "跨 Partition 写入怎样原子提交？", "Transactional Producer 写数据和事务标记；read_committed Consumer 只读到 LSO，跳过 aborted records。", [
      ["BEGIN", "transactional.id", "初始化并取得 Producer Epoch"],
      ["WRITE", "P1 + P3 batches", "记录带 transactional flag"],
      ["MARKERS", "COMMIT / ABORT", "写入相关 Partition"],
      ["READ", "LSO + txnindex", "read_committed 过滤未提交/中止"]
    ], [["LSO", "首个未完成事务之前"], ["HW", "复制可见边界"], ["read_committed", "可见上界是 LSO（不超过 HW）"]], "事务解决 Kafka 内多 Partition 原子性；不是任意外部系统的分布式事务。", {
      summary: "事务 Producer 用 transactional.id 与 Coordinator 管理多个 Partition 的原子提交。read_committed Consumer 受 Last Stable Offset 限制，并借助 transaction index 跳过 aborted batches。",
      config: [["transactional.id", "稳定且实例唯一"], ["enable.idempotence", "事务自动要求"], ["isolation.level", "read_committed"], ["transaction.timeout.ms", "事务超时"]],
      gain: "可实现 Kafka→Kafka 的原子写与 exactly-once stream processing。", cost: "增加协调、状态与可见性延迟；外部数据库仍需 outbox/幂等等模式。", code: "beginTransaction\n → produce to P1/P3\n → commit markers\nread_committed: read only stable, non-aborted data", source: DOCS.design
    }),

    page("14 · PHYSICAL WRITE", "CORE DESIGN · 高可用", "25 · AVAILABILITY BLUEPRINT", "为什么 Broker 坏了，消息还能继续走？", "高可用只是多复制几份吗？", "不是。副本提供冗余，ISR 定义安全候选，ACK/HW 定义确认边界，Epoch 与 Metadata 完成故障接管。", [
      ["SPREAD", "RF + broker.rack", "副本跨故障域放置"],
      ["ADMIT", "ISR / ELR", "只让及时追赶者进入安全集合"],
      ["COMMIT", "minISR + acks + HW", "副本不足时宁可拒写"],
      ["FAILOVER", "Leader Epoch", "选新 Leader 并刷新路由"]
    ], [["安全不变量", "只确认可由安全候选接管的数据"], ["可用性代价", "ISR 不足会停写"], ["极端开关", "unclean election 用数据风险换恢复"]], "高可用不是“永远可写”，而是在故障中明确选择安全、可用性和恢复速度。", {
      summary: "Kafka 的高可用由四层共同完成：跨故障域的副本布局、ISR/ELR 安全集合、minISR 与 acks=all 的写入边界，以及 Leader Epoch 驱动的换主和客户端 Metadata 刷新。",
      config: [["replication.factor", "3"], ["broker.rack", "跨 AZ/机架"], ["min.insync.replicas", "2"], ["acks", "all"], ["unclean.leader.election.enable", "false"]],
      gain: "单 Broker 故障可自动恢复，并避免确认只有落后副本才能接管的数据。", cost: "更强安全需要更多容量；安全副本不足时必须牺牲写可用性。", code: "require ISR.size >= minISR\nleader.append(batch)\nfollowers.pullAndAppend(batch)\nwaitUntil(all(ISR).reached(batch.end))\nHW = min(ISR.logEndOffset)\nackProducer()\n\non leaderFailure:\n  leader = elect(ISR or ELR)\n  leaderEpoch++; clients.refreshMetadata()", source: DOCS.design
    }, "blueprint"),

    page("14 · PHYSICAL WRITE", "CONSUMER · 全景", "26 · CONSUMER GROUP", "Consumer Group 到底是什么", "三台 Consumer 会不会各自收到同一条消息？", "同一个 Group 内，一个 Partition 同一时刻只分给一个 Member；不同 Group 各自完整读取。", [
      ["GROUP A · C0", "P0 · P1", "#A1024 由 C0 读"],
      ["GROUP A · C1", "P2 · P3", "组内分摊"],
      ["GROUP A · C2", "P4 · P5", "最大并行度受分区限制"],
      ["GROUP B", "P0..P5", "另一业务独立消费一遍"]
    ], [["group.id", "定义消费进度命名空间"], ["并行上限", "活跃 Consumer ≤ Partition 数"], ["多余 Member", "会处于 idle"]], "Group 用分区分配实现并行；不同 Group 用独立 Offset 实现广播。", {
      summary: "Consumer Group 把 Topic 的 Partition 分配给成员。同一 Group 内 Partition 不会同时由两个稳定成员消费；另一个 group.id 有独立分配和 Offset，因此能完整读一遍。",
      config: [["group.id", "order-fulfillment-v1"], ["members", "3"], ["partitions", "6"], ["group.instance.id", "可选静态成员身份"]],
      gain: "只需增加 Consumer 实例就能并行处理多个 Partition。", cost: "并行度受 Partition 数限制，成员变化会触发分配变化。", code: "group A: P0..P5 split among C0,C1,C2\ngroup B: independent assignment and offsets", source: DOCS.consumerApi
    }),

    page("14 · PHYSICAL WRITE", "CONSUMER · 协调", "27 · GROUP COORDINATOR", "Group Coordinator 在哪里", "Consumer 如何找到管理自己 Group 的 Broker？", "客户端先 FindCoordinator；该 Broker 管理成员、分配与 Offset，Offset 最终写入 __consumer_offsets。", [
      ["CLIENT", "FindCoordinator(group.id)", "询问任意 Broker"],
      ["COORDINATOR", "Broker 2", "管理 Group 状态机"],
      ["HEARTBEAT", "member liveness", "维护 Generation/Epoch"],
      ["OFFSETS", "__consumer_offsets", "内部 compacted Topic"]
    ], [["Coordinator 不是", "所有 Fetch 的中转站"], ["Fetch 仍去", "各 Partition Leader"], ["故障", "客户端重新 FindCoordinator"]], "Coordinator 管 Group；Partition Leader 提供数据，两条路径不要混淆。", {
      summary: "Group Coordinator 负责成员、分配协议、心跳和 Offset Commit。真正的数据 Fetch 仍直接发给各 Partition Leader。Committed Offset 存在内部 compacted Topic __consumer_offsets。",
      config: [["group.id", "决定 Coordinator 映射"], ["__consumer_offsets", "内部 Topic"], ["offsets.topic.num.partitions", "Coordinator 扩展维度"], ["offsets.retention.minutes", "无订阅后的保留"]],
      gain: "Group 协调与数据读取解耦，可独立扩展。", cost: "排查时必须区分 Coordinator 问题、Leader 问题和应用处理问题。", code: "FindCoordinator(group.id) → coordinator\nJoin/Heartbeat/OffsetCommit → coordinator\nFetch → partition leaders", source: DOCS.distribution
    }),

    page("14 · PHYSICAL WRITE", "CONSUMER · 入组", "28 · JOIN & ASSIGN", "第一次 poll 为什么会等", "Consumer 启动后，Partition 是怎样分下来的？", "订阅后先发现 Coordinator、加入 Group、计算/接收 Assignment，再从已提交 Offset 初始化位置。", [
      ["SUBSCRIBE", "orders.created", "声明订阅与 assignor"],
      ["JOIN", "member + subscription", "形成新 Generation/Epoch"],
      ["ASSIGN", "C0 ← P0,P1", "Classic 或新 Consumer Protocol"],
      ["INIT", "committed offset", "确定第一次 Fetch 位置"]
    ], [["group.protocol", "classic / consumer"], ["Kafka 4.x", "新 Consumer Rebalance Protocol 已 GA"], ["兼容", "Classic 仍被广泛使用"]], "poll 不只是拿数据；它还驱动入组、分配与进度初始化。", {
      summary: "subscribe 后，Consumer 在 poll 中完成 Coordinator 发现与入组。Classic Protocol 由成员参与选 Leader/分配；新 Consumer Protocol 把分配逻辑更多移到 Broker，使用渐进式协调。",
      config: [["group.protocol", "classic / consumer"], ["partition.assignment.strategy", "Classic assignor 列表"], ["group.remote.assignor", "新协议可选"], ["auto.offset.reset", "无有效 commit 时起点"]],
      gain: "客户端实例无需静态配置 Partition，Group 自动均衡。", cost: "首次启动与成员变化会经历协调窗口，协议与 assignor 必须兼容。", code: "subscribe\n → FindCoordinator\n → Join/Sync or consumer-group heartbeat\n → assignment\n → initialize fetch positions", source: DOCS.rebalance
    }),

    page("14 · PHYSICAL WRITE", "CONSUMER · 起点", "28A · AUTO OFFSET RESET", "没有有效 Commit 时从哪开始", "新 Group 第一次消费，或者旧 Offset 已被 Retention 删除，会发生什么？", "只有在不存在有效 committed offset 时，auto.offset.reset 才决定起点；它不是每次启动都重置。", [
      ["COMMIT FOUND", "offset 42", "直接从 Group 恢复点继续"],
      ["NO COMMIT", "new group", "应用 reset 策略"],
      ["OUT OF RANGE", "offset expired", "Retention 已删除旧位置"],
      ["RESET", "earliest / latest", "也可 by_duration 或 none"]
    ], [["默认", "latest"], ["重放", "earliest 或显式 seek"], ["防静默跳过", "none 让应用显式处理异常"]], "auto.offset.reset 是无有效恢复点时的兜底，不会覆盖一个仍然有效的 Commit。", {
      summary: "Consumer 初始化每个 Partition 的 position 时优先读取 Group committed offset。只有没有 Commit，或 Commit 已超出当前日志范围时，才使用 auto.offset.reset；latest 可能跳过已有历史数据，earliest 会从仍保留的最早位置重放。",
      config: [["auto.offset.reset", "latest（默认）"], ["可选", "earliest / latest / by_duration / none"], ["触发", "no commit / offset out of range"], ["Retention", "可能让旧 Commit 失效"]],
      gain: "可明确控制新 Group 与 Offset 过期后的恢复行为。", cost: "latest 可能静默跳过历史数据；earliest 可能造成大规模重放与下游压力。", code: "committed(tp)?\n  yes → position = committed\n  no/out-of-range → apply auto.offset.reset", source: DOCS.consumer
    }, "compare"),

    page("14 · PHYSICAL WRITE", "CONSUMER · 分配", "29 · ASSIGNORS", "分区怎么分才算好", "Range、RoundRobin、Sticky 有什么区别？", "Assignor 决定均衡度、Topic 对齐和移动成本；不存在所有场景最优。", [
      ["RANGE", "按 Topic 连续切块", "多 Topic 时可能成员倾斜"],
      ["ROUND ROBIN", "全部 Partition 轮转", "更均匀 · 移动较多"],
      ["STICKY", "均衡 + 尽量不动", "降低状态重建"],
      ["COOPERATIVE", "分阶段转移", "减少全停窗口"]
    ], [["默认关注", "Range + CooperativeSticky 的升级路径"], ["有状态应用", "优先减少 Partition 移动"], ["必须", "同 Group 成员策略兼容"]], "分配算法同时优化均衡与稳定，不能只看 Partition 数是否一样。", {
      summary: "Range 按 Topic 分连续块，RoundRobin 跨 Topic 轮转，Sticky 在均衡基础上尽量保持旧分配，CooperativeSticky 还支持增量撤销与转移。新 Consumer Protocol 提供 Broker 侧 assignor。",
      config: [["partition.assignment.strategy", "Range / RoundRobin / Sticky / CooperativeSticky"], ["group.remote.assignor", "新协议 Broker assignor"], ["目标", "balance + stickiness"], ["约束", "订阅集合与 rack 信息"]],
      gain: "正确策略能减少热点、缓存失效与本地状态重建。", cost: "切换策略通常要规划滚动升级，混用不兼容策略会阻塞入组。", code: "subscriptions + partitions\n → assignor\n → member → TopicPartition set", source: DOCS.consumerApi
    }, "compare"),

    page("14 · PHYSICAL WRITE", "CONSUMER · Rebalance", "30 · REBALANCE TRIGGERS", "什么会触发 Rebalance", "Rebalance 不是只有扩容时才发生吗？", "成员、订阅、Partition 或活性变化都会让旧 Assignment 失效。", [
      ["MEMBER JOIN", "新 Consumer 上线", "重新分摊"],
      ["MEMBER LEAVE", "正常 close / 崩溃", "回收 Partition"],
      ["POLL STALL", "超过 max.poll.interval", "成员被踢出"],
      ["TOPIC CHANGE", "新增 Partition", "订阅拓扑变化"]
    ], [["常见生产根因", "业务处理太慢"], ["另一个根因", "频繁发布/弹性伸缩"], ["观察", "rebalance rate / failed rebalances"]], "Rebalance 是 Assignment 重新达成一致，不是异常本身；频繁发生才是问题。", {
      summary: "成员加入/离开、Session 失效、max.poll.interval 超时、订阅或 Partition 数变化都可能触发 Rebalance。Rebalance 期间某些 Partition 暂停消费。",
      config: [["session.timeout.ms", "成员失活判断"], ["max.poll.interval.ms", "处理循环上限"], ["metadata.max.age.ms", "发现 Partition 变化"], ["group.instance.id", "减少瞬时重启影响"]],
      gain: "Group 能自动适应扩缩容与故障。", cost: "频繁 Rebalance 会造成停顿、缓存失效、重复处理和 Lag 抖动。", code: "membership/topology/liveness change\n → old assignment invalid\n → revoke / reassign / resume", source: DOCS.consumerApi
    }),

    page("14 · PHYSICAL WRITE", "CONSUMER · Rebalance", "31 · EAGER VS COOPERATIVE", "为什么有的 Rebalance 会全停", "Partition 转移一定要 Stop-the-world 吗？", "Eager 先撤销全部再重分；Cooperative 只撤销需要移动的 Partition，并分阶段完成。", [
      ["EAGER · REVOKE", "all partitions", "所有成员先停"],
      ["EAGER · ASSIGN", "new full map", "一次完成"],
      ["COOPERATIVE", "keep unaffected partitions", "继续处理不受影响部分"],
      ["TRANSFER", "revoke only moving P1", "下一轮交给新成员"]
    ], [["收益", "减少全组停顿"], ["代价", "可能多轮协调"], ["回调要求", "onPartitionsRevoked 中正确提交/清理"]], "Cooperative 不是没有 Rebalance，而是把影响限制在真正移动的 Partition。", {
      summary: "Eager 协议在重新分配前撤销所有 Partition，形成全组停顿。Cooperative 协议允许保留未移动分区，只增量撤销和转移需要变化的分区。",
      config: [["CooperativeStickyAssignor", "Classic 的增量策略"], ["group.protocol=consumer", "新渐进协议"], ["ConsumerRebalanceListener", "撤销/分配回调"], ["commit timing", "撤销前提交已处理进度"]],
      gain: "缩短 Rebalance 对稳定 Partition 的影响，降低吞吐抖动。", cost: "状态转换更复杂，应用必须正确处理多轮回调与局部所有权。", code: "eager: revoke all → assign all\ncooperative: keep stable partitions\n             revoke/move only changed partitions", source: DOCS.rebalance
    }, "compare"),

    page("14 · PHYSICAL WRITE", "CONSUMER · 稳定性", "32 · STATIC MEMBERSHIP", "重启一次，不必立刻换分区", "滚动发布为什么也会引发整组 Rebalance？", "设置稳定的 group.instance.id 后，短暂重启可以保留成员身份与 Assignment。", [
      ["INSTANCE", "fulfillment-0", "稳定 group.instance.id"],
      ["RESTART", "process disappears", "短暂未发心跳"],
      ["GRACE", "within session timeout", "Coordinator 暂不回收"],
      ["RETURN", "same instance id", "恢复原有分区"]
    ], [["必须唯一", "同 Group 内不可重复"], ["配合", "合理 session timeout"], ["风险", "真正故障时恢复会更慢"]], "静态成员用更慢的故障接管，换取发布与短抖动时更少 Rebalance。", {
      summary: "group.instance.id 把动态 Member 变成静态成员。进程在 Session 超时前以相同实例 ID 回来时，可减少重新分配；重复 ID 会被 fencing。",
      config: [["group.instance.id", "fulfillment-0"], ["session.timeout.ms", "故障等待窗口"], ["group.protocol", "影响超时配置位置"], ["部署", "实例 ID 必须稳定且唯一"]],
      gain: "滚动重启和短网络抖动时减少 Rebalance 与状态迁移。", cost: "真正宕机时 Partition 可能更晚接管；错误复用 ID 会 fencing。", code: "stable instance id\n → temporary disconnect\n → coordinator waits session timeout\n → same instance resumes assignment", source: DOCS.consumer
    }),

    page("14 · PHYSICAL WRITE", "CONSUMER · 活性", "33 · HEARTBEAT VS POLL", "活着不等于处理得动", "心跳正常，Consumer 为什么还会被踢出 Group？", "Heartbeat 证明进程可达；max.poll.interval 证明应用仍在持续消费。两套时钟解决不同故障。", [
      ["HEARTBEAT", "session.timeout", "网络/进程活性"],
      ["POLL", "max.poll.interval", "应用处理活性"],
      ["BATCH", "max.poll.records", "每轮交给业务的记录数"],
      ["STALL", "slow DB call", "超时后触发 Rebalance"]
    ], [["Classic", "客户端配置 heartbeat/session"], ["Consumer Protocol", "心跳间隔由 Broker 控制"], ["处理方式", "减 max.poll.records 或异步解耦"]], "Session Timeout 发现“死了”；Max Poll Interval 发现“卡住了”。", {
      summary: "Heartbeat 维持 Group 会话，Session Timeout 用来检测失联；max.poll.interval.ms 限制两次 poll 之间的最大处理时间。Classic 协议的 heartbeat.interval.ms 由客户端设置，新 Consumer Protocol 的心跳间隔与会话超时由 Broker 端组配置控制。",
      config: [["group.protocol", "classic（4.1 默认）/ consumer"], ["heartbeat.interval.ms", "仅 Classic 客户端使用"], ["max.poll.interval.ms", "300000"], ["max.poll.records", "500"]],
      gain: "能同时识别进程失联和业务线程卡死。", cost: "处理时长分布与超时不匹配会造成误踢、重复处理和 Rebalance 风暴。", code: "heartbeat clock → member reachable\npoll clock → application making progress\neither violation can change assignment", source: DOCS.consumer
    }),

    page("14 · PHYSICAL WRITE", "CONSUMER · 故障", "34 · REBALANCE STORM", "Rebalance 风暴怎么查", "Lag 周期性暴涨、Consumer 不停撤销分区，先看什么？", "先区分成员活性、处理超时、Coordinator 压力和发布行为，不要只调大一个超时。", [
      ["SIGNAL", "rebalance rate ↑", "确认确实频繁协调"],
      ["MEMBER", "poll latency / GC", "是否卡住或长停顿"],
      ["COORDINATOR", "request latency", "是否协调端拥塞"],
      ["DEPLOY", "instance churn", "是否频繁扩缩/重启"]
    ], [["第一步", "看 revoke 原因与成员日志"], ["第二步", "对齐处理 P99 与 max.poll.interval"], ["第三步", "减少抖动、用 Cooperative/Static"]], "超时调大只能延迟症状；先找到是谁让 Assignment 不稳定。", {
      summary: "Rebalance 风暴常由长 GC、慢下游、poll 间隔超时、成员频繁重启、网络抖动、Coordinator 过载或不兼容 assignor 引起。排查要关联 Group、JVM 与部署事件。",
      config: [["rebalance-rate-per-hour", "频率"], ["last-rebalance-seconds-ago", "稳定性"], ["poll latency P99", "应用处理"], ["heartbeat/session errors", "会话问题"]],
      gain: "按证据分层排查能减少盲目调参。", cost: "仅扩大 Session 或 Poll 超时会让真正故障接管更慢。", code: "rebalance signal\n → member liveness / poll stalls\n → coordinator health\n → deployment churn\n → protocol/assignor compatibility", source: DOCS.consumerApi
    }),

    page("14 · PHYSICAL WRITE", "CONSUMER · Poll", "35 · POLL PIPELINE", "poll() 不是一次简单网络请求", "每调用一次 poll，就立刻发一次 Fetch 吗？", "Consumer 维护预取缓冲和 Group 状态；poll 标记应用仍在推进，并返回已经准备好的记录。心跳是否由后台机制处理取决于协议与客户端实现。", [
      ["POLL", "application progress", "必须持续在期限内调用"],
      ["COORDINATION", "protocol dependent", "心跳/协调可由后台机制维护"],
      ["FETCHER", "prefetch buffers", "提前向多个 Leader 拉取"],
      ["RETURN", "ConsumerRecords", "最多 max.poll.records"]
    ], [["不是", "一条消息一次 Fetch"], ["不是", "poll timeout 等于 Broker fetch wait"], ["约束", "KafkaConsumer 非线程安全"]], "poll 是应用进度的租约；Fetch 与心跳可以预取或后台推进，但应用仍必须按时 poll。", {
      summary: "KafkaConsumer 的 poll 与 Group 协调、Fetch 位置更新、本地缓冲返回相配合。客户端会保持多个 Partition 的 Fetch 管道；在 Kafka 4.1 中，具体心跳路径受 group.protocol 与客户端实现影响，不应把所有工作都理解成 poll 线程同步执行。",
      config: [["max.poll.records", "每次返回给应用的最大条数"], ["max.poll.interval.ms", "应用调用 poll 的期限"], ["group.protocol", "classic / consumer"], ["KafkaConsumer", "单线程调用约束"]],
      gain: "预取与批量返回隐藏网络延迟并提高吞吐。", cost: "业务处理若阻塞 poll，既影响 Fetch 也影响 Group 稳定性。", code: "while (running) {\n  records = consumer.poll(timeout);\n  process(records);\n  commit();\n}", source: DOCS.consumerApi
    }),

    page("14 · PHYSICAL WRITE", "CONSUMER · Fetch", "36 · FETCH REQUEST", "Fetch 直接找 Partition Leader", "Consumer 到底向谁要 offset 42？", "它根据 Metadata 把不同 Partition 的 Fetch 按 Leader Broker 合并成请求。", [
      ["POSITION", "P1 nextOffset=42", "Consumer 想从这里读"],
      ["METADATA", "P1 Leader=B0", "Leader 已发生切换"],
      ["FETCH REQUEST", "P1 offset 42", "带每分区字节上限"],
      ["LEADER B0", "read P1 log", "Coordinator 不在数据路径"]
    ], [["Fetch session", "减少重复请求元数据"], ["多个 Partition", "按目标 Broker 合并"], ["错误", "OFFSET_OUT_OF_RANGE / NOT_LEADER"]], "Offset 决定从哪读；Metadata 决定向谁读。", {
      summary: "Consumer 为每个 assigned Partition 维护 fetch position，并依据 Metadata 将 FetchRequest 发往其 Leader。一个请求可携带同一 Broker 上多个 Partition 的读取位置。",
      config: [["fetch.max.bytes", "整个 Fetch 响应上限"], ["max.partition.fetch.bytes", "单 Partition 上限"], ["fetch.min.bytes", "最小聚合字节"], ["fetch.max.wait.ms", "最长等待"]],
      gain: "客户端直读 Leader，可并行利用多个 Broker。", cost: "Leader 变化、Offset 过期和单个大批次会影响抓取节奏。", code: "assignment positions\n → group by leader broker\n → FetchRequest(partition, offset, limits)\n → leader log read", source: DOCS.protocol
    }),

    page("14 · PHYSICAL WRITE", "BROKER · Read", "37 · INDEX LOOKUP", "Broker 如何定位 offset 42", "Partition 有几百 GB，难道从头扫描？", "Broker 先选包含 offset 的 Segment，再用稀疏 .index 找到接近位置，最后顺序扫描少量 .log。", [
      ["SEGMENT MAP", "baseOffset 40", "42 属于 40.* 文件组"],
      [".INDEX", "relative 2 → pos 8192", "找到不大于目标的稀疏项"],
      [".LOG", "scan from 8192", "解析少量 RecordBatch"],
      ["SLICE", "records from offset 42", "形成 FileRecords 视图"]
    ], [["稀疏", "不是每个 offset 都有索引项"], ["index.interval.bytes", "控制索引密度"], ["顺序扫描", "利用局部性，比全量索引更省内存"]], "索引只负责靠近目标；最终仍由 .log 中的 RecordBatch 决定记录边界。", {
      summary: "LocalLog 按 baseOffset 找 Segment，OffsetIndex 用 relative offset 找到最近的物理位置，然后顺序解析 .log 中的 RecordBatch 直到目标 offset。",
      config: [["index.interval.bytes", "4096"], ["segment.index.bytes", "索引最大尺寸"], ["baseOffset", "40"], ["target offset", "42"]],
      gain: "小而稀疏的索引可常驻内存，读取仍保持顺序 I/O 友好。", cost: "每次定位需要局部扫描，索引损坏时还要从 .log 重建。", code: "target offset 42\n → floor segment baseOffset 40\n → OffsetIndex.lookup(relative=2)\n → scan FileRecords from physical position", source: DOCS.design
    }),

    page("14 · PHYSICAL WRITE", "OS · Read", "38 · PAGE CACHE OR DISK", "Consumer 读的是缓存还是磁盘", "Fetch offset 42 时，Broker 会先查一个 Kafka 自己的 Cache 吗？", "Kafka 主要依赖 Linux Page Cache；命中热页就从内存返回，未命中才触发磁盘读取与 readahead。", [
      ["FILE RANGE", "40.log @ pos 8192", "Kafka 请求文件区间"],
      ["PAGE CACHE HIT", "RAM pages present", "无需 NVMe 读取"],
      ["CACHE MISS", "major page fault / read", "文件系统从 NVMe 装页"],
      ["READAHEAD", "next sequential pages", "为后续 Fetch 预取"]
    ], [["不是", "Broker JVM 堆里复制一份消息缓存"], ["命中条件", "Consumer 跟得上热点写入"], ["慢 Consumer", "更可能读到冷 Segment"]], "Kafka 把缓存管理交给 OS，让写入与读取共享同一套文件页。", {
      summary: "Broker 读取 FileRecords 时，Linux 通过 Page Cache 提供文件页。刚写入的数据通常仍在缓存；慢 Consumer 读冷数据时会触发磁盘 I/O 和顺序预读。",
      config: [["Page Cache", "由 Linux 管理"], ["JVM heap", "不作为消息数据主缓存"], ["retention", "影响工作集大小"], ["consumer lag", "影响热/冷读概率"]],
      gain: "避免应用维护双份缓存，利用成熟的文件系统缓存与顺序预读。", cost: "内存压力会影响命中率；冷读会与写入/复制争用磁盘带宽。", code: "FileRecords read range\n → Linux Page Cache\n   hit: RAM\n   miss: filesystem + NVMe + readahead", source: DOCS.design
    }, "compare"),

    page("14 · PHYSICAL WRITE", "OS · Network", "39 · ZERO COPY", "热数据怎样少复制一次", "Page Cache 里的字节如何发回 Consumer？", "明文传输可利用 sendfile/transferTo，让内核把文件页直接送入 Socket；TLS 通常需要用户态加密路径。", [
      ["FILE PAGES", "Page Cache", "已定位 RecordBatch 区间"],
      ["PLAINTEXT", "sendfile / transferTo", "内核文件页 → Socket"],
      ["TLS", "user-space encryption", "需要经过加密缓冲"],
      ["NIC", "TCP response", "发往 Consumer"]
    ], [["收益", "减少用户态复制与 CPU"], ["前提", "文件记录可直接传输"], ["TLS 权衡", "安全必需时接受更多 CPU/复制"]], "Zero-copy 优化的是数据搬运路径，不会绕过 Kafka 协议和权限。", {
      summary: "Kafka 的文件记录发送可利用 transferTo/sendfile，把 Page Cache 文件页直接交给内核 Socket，避免把 payload 复制进 JVM。启用 TLS 时通常需要用户态加密，路径不同。",
      config: [["security.protocol", "PLAINTEXT vs SSL"], ["socket.send.buffer.bytes", "Broker Socket 缓冲"], ["fetch.max.bytes", "响应批次"], ["network threads", "负责响应发送"]],
      gain: "明文热读可显著降低 CPU 和内存复制开销。", cost: "TLS 安全带来合理的加密与复制成本；冷读瓶颈仍在磁盘。", code: "FileRecords slice\n → transferTo/sendfile (plaintext)\n → kernel socket → NIC\nTLS: bytes pass encryption path", source: DOCS.design
    }, "compare"),

    page("14 · PHYSICAL WRITE", "CONSUMER · 吞吐", "40 · FETCH TUNING", "Fetch 是延迟与吞吐的拨杆", "怎样让 Consumer 少发请求、一次拿更多？", "fetch.min.bytes 与 fetch.max.wait.ms 共同决定 Broker 等多少数据；大小上限控制内存与公平性。", [
      ["LOW LATENCY", "min=1 byte", "有数据就回 · 请求更多"],
      ["THROUGHPUT", "larger min bytes", "等待聚合 · 响应更大"],
      ["WAIT CAP", "fetch.max.wait.ms", "即使不够也要返回"],
      ["SIZE CAPS", "fetch.max / per-partition", "保护客户端内存"]
    ], [["调优前", "先看单次 Fetch 大小和等待时间"], ["不要", "只增大 max.poll.records 当成网络调优"], ["特殊", "首个超大 RecordBatch 可能突破常规上限以保证可前进"]], "Fetch 调优是在响应次数、等待时间、内存与分区公平之间平衡。", {
      summary: "Broker 在达到 fetch.min.bytes 或 fetch.max.wait.ms 后返回。fetch.max.bytes 限制总响应，max.partition.fetch.bytes 限制单 Partition；max.poll.records 只限制每次交给应用的记录数，不限制底层 Fetch 缓冲。",
      config: [["fetch.min.bytes", "1"], ["fetch.max.wait.ms", "500"], ["fetch.max.bytes", "52428800"], ["max.partition.fetch.bytes", "1048576"], ["max.poll.records", "500"]],
      gain: "可以按在线低延迟或离线高吞吐选择合适批量。", cost: "过大响应增加内存与长尾，过小则增加请求、系统调用与 Broker CPU。", code: "return fetch when\n bytes >= fetch.min.bytes\n or wait >= fetch.max.wait.ms\nsubject to response size caps", source: DOCS.consumer
    }, "compare"),

    page("14 · PHYSICAL WRITE", "CONSUMER · 解码", "41 · DECOMPRESS & DESERIALIZE", "字节怎样重新变成对象", "#A1024 到了 Consumer JVM 后，要做哪些检查？", "客户端解析 RecordBatch、验证 CRC、解压，然后分别反序列化 key/value；Headers 保持 byte[]。", [
      ["NETWORK", "FetchResponse bytes", "按 Partition 组织批次"],
      ["BATCH", "CRC + decompress", "zstd → Records"],
      ["DESERIALIZER", "key/value", "bytes → String / OrderCreated"],
      ["RESULT", "ConsumerRecord<K,V>", "保留 topic/partition/offset"]
    ], [["常见事故", "Unknown magic / corrupt batch"], ["常见事故", "反序列化异常导致 poison pill"], ["契约", "Reader 必须兼容 Writer schema"]], "生产端序列化是去程边界，消费端反序列化是回程边界。", {
      summary: "Consumer 收到 FetchResponse 后解析批次、验证记录格式/CRC、按 codec 解压，并调用 KeyDeserializer 与 ValueDeserializer。反序列化异常通常发生在 poll 返回记录之前或转换阶段。",
      config: [["key.deserializer", "StringDeserializer"], ["value.deserializer", "Avro/Protobuf/JSON"], ["isolation.level", "影响可见批次"], ["schema compatibility", "Reader/Writer 契约"]],
      gain: "Broker 保持类型无关，端点可独立演进语言与对象模型。", cost: "坏数据可能持续卡住同一 Offset，需要明确的错误处理策略。", code: "FetchResponse bytes\n → parse RecordBatch + CRC\n → decompress\n → deserialize key/value\n → ConsumerRecord<K,V>", source: DOCS.consumerApi
    }),

    page("14 · PHYSICAL WRITE", "CONSUMER · 记录", "42 · CONSUMER RECORD", "Consumer 最终拿到哪些字段", "消费端看到的对象和 ProducerRecord 一样吗？", "业务 key/value/headers 回来了，同时多出 Kafka 在存储路径上确定的位置与元数据。", [
      ["ROUTING", "topic · partition", "orders.created · P1"],
      ["POSITION", "offset=42", "日志逻辑位置"],
      ["TIME", "timestamp · type", "CreateTime 或 LogAppendTime"],
      ["PAYLOAD", "key · value · headers", "user-9527 · OrderCreated"]
    ], [["还可能有", "serializedKeySize / serializedValueSize"], ["Leader Epoch", "可选元数据"], ["没有", "Producer 的 Future/Callback"]], "ConsumerRecord = 业务载荷 + Kafka 位置上下文。", {
      summary: "ConsumerRecord 含 Topic、Partition、Offset、Timestamp、TimestampType、key、value、headers，以及序列化大小和可选 Leader Epoch。Offset 是处理、重试和提交的核心坐标。",
      config: [["topic", "orders.created"], ["partition", "1"], ["offset", "42"], ["key", "user-9527"], ["headers", "traceparent, tenant-id, schema-version"]],
      gain: "业务能基于精确坐标实现审计、去重、重放与链路追踪。", cost: "应用必须理解 Offset 属于 Partition，不能把它当全局消息 ID。", code: "ConsumerRecord<K,V>\n topic, partition, offset, timestamp\n key, value, headers, leaderEpoch", source: DOCS.consumerApi
    }),

    page("14 · PHYSICAL WRITE", "CONSUMER · 业务", "43 · BUSINESS PROCESSING", "真正的风险在业务处理", "拿到 #A1024 后，什么时候才算“消费成功”？", "Kafka 只把记录交给应用；数据库写入、HTTP 调用、缓存更新的成功语义由业务决定。", [
      ["POLL", "offset 42", "记录进入业务线程"],
      ["VALIDATE", "schema + domain rules", "业务校验"],
      ["SIDE EFFECT", "DB / HTTP / cache", "真正的外部结果"],
      ["DECIDE", "commit / retry / DLQ", "根据结果推进或保留位置"]
    ], [["顺序", "同 Partition 应串行或按 Key 保序"], ["幂等", "业务主键 / 去重表 / 状态机"], ["超时", "必须小于 max.poll.interval 或解耦"]], "Kafka ACK 不是业务成功；Offset Commit 也不会回滚外部副作用。", {
      summary: "消费应用对 ConsumerRecord 执行业务副作用。数据库、HTTP 或缓存失败不会自动让 Kafka 回滚；应用需决定重试、暂停 Partition、写重试 Topic/DLQ 或提交进度。",
      config: [["max.poll.records", "控制单轮工作量"], ["max.poll.interval.ms", "处理时间预算"], ["幂等键", "orderId / eventId"], ["超时与重试", "按下游容量设计"]],
      gain: "应用可以自由组合业务流程与可靠性策略。", cost: "Kafka 与外部系统之间不存在自动原子性，需要幂等、Outbox 或事务模式。", code: "poll record\n → validate\n → perform side effect\n → on success commit next offset\n → on failure retry/pause/DLQ", source: DOCS.consumerApi
    }),

    page("14 · PHYSICAL WRITE", "CONSUMER · 背压", "43A · PAUSE & RESUME", "下游变慢时先停某些 Partition", "数据库过载了，怎样继续 poll 保活，又不把更多记录交给业务？", "pause/resume 只暂停指定 Partition 的后续 Fetch 交付；Consumer 仍需持续 poll，并自行管理在途任务、顺序与 Commit。", [
      ["DETECT", "P1 work queue high", "下游容量不足"],
      ["PAUSE", "consumer.pause(P1)", "暂不从 P1 返回新记录"],
      ["POLL", "keep polling", "维持 Group 与处理其他分区"],
      ["RESUME", "queue drained", "从现有 position 继续"]
    ], [["不会", "自动 Rebalance"], ["不会", "自动 Commit 在途记录"], ["必须", "按 Partition 维护完成水位"]], "pause 是本地流控，不是业务失败语义；保活、保序和恢复点仍由应用负责。", {
      summary: "Consumer 可以暂停压力过大的 Partition，同时继续 poll 维持活性并消费其他 Partition。异步处理时必须记录每个 Partition 连续完成到哪里，只能提交没有空洞的下一 Offset。",
      config: [["pause/resume", "TopicPartition 集合"], ["max.poll.interval.ms", "仍需按时 poll"], ["max.poll.records", "限制单轮交付量"], ["commit", "只提交连续完成水位"]],
      gain: "把下游背压限制在相关 Partition，并减少因处理过慢触发的 Rebalance。", cost: "应用需要实现有界队列、分区级顺序、在途追踪和安全恢复，复杂度显著上升。", code: "if queueHigh(tp) consumer.pause(tp)\nconsumer.poll(timeout) // keep group alive\nwhen contiguous work completes:\n  commit(nextOffset); consumer.resume(tp)", source: DOCS.consumerApi
    }),

    page("14 · PHYSICAL WRITE", "CONSUMER · 进度", "44 · POSITION VS COMMITTED", "当前位置不等于已提交位置", "Consumer 已经读到 43，为什么重启还会从 42 开始？", "Position 是当前实例下一次 Fetch 的位置；Committed Offset 是 Group 重启或再分配后的恢复点。", [
      ["COMMITTED", "42", "Group 持久恢复点"],
      ["FETCH", "read offset 42", "把 #A1024 交给应用"],
      ["POSITION", "43", "本实例下次从这里 Fetch"],
      ["COMMIT", "43", "表示 0..42 已处理"]
    ], [["最易错", "提交的是下一条 Offset"], ["position", "可因 seek 改变"], ["committed", "写入 Coordinator / __consumer_offsets"]], "读到 offset 42 后，应提交 43；Commit 表达的是“下一条从哪开始”。", {
      summary: "Position 随 Fetch 自动前进，代表下一条要取的 Offset；Committed Offset 是 Group 的持久恢复位置。处理 offset 42 成功后提交 43，而不是 42。",
      config: [["position(tp)", "当前实例下一 Fetch 位置"], ["committed(tp)", "Group 持久位置"], ["seek(tp, offset)", "手动调整 Position"], ["OffsetAndMetadata", "提交下一条位置"]],
      gain: "把快速本地读取进度与较慢持久恢复点解耦。", cost: "两者差距就是崩溃后可能重复处理的窗口。", code: "consume offset 42\nposition becomes 43\nafter successful processing:\ncommit offset 43", source: DOCS.consumerApi
    }),

    page("14 · PHYSICAL WRITE", "CONSUMER · Commit", "45 · COMMIT STRATEGIES", "Offset 什么时候提交", "auto、sync、async 该怎么选？", "提交频率决定重复窗口、Coordinator 压力与故障恢复位置。", [
      ["AUTO", "periodic during poll", "简单 · 易误解处理边界"],
      ["SYNC", "commitSync", "确认成功 · 阻塞调用"],
      ["ASYNC", "commitAsync", "低延迟 · 回调与乱序要小心"],
      ["BATCH", "commit processed offsets", "最常见可控方式"]
    ], [["enable.auto.commit", "生产业务常显式关闭"], ["提交粒度", "每 Partition 记录已完成 Offset"], ["Rebalance", "撤销前提交已处理进度"]], "先定义“处理成功”，再选择 Commit；不要反过来。", {
      summary: "自动提交会周期性提交 Consumer 已返回给应用的进度，并不知道业务副作用是否成功；同步提交等待 Coordinator 响应；异步提交不阻塞但回调顺序与失败重试要谨慎。常见模式是批处理成功后显式提交每个 Partition 的下一 Offset。",
      config: [["enable.auto.commit", "false（常见生产选择）"], ["auto.commit.interval.ms", "5000"], ["commitSync", "可靠但阻塞"], ["commitAsync", "低延迟但需处理回调"]],
      gain: "可以按处理语义精确控制恢复点与重复窗口。", cost: "提交过频增加 Coordinator 压力，过稀增加崩溃后的重复处理。", code: "process batch\n → offsets[tp] = lastProcessed + 1\n → commitSync/commitAsync(offsets)", source: DOCS.consumerApi
    }, "compare"),

    page("14 · PHYSICAL WRITE", "CORE DESIGN · 一致性", "46 · CONSISTENCY BLUEPRINT", "Kafka 的一致性，到底保证到哪一层？", "ACK、读取、业务成功，是同一件事吗？", "不是一个边界。Partition 顺序、复制可见、事务可见和业务恢复，各自只承诺能控制的事情。", [
      ["ORDER", "TopicPartition + offset", "只保证单 Partition 内顺序"],
      ["LOG COMMIT", "ISR → HW", "普通读取不越过复制边界"],
      ["TXN VISIBILITY", "LSO + markers", "read_committed 隐藏未决/中止事务"],
      ["BUSINESS", "side effect + commit", "外部结果仍需幂等或同库事务"]
    ], [["最常用", "process → commit = at-least-once"], ["Kafka EOS", "输出 Topic + Offset 同一事务"], ["外部系统", "eventId / Outbox / 同库 Offset"]], "一致性不是一个布尔值：先说清顺序范围、可见边界、故障窗口和外部副作用。", {
      summary: "Kafka 在不同边界提供不同保证：Partition 内顺序由 Offset 建模，HW 约束复制可见性，LSO 约束事务可见性，Committed Offset 只记录消费恢复点。外部数据库副作用不自动属于 Kafka 事务。",
      config: [["ordering", "per partition"], ["visibility", "HW / LSO"], ["retry", "idempotence"], ["recovery", "committed offset"], ["external", "idempotency / outbox"]],
      gain: "把一致性拆成可验证的边界，故障时能准确判断会不会乱序、重读、跳过或暴露未提交数据。", cost: "越强的跨边界原子性，需要更多协调、状态与延迟；外部系统还要参与设计。", code: "canRead(offset):\n  require offset < HW\n  if readCommitted:\n    require offset < LSO && !aborted\n\nprocess(record)\ncommit(record.offset + 1)\non crashBeforeCommit:\n  replaySafely(record.eventId)", source: DOCS.design
    }, "blueprint"),

    page("14 · PHYSICAL WRITE", "CONSUMER · 坏消息", "47 · POISON PILL & DLQ", "一条坏消息不能卡死 Partition", "offset 42 永远反序列化失败，怎么办？", "无限原地重试会阻塞后续 Offset；生产系统需要有限重试、隔离与可追溯的 DLQ。", [
      ["FAIL", "offset 42", "deserialize / business error"],
      ["RETRY", "bounded + backoff", "短暂错误先重试"],
      ["RETRY TOPIC", "delayed attempts", "释放原 Partition 但改变顺序"],
      ["DLQ", "payload + headers + error", "人工/自动修复后重放"]
    ], [["DLQ 必带", "原 topic/partition/offset"], ["还要带", "exception、schema、trace、attempt"], ["权衡", "跨 Topic 重试通常放弃严格原序"]], "坏消息处理的目标不是“吞掉异常”，而是保留证据并让主流继续。", {
      summary: "Poison pill 可能在反序列化或业务处理阶段发生。有限本地重试适合瞬时错误；延迟重试 Topic 与 DLQ 可解锁主 Partition，但需要接受顺序与操作复杂度。",
      config: [["retry attempts", "有限次数"], ["backoff", "指数或分级"], ["DLQ headers", "source coordinates + error"], ["commit", "隔离成功后推进原 Offset"]],
      gain: "单条坏数据不再永久阻塞整个 Partition，且保留可重放证据。", cost: "跨 Topic 重试改变严格顺序，需要额外 Topic、监控和修复流程。", code: "process offset 42\n → bounded retry\n → retry topic or DLQ with source metadata\n → commit original offset 43", source: DOCS.consumerApi
    }),

    page("14 · PHYSICAL WRITE", "OPERATIONS · Lag", "48 · CONSUMER LAG", "Lag 到底是哪两个 Offset 相减", "Consumer Lag 高，是 Broker 慢还是业务慢？", "常见 Group Lag 用日志末端减 Committed Offset；read_committed 客户端的 Fetch Lag 则以 LSO 为末端。还要结合 Position 区分拉取慢与提交慢。", [
      ["LOG END", "43", "Leader 当前日志末端"],
      ["POSITION", "43", "客户端已拉到下一位置"],
      ["COMMITTED", "42", "Group 恢复点还未推进"],
      ["LAG", "43 − 42 = 1", "#A1024 尚未确认处理"]
    ], [["常见 Group Lag", "Log End − Committed"], ["read_committed", "客户端 Fetch Lag 相对 LSO"], ["最危险", "Lag 接近 Retention 窗口"]], "Lag 是结果指标；定位根因要把 Fetch、处理、Commit、事务可见性和写入速率拆开。", {
      summary: "监控工具常用日志末端与 Group committed offset 计算 Group Lag。read_committed Consumer 的客户端 Fetch Lag 指标相对 LSO 计算。若 Position 已追上但 Commit 落后，问题在处理/提交；若 Position 也落后，则看 Fetch、Broker、网络或分区热点。",
      config: [["records-lag-max", "客户端最大记录 Lag"], ["fetch-latency-avg/max", "读取路径"], ["poll/processing latency", "业务路径"], ["retention headroom", "还能落后多久"]],
      gain: "拆分多个 Offset 能快速判断慢在 Broker、网络、业务还是 Commit。", cost: "只看一个总 Lag 数字容易误判；高写入速率下必须看变化率和时间窗口。", code: "log end / HW\n - consumer position\n - committed offset\ncorrelate with fetch and processing latency", source: DOCS.consumerApi
    }),

    page("14 · PHYSICAL WRITE", "CORE DESIGN · 高性能", "49 · PERFORMANCE BLUEPRINT", "Kafka 为什么写磁盘、做复制，还能保持高吞吐？", "高性能来自一个神奇技巧吗？", "不是。Kafka 把并行、批处理、顺序 I/O、操作系统缓存和少拷贝组合成同一条流水线。", [
      ["PARALLEL", "Partition → Broker", "用独立日志扩大并行度"],
      ["AMORTIZE", "Batch + compression", "摊薄协议头、系统调用和网络往返"],
      ["SEQUENTIAL", "append → Page Cache", "避免随机写并交给 OS 统一缓存"],
      ["PIPELINE", "prefetch + sendfile", "读写并行，热数据尽量少搬运"]
    ], [["延迟代价", "linger / fetch wait 增加等待"], ["资源代价", "更多 Partition 增加文件与协调"], ["CPU 代价", "TLS / 压缩用计算换安全与带宽"]], "Kafka 的高性能不是不做工作，而是批量做、顺序做、并行做、少搬运。", {
      summary: "Kafka 的吞吐来自一组互相配合的设计：Partition 提供并行度，RecordBatch 摊薄固定开销并提高压缩率，Append-only Log 与 Page Cache 形成顺序 I/O，Consumer 预取与 sendfile 路径降低等待和复制。",
      config: [["parallelism", "partitions"], ["batching", "batch.size + linger.ms"], ["compression", "zstd / lz4"], ["storage", "page cache"], ["read", "fetch batching / sendfile"]],
      gain: "固定开销被批次摊薄，磁盘访问更顺序，Producer、Broker、Follower 与 Consumer 可以流水并行。", cost: "批次等待提高尾延迟；Partition 过多增加元数据、文件句柄和 Rebalance 成本；TLS 会削弱零拷贝优势。", code: "tp = partition(hash(key))\nbatch = accumulator[tp].append(serialize(record))\nif batch.ready:\n  request[leader(tp)].add(compress(batch))\n\nbroker.appendSequentially(batch) // Page Cache\nfollowers.pullBatches()\nconsumer.prefetch()\nsendFileSliceWhenPossible()", source: DOCS.design
    }, "blueprint")
  ];
})();

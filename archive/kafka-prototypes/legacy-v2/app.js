(function () {
  "use strict";

  const zones = [
    { name: "业务事件", short: "OrderCreated", firstStep: 0 },
    { name: "Producer", short: "对象 → Batch", firstStep: 1 },
    { name: "网络", short: "ProduceRequest", firstStep: 6 },
    { name: "Broker", short: "处理与追加", firstStep: 8 },
    { name: "存储", short: "Page Cache / Log", firstStep: 10 },
    { name: "副本与 ACK", short: "ISR / HW", firstStep: 11 },
    { name: "Consumer", short: "Fetch / Commit", firstStep: 13 }
  ];

  const lenses = [
    { id: "global", label: "全局" },
    { id: "code", label: "代码" },
    { id: "data", label: "数据" },
    { id: "runtime", label: "运行时" },
    { id: "network", label: "网络" },
    { id: "storage", label: "存储" },
    { id: "reliability", label: "可靠性" },
    { id: "config", label: "配置" }
  ];

  const steps = [
    {
      kicker: "STEP 01 · BUSINESS",
      title: "业务代码创建 OrderCreated",
      summary: "一切从 JVM 中的普通业务对象开始，此时 Kafka 还不知道它的存在。",
      zone: 0,
      form: "OrderCreated 对象",
      input: "用户完成支付",
      action: "创建领域事件",
      output: "OrderCreated Java 对象",
      memory: "Kafka 的旅程不是从 Broker 开始，而是从业务对象及其语义开始。",
      code: {
        file: "OrderService.java",
        lines: [
          "Payment payment = paymentService.confirm(command);",
          "",
          "OrderCreated event = new OrderCreated(",
          "    order.getId(),",
          "    order.getUserId(),",
          "    order.getAmount()",
          ");",
          "eventPublisher.publish(event);"
        ],
        activeLine: 2,
        path: [["OrderController", "接收支付完成请求"], ["OrderService", "确认订单状态"], ["OrderCreated", "创建不可变业务事实"], ["EventPublisher", "准备交给 Kafka adapter"]]
      },
      data: {
        beforeTitle: "业务状态",
        before: [["orderId", "A1024"], ["userId", "9527"], ["amount", "99.80"], ["status", "PAID"]],
        operation: "构造事件",
        afterTitle: "OrderCreated",
        after: [["orderId", "A1024"], ["userId", "9527"], ["amount", "99.80"], ["occurredAt", "2026-08-20T13:00:00Z"]],
        note: "事件表达已经发生的事实，字段应稳定、可演进，并避免泄露无关内部对象。"
      },
      runtime: { thread: "http-nio-8080-exec-7", active: 2, pipeline: ["Controller", "Service", "Domain Event", "Kafka Adapter"], detail: [["对象位置", "JVM Heap"], ["所有权", "order-service"], ["Kafka I/O", "尚未发生"]] },
      network: { active: false, message: "当前仍在业务线程中，没有创建 Kafka 网络请求。", next: "Producer.send() 之后才可能进入网络阶段。" },
      storage: { active: false, message: "目前只存在于 JVM Heap，没有进入 Page Cache 或 Kafka 日志文件。" },
      reliability: { phase: "before", message: "此时 Kafka 的副本、ISR 和 ACK 都尚未参与。业务事务与事件发布的一致性需要单独设计。" },
      configs: [["event.version", "v1", "为事件契约保留明确版本。"], ["topic naming", "orders.created", "使用稳定、表达业务事实的 Topic 名称。"], ["outbox pattern", "recommended", "需要数据库事务与消息发布一致时，可使用 Transactional Outbox。"]]
    },
    {
      kicker: "STEP 02 · PRODUCER RECORD",
      title: "组装 ProducerRecord",
      summary: "业务对象被包装为 Kafka 的发送模型，Topic、Key、Value、Headers 第一次聚合在一起。",
      zone: 1,
      form: "ProducerRecord<String, OrderCreated>",
      input: "OrderCreated 对象",
      action: "绑定 Topic、Key、Value、Headers",
      output: "ProducerRecord",
      memory: "Key 决定分区亲和性；Headers 适合链路信息，但 Header value 本身必须是 byte[]。",
      code: {
        file: "KafkaOrderEventPublisher.java",
        lines: [
          "var record = new ProducerRecord<>(",
          "    \"orders.created\",",
          "    null,           // partition",
          "    null,           // timestamp",
          "    \"user-9527\",  // key",
          "    event           // value",
          ");",
          "record.headers().add(\"traceparent\", traceBytes);"
        ],
        activeLine: 0,
        path: [["Topic", "orders.created"], ["Key", "user-9527"], ["Value", "OrderCreated"], ["Headers", "traceparent / tenant-id"]]
      },
      data: {
        beforeTitle: "OrderCreated",
        before: [["orderId", "A1024"], ["userId", "9527"], ["amount", "99.80"]],
        operation: "包装 Record",
        afterTitle: "ProducerRecord<K,V>",
        after: [["topic", "orders.created"], ["partition", "null"], ["timestamp", "null"], ["key", "user-9527"], ["value", "OrderCreated"], ["headers", "3 entries"]],
        note: "partition 和 timestamp 可以暂时为空，后续由 Producer 与 Broker 补全。"
      },
      runtime: { thread: "http-nio-8080-exec-7", active: 3, pipeline: ["Business Object", "ProducerRecord", "KafkaProducer.send", "Interceptor"], detail: [["对象位置", "JVM Heap"], ["泛型", "String / OrderCreated"], ["异步结果", "Future<RecordMetadata>"] ] },
      network: { active: false, message: "ProducerRecord 仍是客户端内存中的 Java 对象。", next: "完成序列化、分区和批处理后才会生成 ProduceRequest。" },
      storage: { active: false, message: "Record 还没有 Offset，也没有任何 Kafka 文件位置。" },
      reliability: { phase: "before", message: "acks、ISR 和幂等性尚未生效；这些机制从真正发送 Batch 时开始参与。" },
      configs: [["client.id", "order-service", "标识 Producer，方便指标、日志和配额定位。"], ["bootstrap.servers", "kafka-1:9092,kafka-2:9092", "只用于首次发现集群元数据。"], ["max.block.ms", "60s", "元数据不可用或缓冲区耗尽时 send 的最大阻塞时间。"]]
    },
    {
      kicker: "STEP 03 · INTERCEPTOR & METADATA",
      title: "Interceptor 补充信息并查询元数据",
      summary: "横切信息被写入 Headers，同时 Producer 确认 Topic 的分区数量和各 Leader 所在节点。",
      zone: 1,
      form: "带 Headers 的 ProducerRecord",
      input: "ProducerRecord",
      action: "onSend() + Metadata Cache",
      output: "Record + Topic 路由元数据",
      memory: "数据发送之前，Producer 必须先知道目标 Partition 的 Leader 在哪台 Broker。",
      code: {
        file: "KafkaProducer.java",
        lines: [
          "ProducerRecord<K, V> interceptedRecord =",
          "    interceptors.onSend(record);",
          "",
          "ClusterAndWaitTime clusterAndWaitTime =",
          "    waitOnMetadata(record.topic(), partition, now, maxBlockTimeMs);",
          "Cluster cluster = clusterAndWaitTime.cluster;"
        ],
        activeLine: 1,
        path: [["ProducerInterceptor.onSend", "注入 traceparent"], ["Metadata Cache", "读取本地缓存"], ["MetadataRequest", "必要时刷新"], ["Cluster", "得到 P0/P1/P2 与 Leader"]]
      },
      data: {
        beforeTitle: "ProducerRecord",
        before: [["headers", "tenant-id / content-type"], ["partition", "unknown"], ["leader", "unknown"]],
        operation: "补充 + 查询",
        afterTitle: "Record + Cluster",
        after: [["headers", "+ traceparent"], ["partitions", "P0 / P1 / P2"], ["leaders", "B1 / B2 / B3"]],
        note: "Interceptor 可以返回新的 ProducerRecord，但不应执行慢 I/O 或吞掉异常。"
      },
      runtime: { thread: "application thread", active: 1, pipeline: ["Interceptor Chain", "Metadata Cache", "Metadata Updater", "Cluster Snapshot"], detail: [["Header value", "byte[]"], ["缓存更新", "后台 I/O 线程"], ["阻塞边界", "max.block.ms"]] },
      network: { active: true, index: 2, title: "MetadataRequest（仅在缓存缺失或过期时）", packet: [["API", "Metadata"], ["Target", "任意可用 Broker"], ["Topic", "orders.created"], ["Result", "Partitions + Leaders"]] },
      storage: { active: false, message: "元数据查询不会写入 orders.created 的日志文件。" },
      reliability: { phase: "before", message: "这里获取的是路由视图。真正写入前如果 Leader 变化，Producer 会刷新元数据并重试。" },
      configs: [["interceptor.classes", "TracingProducerInterceptor", "按声明顺序执行 ProducerInterceptor。"], ["metadata.max.age.ms", "5m", "即使没有变化也会周期刷新元数据。"], ["metadata.max.idle.ms", "5m", "长时间未访问的 Topic 可从缓存移除。"]]
    },
    {
      kicker: "STEP 04 · SERIALIZATION",
      title: "Key 与 Value 变成 byte[]",
      summary: "Kafka 不理解 Java 对象，只接受 Serializer 输出的 Key bytes 与 Value bytes。",
      zone: 1,
      form: "SerializedRecord · key/value bytes",
      input: "String Key + OrderCreated Value",
      action: "分别调用 Key/Value Serializer",
      output: "keyBytes + valueBytes + headers",
      memory: "Headers 不经过 Value Serializer；每个 Header value 在 ProducerRecord 中已经是 byte[]。",
      code: {
        file: "KafkaProducer#doSend",
        lines: [
          "byte[] serializedKey = keySerializerPlugin.get().serialize(",
          "    record.topic(), record.headers(), record.key());",
          "",
          "byte[] serializedValue = valueSerializerPlugin.get().serialize(",
          "    record.topic(), record.headers(), record.value());",
          "int serializedSize = estimateSizeInBytes(...);"
        ],
        activeLine: 0,
        path: [["StringSerializer", "key → UTF-8 bytes"], ["JsonSerializer", "value → JSON bytes"], ["Headers", "保留 String + byte[]"], ["Size Check", "检查请求与记录大小"]]
      },
      data: {
        beforeTitle: "Java 对象",
        before: [["key", "\"user-9527\""], ["value", "OrderCreated{...}"], ["headers", "String + byte[]"]],
        operation: "serialize()",
        afterTitle: "Kafka 字节边界",
        after: [["keyBytes", "75 73 65 72 2D 39..."], ["valueBytes", "7B 22 6F 72 64 65..."], ["headers", "原有 byte[]"]],
        bytes: ["7B", "22", "6F", "72", "64", "65", "72", "49", "64", "22", "3A", "22", "41", "31", "30", "32", "34", "22"],
        note: "Schema Registry 格式通常还会加入 magic byte 与 schema ID，便于消费者找到正确 Schema。"
      },
      runtime: { thread: "application thread", active: 1, pipeline: ["ProducerRecord", "Serializer", "SerializedRecord", "Partitioner"], detail: [["Key 大小", "9 bytes"], ["Value 大小", "约 64 bytes"], ["Header", "不二次序列化"]] },
      network: { active: false, message: "字节已经准备好，但仍未离开 Producer 进程。", next: "分区与 Batch 完成后，Sender 才会把它封装进请求。" },
      storage: { active: false, message: "当前字节只存在于 Producer 内存，不等于已经持久化。" },
      reliability: { phase: "before", message: "序列化失败会直接在客户端结束；Broker 不会看到消息，也不会生成 Offset。" },
      configs: [["key.serializer", "StringSerializer", "Key 的字节形式会直接参与默认分区计算。"], ["value.serializer", "JsonSerializer<OrderCreated>", "决定业务 Payload 的 wire format。"], ["max.request.size", "1 MiB", "客户端单个请求允许的最大尺寸。"], ["schema.registry.url", "https://schema.internal", "使用 Avro/Protobuf Serializer 时的 Schema 服务地址。"]]
    },
    {
      kicker: "STEP 05 · PARTITIONER",
      title: "Key 把 Event 路由到 Partition 1",
      summary: "显式 partition 为空，因此 Producer 对 keyBytes 做稳定哈希，并映射到三个分区之一。",
      zone: 1,
      form: "TopicPartition = orders.created-P1",
      input: "keyBytes + 3 个 Partition",
      action: "Murmur2 Hash + 取模",
      output: "Partition 1 · Leader Broker 2",
      memory: "Kafka 的顺序保证是分区内顺序；相同 Key 的意义是分区亲和性，不是唯一性。",
      code: {
        file: "BuiltInPartitioner.java",
        lines: [
          "if (partition != null) return partition;",
          "",
          "int hash = Utils.toPositive(Utils.murmur2(serializedKey));",
          "int partition = hash % cluster.partitionCountForTopic(topic);",
          "// 313426957 % 3 = 1"
        ],
        activeLine: 2,
        path: [["Explicit Partition", "为空，继续"], ["Serialized Key", "user-9527 bytes"], ["Murmur2", "313426957"], ["Modulo", "P1"]]
      },
      data: {
        beforeTitle: "待路由 Record",
        before: [["topic", "orders.created"], ["partition", "null"], ["keyBytes", "75 73 65 72..."]],
        operation: "hash % 3",
        afterTitle: "TopicPartition",
        after: [["topic", "orders.created"], ["partition", "1"], ["leader", "Broker 2"]],
        note: "Topic 扩容会改变取模结果，相同 Key 可能迁移到新分区，这是顺序设计的重要风险。"
      },
      runtime: { thread: "application thread", active: 2, pipeline: ["SerializedRecord", "Partitioner", "TopicPartition", "RecordAccumulator"], detail: [["算法", "Murmur2"], ["正数 Hash", "313426957"], ["结果", "P1"]] },
      network: { active: false, message: "这里只决定目标，仍没有发送网络请求。" },
      storage: { active: false, message: "P1 只是逻辑目标；Offset 要等 Leader 真正追加时才产生。" },
      reliability: { phase: "before", message: "Producer 会根据元数据选择 P1 的当前 Leader。如果 Leader 已变化，发送后会刷新元数据并重试。" },
      configs: [["partitioner.class", "Kafka 内置逻辑", "可替换，但必须处理可用分区和负载倾斜。"], ["partitioner.ignore.keys", "false", "开启后内置逻辑可能忽略 Key 的分区亲和性。"], ["partition", "null", "ProducerRecord 显式分区优先于 Partitioner。"]]
    },
    {
      kicker: "STEP 06 · RECORD ACCUMULATOR",
      title: "Event 进入 P1 的 RecordBatch",
      summary: "Producer 按 TopicPartition 维护 Batch 队列，多个小 Record 在发送前被合并和压缩。",
      zone: 1,
      form: "RecordBatch · orders.created-P1",
      input: "SerializedRecord(P1)",
      action: "追加 Batch + 压缩",
      output: "ready ProducerBatch",
      memory: "高吞吐来自按分区批处理；compression.type 也是以 RecordBatch 为粒度生效。",
      code: {
        file: "RecordAccumulator.java",
        lines: [
          "RecordAppendResult result = accumulator.append(",
          "    record.topic(), partition, timestamp,",
          "    serializedKey, serializedValue, headers,",
          "    appendCallbacks, remainingWaitMs, nowMs, cluster);",
          "sender.wakeup();"
        ],
        activeLine: 0,
        path: [["BufferPool", "申请 ByteBuffer"], ["TopicPartition Deque", "定位 P1 队列"], ["ProducerBatch", "追加 #A1024"], ["Ready Check", "full / linger / closed"]]
      },
      data: {
        beforeTitle: "单条 SerializedRecord",
        before: [["partition", "P1"], ["size", "约 168 bytes"], ["record", "#A1024"]],
        operation: "append + compress",
        afterTitle: "RecordBatch",
        after: [["topicPartition", "orders.created-P1"], ["records", "#A1022 / #A1023 / #A1024"], ["compression", "zstd"]],
        note: "batch.size 是目标上限，不是必须填满才发送；linger 到期或其他条件也会触发发送。"
      },
      runtime: { thread: "application thread → sender thread", active: 2, pipeline: ["BufferPool", "P1 Deque", "ProducerBatch", "Sender Ready"], detail: [["Buffer", "buffer.memory"], ["Batch", "per TopicPartition"], ["触发", "size / linger"]] },
      network: { active: false, message: "Batch 仍在客户端缓冲区；Sender 尚未把它写入 Socket。" },
      storage: { active: false, message: "Producer Batch 与 Broker Log Segment 是不同层次的结构。" },
      reliability: { phase: "before", message: "在 Batch 尚未发出时进程崩溃，缓冲区中的消息会丢失；send() 返回并不等于 Broker 已确认。" },
      configs: [["batch.size", "16 KiB", "单个 TopicPartition Batch 的目标大小。"], ["linger.ms", "5 ms", "短暂等待更多 Record，提高批量度。"], ["compression.type", "zstd", "以 Batch 为单位压缩，权衡 CPU 与网络。"], ["buffer.memory", "32 MiB", "Producer 暂存待发送数据的总内存近似上限。"], ["delivery.timeout.ms", "120s", "从 send 到最终成功或失败的总交付时间上限。"]]
    },
    {
      kicker: "STEP 07 · SENDER",
      title: "Sender 构造 ProduceRequest",
      summary: "Sender 线程取出 ready Batch，并按照目标 Leader Broker 重新分组。",
      zone: 2,
      form: "ProduceRequest · correlationId=1842",
      input: "ready Batch(P1)",
      action: "按 Broker 2 聚合请求",
      output: "ClientRequest",
      memory: "RecordAccumulator 解决按分区聚合，Sender 则解决按目标 Broker 发送。",
      code: {
        file: "Sender.java",
        lines: [
          "long pollTimeout = sendProducerData(currentTimeMs);",
          "client.poll(pollTimeout, currentTimeMs);",
          "",
          "Map<Integer, List<ProducerBatch>> batches = accumulator.drain(...);",
          "ClientRequest clientRequest = client.newClientRequest(nodeId, requestBuilder, ...);",
          "client.send(clientRequest, now);"
        ],
        activeLine: 3,
        path: [["Sender.run", "I/O 主循环"], ["accumulator.drain", "取走 ready Batch"], ["ProduceRequest.Builder", "组织 Topic/Partition 数据"], ["NetworkClient.send", "进入连接层"]]
      },
      data: {
        beforeTitle: "ProducerBatch",
        before: [["topicPartition", "orders.created-P1"], ["leader", "Broker 2"], ["records", "3"]],
        operation: "build request",
        afterTitle: "ProduceRequest",
        after: [["correlationId", "1842"], ["target", "node 2"], ["acks", "all"], ["payload", "TopicData → PartitionData → Batch"]],
        note: "一个 ProduceRequest 可以携带发往同一 Broker 的多个 TopicPartition Batch。"
      },
      runtime: { thread: "kafka-producer-network-thread | order-service", active: 2, pipeline: ["Sender Loop", "Drain Batches", "InFlightRequests", "Selector"], detail: [["目标", "Broker 2"], ["请求", "ProduceRequest"], ["Correlation ID", "1842"]] },
      network: { active: true, index: 1, title: "ProduceRequest 正在进入 NetworkClient", packet: [["API Key", "Produce"], ["Correlation", "1842"], ["acks", "all"], ["Payload", "P1 RecordBatch"]] },
      storage: { active: false, message: "请求已经生成，但 Broker 还没有追加日志。" },
      reliability: { phase: "sending", message: "Batch 会进入 in-flight 状态；可重试错误受 retries 与 delivery.timeout.ms 共同约束。" },
      configs: [["request.timeout.ms", "30s", "等待 Broker 响应的最长时间。"], ["max.in.flight.requests.per.connection", "5", "单连接未响应请求上限，与顺序和幂等性相关。"], ["retries", "由交付超时约束", "可重试错误会在总交付窗口内再次发送。"]]
    },
    {
      kicker: "STEP 08 · TCP / TLS / PROTOCOL",
      title: "Request 穿过网络边界",
      summary: "Kafka Protocol 帧经 TCP 连接发送；生产环境还可能经过 TLS 加密和 SASL 身份认证。",
      zone: 2,
      form: "Kafka Protocol Frame",
      input: "ClientRequest",
      action: "编码协议帧并写入 Socket",
      output: "Broker 2 收到网络字节",
      memory: "Kafka 是应用层协议；TCP 保证字节流传输，但 Kafka 自己负责请求编号、错误码和重试语义。",
      code: {
        file: "NetworkClient.java",
        lines: [
          "doSend(clientRequest, isInternalRequest, now, builder.build(version));",
          "selector.send(new NetworkSend(destination, send));",
          "",
          "// RequestHeader(apiKey, apiVersion, clientId, correlationId)",
          "// RequestBody(topicData, partitionData, records)"
        ],
        activeLine: 1,
        path: [["Kafka Protocol", "Header + Body"], ["SASL", "可选身份认证"], ["TLS", "可选加密"], ["TCP Socket", "发送至 Broker 2:9092"]]
      },
      data: {
        beforeTitle: "ClientRequest",
        before: [["对象", "Java request object"], ["correlationId", "1842"], ["target", "Broker 2"]],
        operation: "encode frame",
        afterTitle: "Network Bytes",
        after: [["size prefix", "4 bytes"], ["request header", "API/version/client/correlation"], ["request body", "Topic/Partition/RecordBatch"]],
        note: "Correlation ID 用来把异步返回的 Response 与原始 Request 对应起来。"
      },
      runtime: { thread: "kafka-producer-network-thread", active: 3, pipeline: ["NetworkClient", "InFlightRequests", "Selector", "Socket Channel"], detail: [["连接", "Broker 2"], ["传输", "TCP"], ["安全", "TLS/SASL 可选"]] },
      network: { active: true, index: 2, title: "ProduceRequest 正在 TCP/TLS 通道中", packet: [["Length", "4-byte prefix"], ["Header", "API=Produce vN"], ["Correlation", "1842"], ["Body", "orders.created-P1 Batch"]] },
      storage: { active: false, message: "网络成功只说明 Broker 收到字节，不代表日志已经追加或副本已同步。" },
      reliability: { phase: "sending", message: "连接断开、认证失败、超时和限流都可能在这里返回错误或触发重试。" },
      configs: [["security.protocol", "SASL_SSL", "组合传输加密与身份认证。"], ["socket.connection.setup.timeout.ms", "10s", "建立连接允许的初始超时时间。"], ["connections.max.idle.ms", "9m", "空闲连接关闭阈值。"], ["client.dns.lookup", "use_all_dns_ips", "控制 bootstrap 主机的 DNS 地址使用方式。"]]
    },
    {
      kicker: "STEP 09 · BROKER REQUEST PATH",
      title: "Broker 接收并分派 ProduceRequest",
      summary: "Network Thread 只负责收发，真正的请求处理交给 Request Handler 线程池。",
      zone: 3,
      form: "RequestChannel.Request",
      input: "Broker Socket 字节",
      action: "解析、排队、分派",
      output: "KafkaApis.handleProduceRequest",
      memory: "网络线程和请求处理线程分离，避免业务处理阻塞所有 Socket I/O。",
      code: {
        file: "KafkaApis.scala",
        lines: [
          "override def handle(request: RequestChannel.Request): Unit = {",
          "  request.header.apiKey match {",
          "    case ApiKeys.PRODUCE => handleProduceRequest(request)",
          "    case ApiKeys.FETCH   => handleFetchRequest(request)",
          "    ...",
          "  }",
          "}"
        ],
        activeLine: 2,
        path: [["SocketServer", "Network Thread 读取"], ["RequestChannel", "请求进入队列"], ["KafkaRequestHandler", "线程池取出"], ["KafkaApis", "按 API Key 分派"]]
      },
      data: {
        beforeTitle: "Network Frame",
        before: [["apiKey", "Produce"], ["correlationId", "1842"], ["bytes", "encoded"]],
        operation: "parse + dispatch",
        afterTitle: "ProduceRequest Object",
        after: [["topic", "orders.created"], ["partition", "1"], ["records", "RecordBatch"], ["requiredAcks", "all"]],
        note: "Broker 会在此附近执行权限、配额、协议版本和请求合法性检查。"
      },
      runtime: { thread: "kafka-network-thread → kafka-request-handler", active: 2, pipeline: ["Acceptor/Processor", "RequestChannel", "RequestHandler", "KafkaApis"], detail: [["I/O", "Network Thread"], ["队列", "RequestChannel"], ["执行", "Request Handler"]] },
      network: { active: true, index: 3, title: "请求已经到达 Broker SocketServer", packet: [["API", "Produce"], ["Client", "order-service"], ["Correlation", "1842"], ["State", "queued for handler"]] },
      storage: { active: false, message: "请求已进入 Broker，但还没调用 Leader Log 的 append。" },
      reliability: { phase: "broker", message: "权限拒绝、配额限流、非法 Record 或非 Leader 错误可能在追加前结束请求。" },
      configs: [["num.network.threads", "3", "处理网络收发的线程数量。"], ["num.io.threads", "8", "处理请求与磁盘相关工作的线程数量。"], ["queued.max.requests", "500", "Network Thread 阻塞前允许排队的请求数。"], ["request.timeout.ms", "client side", "客户端等待本次处理完成的时间边界。"]]
    },
    {
      kicker: "STEP 10 · LEADER APPEND",
      title: "Leader 为 Event 分配 Offset 42",
      summary: "Broker 2 是 P1 的 Leader，它验证 RecordBatch 并按顺序追加，同时分配连续 Offset。",
      zone: 3,
      form: "RecordBatch · baseOffset=42",
      input: "ProduceRequest(P1 Batch)",
      action: "appendAsLeader + 分配 Offset",
      output: "Leader Log 拥有 offset 42",
      memory: "Offset 由 Partition Leader 在追加时产生，不由 Producer 或 Consumer 预先决定。",
      code: {
        file: "UnifiedLog.scala",
        lines: [
          "def appendAsLeader(records: MemoryRecords, leaderEpoch: Int, ...): LogAppendInfo = {",
          "  val appendInfo = analyzeAndValidateRecords(records, origin, ...)",
          "  val offset = localLog.logEndOffset",
          "  records.setPartitionLeaderEpoch(leaderEpoch)",
          "  localLog.append(appendInfo.lastOffset, appendInfo.maxTimestamp, records)",
          "  appendInfo",
          "}"
        ],
        activeLine: 4,
        path: [["ReplicaManager", "确认本机为 P1 Leader"], ["UnifiedLog", "校验 Batch"], ["LogEndOffset", "分配 offset 42"], ["LocalLog.append", "顺序追加"]]
      },
      data: {
        beforeTitle: "客户端 RecordBatch",
        before: [["baseOffset", "-1 / unknown"], ["partition", "P1"], ["records", "3"]],
        operation: "appendAsLeader",
        afterTitle: "Leader RecordBatch",
        after: [["baseOffset", "40"], ["#A1024 offset", "42"], ["leaderEpoch", "7"], ["CRC", "validated"]],
        note: "RecordBatch 还携带 attributes、时间戳、Producer ID、Epoch 和 Sequence 等元数据。"
      },
      runtime: { thread: "kafka-request-handler", active: 2, pipeline: ["KafkaApis", "ReplicaManager", "UnifiedLog", "LocalLog"], detail: [["Partition", "orders.created-1"], ["LEO before", "40"], ["LEO after", "43"]] },
      network: { active: true, index: 4, title: "ProduceRequest 已离开网络层，等待 Broker 生成 Response", packet: [["Correlation", "1842"], ["Partition", "P1"], ["State", "processing"], ["Response", "not ready"]] },
      storage: { active: true, phase: "append", message: "RecordBatch 正在通过 Page Cache 追加到 active .log segment。" },
      reliability: { phase: "leader", message: "Leader 已有 offset 42，但 acks=all 还不能返回；需要 ISR 副本追上确认位置。" },
      configs: [["message.max.bytes", "Broker/Topic limit", "Broker 接受的最大 RecordBatch 尺寸。"], ["log.message.timestamp.type", "CreateTime", "决定保留 Producer 时间还是使用 Broker 追加时间。"], ["unclean.leader.election.enable", "false", "影响故障恢复时是否允许非 ISR 副本成为 Leader。"]]
    },
    {
      kicker: "STEP 11 · PAGE CACHE & LOG SEGMENT",
      title: "字节进入 Page Cache 与日志文件",
      summary: "Kafka 依赖顺序追加和操作系统 Page Cache；Offset 索引与时间索引用于快速定位。",
      zone: 4,
      form: "Log Record · file position known",
      input: "Leader RecordBatch(offset 42)",
      action: "写 Page Cache + 更新稀疏索引",
      output: ".log / .index / .timeindex",
      memory: "Kafka 的 ACK 语义不能简单理解为“每条消息都 fsync 一次”。Page Cache 是核心路径的一部分。",
      code: {
        file: "LocalLog.scala",
        lines: [
          "val segment = localLog.segments.activeSegment",
          "segment.append(largestOffset, largestTimestamp, shallowOffsetOfMaxTimestamp, records)",
          "",
          "log.append(records)       // .log",
          "offsetIndex.append(...)   // .index",
          "timeIndex.maybeAppend(...)// .timeindex"
        ],
        activeLine: 1,
        path: [["Active Segment", "选择当前段"], ["FileRecords", "追加 .log"], ["OffsetIndex", "offset → position"], ["TimeIndex", "timestamp → offset"]]
      },
      data: {
        beforeTitle: "RecordBatch",
        before: [["offset", "42"], ["bytes", "compressed batch"], ["position", "unknown"]],
        operation: "append + index",
        afterTitle: "Segment 中的 Record",
        after: [["file", "000...000.log"], ["position", "byte position 8192+"], ["offset index", "42 → relative position"], ["time index", "timestamp → 42"]],
        note: "索引是稀疏的，不会为每条 Record 都保存一个索引项。"
      },
      runtime: { thread: "kafka-request-handler + OS kernel", active: 2, pipeline: ["Kafka Heap", "FileChannel", "OS Page Cache", "Disk / Flush"], detail: [["写入模式", "sequential append"], ["缓存", "Page Cache"], ["索引", "sparse"]] },
      network: { active: false, message: "当前关键动作发生在 Broker 本地存储路径；Producer 仍在等待响应。" },
      storage: { active: true, phase: "files", message: "#A1024 位于 orders.created-1 的 active segment，offset=42。" },
      reliability: { phase: "leader", message: "本地追加完成不等于整个 ISR 已复制。下一步由 Follower 主动 Fetch。" },
      configs: [["log.segment.bytes", "1 GiB", "Segment 达到大小后滚动。"], ["log.segment.ms", "cluster policy", "即使未满也可按时间滚动。"], ["cleanup.policy", "delete / compact", "决定按保留策略删除还是按 Key 压缩。"], ["log.retention.ms", "7 days (example)", "delete 策略的时间保留窗口。"]]
    },
    {
      kicker: "STEP 12 · REPLICATION",
      title: "Follower 拉取 offset 42",
      summary: "Broker 1 和 Broker 3 的 Follower Replica Fetcher 主动向 Broker 2 Leader 请求新数据。",
      zone: 5,
      form: "P1 replicas all contain offset 42",
      input: "Leader LEO=43",
      action: "Follower Fetch + 本地追加",
      output: "ISR 副本追上",
      memory: "Kafka 复制是 Follower 拉取，不是 Leader 主动把消息推送到每个副本。",
      code: {
        file: "ReplicaFetcherThread.scala",
        lines: [
          "val fetchRequest = buildFetchRequest(partitions)",
          "val response = leader.fetch(fetchRequest)",
          "",
          "processPartitionData(topicPartition, fetchOffset, partitionData)",
          "localLog.appendAsFollower(records)",
          "partition.updateFollowerFetchState(followerId, fetchState)"
        ],
        activeLine: 4,
        path: [["ReplicaFetcherThread", "Follower 构造 Fetch"], ["Leader P1", "返回 offset 42"], ["Follower LocalLog", "顺序追加"], ["Fetch State", "上报最新位置"]]
      },
      data: {
        beforeTitle: "副本位置",
        before: [["Leader B2 LEO", "43"], ["Follower B1 LEO", "42"], ["Follower B3 LEO", "42"]],
        operation: "replica fetch",
        afterTitle: "副本位置",
        after: [["Leader B2 LEO", "43"], ["Follower B1 LEO", "43"], ["Follower B3 LEO", "43"], ["ISR", "[2,1,3]"]],
        note: "落后时间或数据量超过阈值的副本可能被移出 ISR。"
      },
      runtime: { thread: "ReplicaFetcherThread on Broker 1/3", active: 2, pipeline: ["Follower Fetcher", "FetchRequest", "Leader Read", "Follower Append"], detail: [["方向", "Follower → Leader"], ["Partition", "P1"], ["复制到", "B1 / B3"]] },
      network: { active: true, index: 2, title: "Broker 间 Replica FetchRequest / FetchResponse", packet: [["API", "Fetch"], ["Source", "Follower B1/B3"], ["Target", "Leader B2"], ["Offset", "42"]] },
      storage: { active: true, phase: "replicas", message: "同一 RecordBatch 被追加到 Broker 1 与 Broker 3 的 P1 Follower 日志。" },
      reliability: { phase: "replicating", message: "ISR [2,1,3] 已全部拥有 offset 42，High Watermark 可以推进到 43。" },
      configs: [["replication.factor", "3", "P1 一共有三份副本。"], ["replica.lag.time.max.ms", "30s", "Follower 长时间未追上时可能移出 ISR。"], ["num.replica.fetchers", "1", "每个 Broker 从源 Broker 拉取副本数据的 Fetcher 数量。"]]
    },
    {
      kicker: "STEP 13 · ACK",
      title: "acks=all 条件满足，响应 Producer",
      summary: "ISR 复制进度满足要求后，Broker 返回 ProduceResponse，Future<RecordMetadata> 完成。",
      zone: 5,
      form: "RecordMetadata(topic=P1, offset=42)",
      input: "HW=43 · ISR=[2,1,3]",
      action: "完成延迟请求并返回 ACK",
      output: "Producer Future success",
      memory: "acks=all 与 min.insync.replicas 必须一起理解；一个定义等待，一个定义最低可写副本数。",
      code: {
        file: "Sender.java / ProduceResponse",
        lines: [
          "ProduceResponse.PartitionResponse response = ...;",
          "if (response.error == Errors.NONE) {",
          "  completeBatch(batch, response);",
          "  callback.onCompletion(new RecordMetadata(",
          "      topicPartition, baseOffset, batchIndex, timestamp, ...), null);",
          "}"
        ],
        activeLine: 2,
        path: [["DelayedProduce", "等待 requiredAcks"], ["ProduceResponse", "error=NONE"], ["NetworkClient", "匹配 correlationId"], ["Future/Callback", "返回 offset 42"]]
      },
      data: {
        beforeTitle: "Broker 状态",
        before: [["ISR", "[2,1,3]"], ["HW", "43"], ["correlationId", "1842"]],
        operation: "ProduceResponse",
        afterTitle: "RecordMetadata",
        after: [["topic", "orders.created"], ["partition", "1"], ["offset", "42"], ["error", "NONE"]],
        note: "成功返回表明满足配置的确认条件，但业务仍需决定如何处理 Callback 失败、超时和重试。"
      },
      runtime: { thread: "kafka-producer-network-thread", active: 2, pipeline: ["Socket Read", "Correlation Match", "Complete Batch", "Callback/Future"], detail: [["Correlation", "1842"], ["Result", "success"], ["Offset", "42"]] },
      network: { active: true, index: 1, title: "ProduceResponse 从 Broker 2 返回 Producer", packet: [["Correlation", "1842"], ["Error", "NONE"], ["Partition", "P1"], ["BaseOffset", "42"]] },
      storage: { active: true, phase: "stable", message: "Leader 与 ISR Follower 都已包含 offset 42；消息等待 Consumer 拉取。" },
      reliability: { phase: "acked", message: "acks=all、min.insync.replicas=2、ISR=3，当前写入满足成功条件。幂等 Producer 还会用 PID/Epoch/Sequence 抑制重试重复。" },
      configs: [["acks", "all", "等待所有当前 ISR 副本满足确认条件。"], ["min.insync.replicas", "2", "ISR 少于 2 时拒绝 acks=all 写入。"], ["enable.idempotence", "true", "通过 PID、Epoch 与 Sequence 抑制重试重复。"], ["delivery.timeout.ms", "120s", "超出总交付时间后客户端最终失败。"]]
    },
    {
      kicker: "STEP 14 · CONSUMER FETCH",
      title: "Consumer 从 P1 拉取 offset 42",
      summary: "Consumer Group 中被分配 P1 的 C2，依据当前位置发送 FetchRequest。",
      zone: 6,
      form: "FetchResponse · compressed RecordBatch",
      input: "fetch position = 42",
      action: "FetchRequest / FetchResponse",
      output: "Consumer 本地拥有 Batch",
      memory: "Consumer 是主动拉取；Partition assignment 决定组内哪个 Consumer 可以读取 P1。",
      code: {
        file: "KafkaConsumer.java",
        lines: [
          "ConsumerRecords<String, OrderCreated> records = consumer.poll(Duration.ofMillis(500));",
          "",
          "// Fetcher sends FetchRequest for assigned partitions",
          "// orders.created-P1 fetchOffset = 42",
          "for (ConsumerRecord<String, OrderCreated> record : records) { ... }"
        ],
        activeLine: 0,
        path: [["SubscriptionState", "C2 assigned P1"], ["Fetch Position", "42"], ["FetchRequest", "请求 Leader B2"], ["CompletedFetch", "缓存返回 Batch"]]
      },
      data: {
        beforeTitle: "Consumer Position",
        before: [["group", "order-risk-service"], ["member", "C2"], ["partition", "P1"], ["position", "42"]],
        operation: "fetch",
        afterTitle: "CompletedFetch",
        after: [["batch", "contains offset 42"], ["compression", "zstd"], ["bytes", "key/value/headers"]],
        note: "Fetch Position、已返回给应用的位置和 Committed Offset 是三个相关但不同的概念。"
      },
      runtime: { thread: "consumer application thread + network client", active: 2, pipeline: ["poll()", "ConsumerNetworkClient", "Fetcher", "CompletedFetch Queue"], detail: [["Assignment", "P1 → C2"], ["Fetch offset", "42"], ["数据", "RecordBatch"]] },
      network: { active: true, index: 2, title: "Consumer FetchRequest 从 C2 发往 P1 Leader", packet: [["API", "Fetch"], ["Group", "order-risk-service"], ["Partition", "P1"], ["Fetch Offset", "42"]] },
      storage: { active: true, phase: "read", message: "Leader 根据 offset 索引定位 Segment 文件位置，并从 Page Cache 或磁盘读取。" },
      reliability: { phase: "consumer", message: "Consumer 通常只能读取到 High Watermark 之前的数据；事务场景还受 isolation.level 影响。" },
      configs: [["fetch.min.bytes", "1", "Broker 满足最小返回字节数后响应。"], ["fetch.max.wait.ms", "500ms", "未达到最小字节数时允许等待的上限。"], ["max.partition.fetch.bytes", "1 MiB", "每个 Partition 每次 Fetch 的近似上限。"], ["isolation.level", "read_committed", "事务场景只返回已提交记录。"]]
    },
    {
      kicker: "STEP 15 · DESERIALIZE & POLL",
      title: "字节重新变回 OrderCreated",
      summary: "Consumer 校验、解压 RecordBatch，再分别反序列化 Key 与 Value，Headers 保持 byte[]。",
      zone: 6,
      form: "ConsumerRecord<String, OrderCreated>",
      input: "RecordBatch bytes",
      action: "解压 + 反序列化 + poll",
      output: "业务可处理的 ConsumerRecord",
      memory: "poll() 返回数据不等于业务处理成功；Offset 提交边界必须跟处理语义匹配。",
      code: {
        file: "CompletedFetch.java",
        lines: [
          "K key = keyDeserializer.deserialize(topic, headers, keyBytes);",
          "V value = valueDeserializer.deserialize(topic, headers, valueBytes);",
          "",
          "return new ConsumerRecord<>(topic, partition, offset, timestamp,",
          "    timestampType, serializedKeySize, serializedValueSize,",
          "    key, value, headers, leaderEpoch);"
        ],
        activeLine: 0,
        path: [["CRC / Batch", "校验并解压"], ["KeyDeserializer", "bytes → String"], ["ValueDeserializer", "bytes → OrderCreated"], ["ConsumerRecord", "携带 offset 与 headers"]]
      },
      data: {
        beforeTitle: "Kafka Bytes",
        before: [["keyBytes", "75 73 65 72..."], ["valueBytes", "7B 22 6F 72..."], ["headers", "String + byte[]"]],
        operation: "deserialize()",
        afterTitle: "ConsumerRecord<K,V>",
        after: [["key", "user-9527"], ["value", "OrderCreated{A1024,99.80}"], ["partition", "1"], ["offset", "42"], ["headers", "3 entries"]],
        note: "Consumer 使用的 Deserializer 与 Producer wire format 必须兼容，Schema 演进尤其重要。"
      },
      runtime: { thread: "consumer application thread", active: 2, pipeline: ["CompletedFetch", "Decompress", "Deserializer", "ConsumerRecords"], detail: [["Key", "String"], ["Value", "OrderCreated"], ["Offset", "42"]] },
      network: { active: false, message: "FetchResponse 已经到达，本步主要发生在 Consumer 进程内部。" },
      storage: { active: false, message: "Broker 数据已经读取完成；Consumer 现在操作的是本地内存中的返回数据。" },
      reliability: { phase: "consumer", message: "反序列化异常可能导致毒消息循环，需要错误处理、重试或 DLT 策略。" },
      configs: [["key.deserializer", "StringDeserializer", "恢复与 Producer Key Serializer 对应的类型。"], ["value.deserializer", "JsonDeserializer<OrderCreated>", "恢复业务对象并处理兼容性。"], ["max.poll.records", "500", "一次 poll 返回给应用的最大 Record 数。"], ["max.poll.interval.ms", "5m", "业务处理两次 poll 之间允许的最长时间。"]]
    },
    {
      kicker: "STEP 16 · OFFSET COMMIT",
      title: "处理成功后提交 offset 43",
      summary: "应用处理完 offset 42 后，提交的是下一条要读取的位置 43。",
      zone: 6,
      form: "Committed Offset · P1 → 43",
      input: "ConsumerRecord offset=42 已处理",
      action: "commitSync / commitAsync",
      output: "__consumer_offsets 保存 43",
      memory: "提交 43 而不是 42：Committed Offset 表示下次从哪里继续，而不是最后处理的是哪条。",
      code: {
        file: "OrderRiskConsumer.java",
        lines: [
          "for (ConsumerRecord<String, OrderCreated> record : records) {",
          "  riskService.evaluate(record.value());",
          "}",
          "",
          "consumer.commitSync(Map.of(",
          "    new TopicPartition(\"orders.created\", 1),",
          "    new OffsetAndMetadata(43L)));"
        ],
        activeLine: 4,
        path: [["Business Handler", "成功处理 offset 42"], ["OffsetAndMetadata", "next offset = 43"], ["Group Coordinator", "接收 OffsetCommit"], ["__consumer_offsets", "持久保存组进度"]]
      },
      data: {
        beforeTitle: "处理状态",
        before: [["record offset", "42"], ["business result", "SUCCESS"], ["committed offset", "42 / previous"]],
        operation: "commit next offset",
        afterTitle: "Group Progress",
        after: [["group", "order-risk-service"], ["topicPartition", "orders.created-P1"], ["committed offset", "43"]],
        note: "提交过早可能丢业务处理，提交过晚可能重复处理；At-least-once 需要业务幂等。"
      },
      runtime: { thread: "consumer application thread", active: 2, pipeline: ["Business Handler", "Offset Map", "Group Coordinator", "Commit Callback"], detail: [["Processed", "42"], ["Commit", "43"], ["Semantics", "at-least-once"]] },
      network: { active: true, index: 2, title: "OffsetCommitRequest 发往 Group Coordinator", packet: [["API", "OffsetCommit"], ["Group", "order-risk-service"], ["Partition", "P1"], ["Offset", "43"]] },
      storage: { active: true, phase: "offset", message: "消费进度被写入 Kafka 内部 compacted Topic：__consumer_offsets。" },
      reliability: { phase: "done", message: "旅程完成。若 Consumer 在处理后、提交前崩溃，offset 42 会再次投递，因此业务处理应具备幂等性。" },
      configs: [["enable.auto.commit", "false", "让提交边界与业务处理成功保持一致。"], ["auto.offset.reset", "earliest / latest", "没有有效提交位置时从哪里开始。"], ["group.id", "order-risk-service", "提交进度所属的 Consumer Group。"], ["isolation.level", "read_committed", "决定事务记录的可见范围。"]]
    }
  ];

  const elements = {
    stepKicker: document.getElementById("step-kicker"),
    stepTitle: document.getElementById("step-title"),
    stepSummary: document.getElementById("step-summary"),
    stepSelect: document.getElementById("step-select"),
    zoneTrack: document.getElementById("zone-track"),
    lensList: document.getElementById("lens-list"),
    eventForm: document.getElementById("event-form"),
    currentLens: document.getElementById("current-lens"),
    lensDot: document.getElementById("lens-dot"),
    scene: document.getElementById("scene"),
    previous: document.getElementById("previous-step"),
    next: document.getElementById("next-step"),
    play: document.getElementById("play-step"),
    timeline: document.getElementById("timeline"),
    timelineLabel: document.getElementById("timeline-label"),
    timelineTotal: document.getElementById("timeline-total"),
    speed: document.getElementById("speed-select"),
    input: document.getElementById("input-state"),
    action: document.getElementById("action-state"),
    output: document.getElementById("output-state"),
    memory: document.getElementById("memory-note")
  };

  const state = {
    step: 0,
    lens: "global",
    speed: 1,
    playing: false,
    timer: null
  };

  const lensColors = {
    global: "#2563eb",
    code: "#8eb6ff",
    data: "#ffb547",
    runtime: "#7c5ce5",
    network: "#39b9d6",
    storage: "#d49b42",
    reliability: "#12a36f",
    config: "#f97316"
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderStepOptions() {
    elements.stepSelect.innerHTML = steps
      .map((step, index) => `<option value="${index}">${String(index + 1).padStart(2, "0")} · ${escapeHtml(step.title)}</option>`)
      .join("");
  }

  function renderZones() {
    const currentZone = steps[state.step].zone;
    elements.zoneTrack.innerHTML = zones
      .map((zone, index) => `
        <button
          class="zone-button ${index < currentZone ? "is-past" : ""}"
          type="button"
          data-zone="${index}"
          ${index === currentZone ? 'aria-current="step"' : ""}
          aria-label="跳到 ${escapeHtml(zone.name)} 阶段"
        >
          <span>${escapeHtml(zone.name)}</span>
        </button>`)
      .join("");

    elements.zoneTrack.querySelectorAll("[data-zone]").forEach((button) => {
      button.addEventListener("click", () => {
        stopPlayback();
        setStep(zones[Number(button.dataset.zone)].firstStep);
      });
    });
  }

  function renderLenses() {
    elements.lensList.innerHTML = lenses
      .map((lens) => `
        <button
          class="lens-button"
          type="button"
          role="tab"
          data-lens="${lens.id}"
          aria-selected="${String(lens.id === state.lens)}"
        >${escapeHtml(lens.label)}</button>`)
      .join("");

    elements.lensList.querySelectorAll("[data-lens]").forEach((button) => {
      button.addEventListener("click", () => {
        state.lens = button.dataset.lens;
        renderLenses();
        renderScene();
      });
    });
  }

  function renderGlobal(step) {
    const zoneDescriptions = ["业务对象", "序列化与批处理", "协议与连接", "请求处理", "Page Cache / 文件", "ISR 与确认", "拉取与提交"];
    return `
      <div class="scene-view world-scene">
        <div class="world-narrative">
          <div>
            <span class="scene-eyebrow">WHERE IS THE EVENT?</span>
            <h2 class="scene-title">Event 当前位于：${escapeHtml(zones[step.zone].name)}</h2>
            <p class="scene-subtitle">其他区域被自动淡化，让你始终知道 #A1024 在整条系统链路中的位置。</p>
          </div>
          <div class="event-badge"><i aria-hidden="true"></i>EVENT #A1024</div>
        </div>
        <div class="world-line">
          ${zones.map((zone, index) => `
            <div class="world-node ${index === step.zone ? "is-active" : "is-dimmed"}">
              <span>${String(index + 1).padStart(2, "0")}</span>
              <strong>${escapeHtml(zone.name)}</strong>
              <small>${escapeHtml(zoneDescriptions[index])}</small>
              ${index === step.zone ? `<span class="node-event">${escapeHtml(step.form)}</span>` : ""}
            </div>`).join("")}
        </div>
        <div class="world-caption">刚刚发生：<strong>${escapeHtml(step.action)}</strong> · 接下来沿时间线继续</div>
      </div>`;
  }

  function renderCode(step) {
    const codeLines = step.code.lines
      .map((line, index) => index === step.code.activeLine
        ? `<mark>${escapeHtml(line || " ")}</mark>`
        : escapeHtml(line || " "))
      .join("\n");
    return `
      <div class="scene-view code-scene">
        <div class="code-window">
          <div class="window-title"><span>${escapeHtml(step.code.file)}</span><i aria-hidden="true"></i></div>
          <pre>${codeLines}</pre>
        </div>
        <div class="call-path">
          <span class="scene-eyebrow">CALL PATH</span>
          ${step.code.path.map(([name, desc], index) => `
            <div class="path-item ${index === Math.min(step.code.path.length - 1, 2) ? "is-active" : ""}">
              <span>${escapeHtml(name)}</span><small>${escapeHtml(desc)}</small>
            </div>`).join("")}
        </div>
      </div>`;
  }

  function renderRows(rows) {
    return rows.map(([name, value]) => `<div class="data-row"><span>${escapeHtml(name)}</span><b>${escapeHtml(value)}</b></div>`).join("");
  }

  function renderData(step) {
    const bytes = step.data.bytes
      ? `<div class="byte-line">${step.data.bytes.map((byte) => `<i>${escapeHtml(byte)}</i>`).join("")}</div>`
      : "";
    return `
      <div class="scene-view data-scene">
        <div class="data-transform">
          <div class="data-state">
            <span>BEFORE</span><h3>${escapeHtml(step.data.beforeTitle)}</h3>
            <div class="data-rows">${renderRows(step.data.before)}</div>
          </div>
          <div class="data-operation"><div class="operation-symbol">→</div><strong>${escapeHtml(step.data.operation)}</strong></div>
          <div class="data-state is-after">
            <span>AFTER</span><h3>${escapeHtml(step.data.afterTitle)}</h3>
            <div class="data-rows">${renderRows(step.data.after)}</div>${bytes}
          </div>
        </div>
        <div class="data-footnote"><i aria-hidden="true"></i>${escapeHtml(step.data.note)}</div>
      </div>`;
  }

  function renderRuntime(step) {
    return `
      <div class="scene-view runtime-scene">
        <div class="runtime-canvas">
          <div class="runtime-thread"><span>当前线程</span><strong>${escapeHtml(step.runtime.thread)}</strong></div>
          <div class="runtime-pipeline">
            ${step.runtime.pipeline.map((item, index) => `
              <div class="runtime-box ${index === step.runtime.active ? "is-active" : ""}">
                <span>${String(index + 1).padStart(2, "0")}</span>
                <strong>${escapeHtml(item)}</strong>
                ${index === step.runtime.active ? `<code>#A1024 HERE</code>` : ""}
              </div>`).join("")}
          </div>
        </div>
        <div class="runtime-detail">
          <span class="scene-eyebrow">RUNTIME STATE</span>
          ${step.runtime.detail.map(([name, value], index) => `
            <div class="path-item ${index === 0 ? "is-active" : ""}"><span>${escapeHtml(name)}</span><small>${escapeHtml(value)}</small></div>`).join("")}
        </div>
      </div>`;
  }

  function renderInactive(label, data) {
    return `
      <div class="scene-view inactive-view">
        <div>
          <span class="scene-eyebrow">${escapeHtml(label)}</span>
          <strong>这个视角在当前步骤尚未激活</strong>
          <p>${escapeHtml(data.message)}</p>
          ${data.next ? `<code>${escapeHtml(data.next)}</code>` : ""}
        </div>
      </div>`;
  }

  function renderNetwork(step) {
    if (!step.network.active) return renderInactive("NETWORK VIEW", step.network);
    let route = ["Producer App", "NetworkClient", "TCP / TLS", "Broker Socket", "Request Handler"];
    if (step.reliability.phase === "replicating") {
      route = ["Follower Log", "Replica Fetcher", "Broker TCP", "Leader Socket", "Leader Log"];
    } else if (["consumer", "done"].includes(step.reliability.phase)) {
      route = ["Consumer App", "Consumer NetworkClient", "TCP / TLS", "Broker Socket", step.reliability.phase === "done" ? "Group Coordinator" : "Partition Leader"];
    }
    return `
      <div class="scene-view network-scene">
        <div>
          <span class="scene-eyebrow">NETWORK VIEW</span>
          <h2 class="scene-title">${escapeHtml(step.network.title)}</h2>
        </div>
        <div class="network-route">
          ${route.map((name, index) => `
            <div class="network-node ${index === step.network.index ? "is-active" : ""}">
              <span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(name)}</strong>
              ${index === step.network.index ? "<code>EVENT HERE</code>" : ""}
            </div>`).join("")}
        </div>
        <div class="packet-strip">
          ${step.network.packet.map(([name, value]) => `<div><span>${escapeHtml(name)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
        </div>
      </div>`;
  }

  function renderStorage(step) {
    if (!step.storage.active) return renderInactive("STORAGE VIEW", step.storage);
    if (step.storage.phase === "offset") {
      return `
        <div class="scene-view storage-scene">
          <div class="storage-canvas offset-storage">
            <div class="cache-layer"><span>Internal Topic</span><strong>__consumer_offsets</strong><span>cleanup.policy=compact</span></div>
            <div class="log-files">
              <div class="file-block is-active">
                <span>Group Metadata Record</span><strong>order-risk-service</strong>
                <div class="log-records"><i>40</i><i>41</i><i>42</i><i class="is-event">43</i></div>
              </div>
              <div class="file-block"><span>KEY</span><strong>group + topic + partition</strong><code>order-risk-service · orders.created · P1</code></div>
              <div class="file-block"><span>VALUE</span><strong>OffsetAndMetadata</strong><code>next offset = 43</code></div>
            </div>
          </div>
          <div class="storage-detail">
            <span class="scene-eyebrow">CONSUMER PROGRESS</span>
            <div class="path-item is-active"><span>__consumer_offsets</span><small>${escapeHtml(step.storage.message)}</small></div>
            <div class="path-item"><span>Compaction Key</span><small>同一 Group + TopicPartition 的新值覆盖旧进度语义</small></div>
          </div>
        </div>`;
    }
    const showEvent = ["append", "files", "stable", "read", "replicas"].includes(step.storage.phase);
    return `
      <div class="scene-view storage-scene">
        <div class="storage-canvas">
          <div class="cache-layer"><span>OS Memory</span><strong>Page Cache ${showEvent ? "· #A1024" : ""}</strong><span>顺序追加缓冲</span></div>
          <div class="log-files">
            <div class="file-block is-active">
              <span>00000000000000000000.log</span><strong>RecordBatch 数据</strong>
              <div class="log-records"><i>38</i><i>39</i><i>40</i><i>41</i><i class="is-event">42</i></div>
            </div>
            <div class="file-block"><span>.index</span><strong>offset → position</strong><code>42 → byte 8192+</code></div>
            <div class="file-block"><span>.timeindex</span><strong>time → offset</strong><code>13:00:00 → 42</code></div>
          </div>
        </div>
        <div class="storage-detail">
          <span class="scene-eyebrow">CURRENT STORAGE STATE</span>
          <div class="path-item is-active"><span>orders.created-1/</span><small>${escapeHtml(step.storage.message)}</small></div>
          <div class="path-item"><span>Active Segment</span><small>顺序追加，不按 Key 原地更新</small></div>
        </div>
      </div>`;
  }

  function reliabilityState(step) {
    const phase = step.reliability.phase;
    if (["leader", "replicating", "acked", "consumer", "done"].includes(phase)) {
      return {
        leader: phase === "leader" ? "LEO 43 · waiting replicas" : "LEO 43 · offset 42",
        follower: phase === "leader" ? "LEO 42 · lagging" : "LEO 43 · offset 42",
        synced: phase !== "leader",
        ack: phase === "acked" || phase === "consumer" || phase === "done"
      };
    }
    return null;
  }

  function renderReliability(step) {
    const status = reliabilityState(step);
    if (!status) return renderInactive("RELIABILITY VIEW", { message: step.reliability.message });
    return `
      <div class="scene-view reliability-scene">
        <div class="replica-stage">
          <div class="replica-broker"><span>Broker 1</span><strong>P1 Follower</strong><div class="replica-offset"><span>${escapeHtml(status.follower)}</span><b>${status.synced ? "✓" : "…"}</b></div><code>ISR member</code></div>
          <div class="replica-broker is-leader"><span>Broker 2</span><strong>P1 Leader</strong><div class="replica-offset"><span>${escapeHtml(status.leader)}</span><b>✓</b></div><code>assigns offset</code></div>
          <div class="replica-broker"><span>Broker 3</span><strong>P1 Follower</strong><div class="replica-offset"><span>${escapeHtml(status.follower)}</span><b>${status.synced ? "✓" : "…"}</b></div><code>ISR member</code></div>
        </div>
        <div class="reliability-detail">
          <span class="scene-eyebrow">WRITE GUARANTEE</span>
          <div class="condition-row"><span>ISR</span><strong>[2,1,3]</strong></div>
          <div class="condition-row"><span>High Watermark</span><strong>${status.synced ? "43" : "42 → 43"}</strong></div>
          <div class="condition-row"><span>Produce ACK</span><strong>${status.ack ? "SUCCESS" : "WAITING"}</strong></div>
          <div class="path-item is-active"><small>${escapeHtml(step.reliability.message)}</small></div>
        </div>
      </div>`;
  }

  function renderConfig(step) {
    return `
      <div class="scene-view config-scene">
        <div>
          <span class="scene-eyebrow">ONLY WHAT MATTERS NOW</span>
          <h2 class="scene-title">影响当前步骤的生产配置</h2>
          <p class="scene-subtitle">配置跟随 Event 所在位置出现，不再一次展示几百个参数。</p>
        </div>
        <div class="config-grid">
          ${step.configs.map(([name, value, help]) => `
            <div class="config-row">
              <div class="config-key"><code>${escapeHtml(name)}</code><strong>${escapeHtml(value)}</strong></div>
              <p>${escapeHtml(help)}</p>
            </div>`).join("")}
        </div>
      </div>`;
  }

  function renderScene() {
    const step = steps[state.step];
    const lens = lenses.find((item) => item.id === state.lens);
    elements.currentLens.textContent = `${lens.label}视角`;
    elements.lensDot.style.background = lensColors[state.lens];
    elements.lensDot.style.boxShadow = `0 0 0 5px ${lensColors[state.lens]}22`;

    const renderers = {
      global: renderGlobal,
      code: renderCode,
      data: renderData,
      runtime: renderRuntime,
      network: renderNetwork,
      storage: renderStorage,
      reliability: renderReliability,
      config: renderConfig
    };
    elements.scene.innerHTML = renderers[state.lens](step);
  }

  function renderStep() {
    const step = steps[state.step];
    elements.stepKicker.textContent = step.kicker;
    elements.stepTitle.textContent = step.title;
    elements.stepSummary.textContent = step.summary;
    elements.stepSelect.value = String(state.step);
    elements.eventForm.textContent = step.form;
    elements.input.textContent = step.input;
    elements.action.textContent = step.action;
    elements.output.textContent = step.output;
    elements.memory.textContent = step.memory;
    elements.timeline.max = String(steps.length - 1);
    elements.timeline.value = String(state.step);
    elements.timelineLabel.textContent = String(state.step + 1).padStart(2, "0");
    elements.timelineTotal.textContent = `/ ${steps.length}`;
    elements.previous.disabled = state.step === 0;
    elements.next.disabled = state.step === steps.length - 1;
    elements.play.classList.toggle("is-playing", state.playing);
    elements.play.setAttribute("aria-label", state.playing ? "暂停旅程" : "播放旅程");
    renderZones();
    renderScene();
  }

  function setStep(nextStep) {
    state.step = Math.max(0, Math.min(steps.length - 1, nextStep));
    renderStep();
    if (state.playing) scheduleNext();
  }

  function scheduleNext() {
    window.clearTimeout(state.timer);
    if (!state.playing) return;
    if (state.step >= steps.length - 1) {
      stopPlayback();
      return;
    }
    state.timer = window.setTimeout(() => setStep(state.step + 1), 3300 / state.speed);
  }

  function startPlayback() {
    if (state.step >= steps.length - 1) state.step = 0;
    state.playing = true;
    renderStep();
    scheduleNext();
  }

  function stopPlayback() {
    state.playing = false;
    window.clearTimeout(state.timer);
    elements.play.classList.remove("is-playing");
    elements.play.setAttribute("aria-label", "播放旅程");
  }

  elements.previous.addEventListener("click", () => {
    stopPlayback();
    setStep(state.step - 1);
  });

  elements.next.addEventListener("click", () => {
    stopPlayback();
    setStep(state.step + 1);
  });

  elements.play.addEventListener("click", () => {
    if (state.playing) stopPlayback();
    else startPlayback();
  });

  elements.timeline.addEventListener("input", (event) => {
    stopPlayback();
    setStep(Number(event.target.value));
  });

  elements.stepSelect.addEventListener("change", (event) => {
    stopPlayback();
    setStep(Number(event.target.value));
  });

  elements.speed.addEventListener("change", (event) => {
    state.speed = Number(event.target.value);
    if (state.playing) scheduleNext();
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
    if (event.key === "ArrowLeft") {
      stopPlayback();
      setStep(state.step - 1);
    } else if (event.key === "ArrowRight") {
      stopPlayback();
      setStep(state.step + 1);
    } else if (event.code === "Space") {
      event.preventDefault();
      if (state.playing) stopPlayback();
      else startPlayback();
    }
  });

  renderStepOptions();
  renderLenses();
  renderStep();
})();

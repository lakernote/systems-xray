(() => {
  "use strict";

  const SOURCE = "https://github.com/apache/kafka/tree/13f70256db3c994c590e5d262a7cc50b9e973204";
  const notes = [
    {
      summary: "整门课只追踪同一个 Event #A1024，从业务代码、Producer、网络、Broker、物理存储与副本，一直走到 Consumer Group、Rebalance、业务处理和 Offset Commit。每页固定回答一个问题。",
      config: [["消息", "#A1024"], ["Topic", "orders.created"], ["Key", "user-9527"], ["目标", "Partition 1"]],
      gain: "用一条主线把开发 API、协议、OS、存储、复制与消费语义连成因果链。", cost: "内容很深，因此必须按上一页/下一页逐步建立模型。", code: "OrderCreated → ProducerRecord\n→ ProducerBatch → ProduceRequest\n→ RecordBatch → ISR/HW\n→ ConsumerRecord → commit next offset", source: SOURCE
    },
    {
      summary: "这是数据面与控制面的完整高层地图：#A1024 从 order-service 直达 B1 上的 P1 Leader，复制到 B0/B2 的 P1 Follower；只有被分配 P1 的 C0 会 Fetch，处理后把下一 Offset 43 写入 __consumer_offsets。",
      config: [["Topic", "orders.created · 6P"], ["Replication", "RF=3 · minISR=2"], ["Brokers", "B0 / B1 / B2"], ["Group", "order-fulfillment · 3 members"]],
      gain: "一眼看出主路径、副本分布、消费所有权与恢复点。", cost: "这里只画组件边界；线程、协议和文件结构在后续逐页放大。", code: "order-service → B1/P1 Leader\n→ B0+B2/P1 Followers → C0(P1)\n→ commit 43", source: SOURCE
    },
    {
      summary: "ProducerRecord 是发送 API 的输入对象。topic 必填；partition、timestamp 可空；key/value 是泛型对象；headers 是可重复键的 byte[] 集合。它还没有 offset。",
      config: [["topic", "orders.created"], ["partition", "null · 自动选择"], ["timestamp", "null · Broker/Producer 补充"], ["headers", "traceparent, tenant-id"]],
      gain: "一个对象统一表达路由、载荷与上下文。", cost: "序列化与 schema 兼容性由应用负责。", code: "ProducerRecord<K,V>\n  topic, partition, timestamp\n  key, value, headers", source: `${SOURCE}/clients/src/main/java/org/apache/kafka/clients/producer/ProducerRecord.java`
    },
    {
      summary: "KafkaProducer.send() 在调用线程里完成拦截、序列化、分区选择和追加内存批次；后台 Sender 线程统一执行网络 I/O。send 返回的 Future 不代表 Broker 已确认。",
      config: [["buffer.memory", "33554432"], ["max.block.ms", "60000"], ["client.id", "order-producer-1"]],
      gain: "业务线程与网络延迟解耦，吞吐更高。", cost: "错误可能异步出现，关闭前必须 flush/close。", code: "KafkaProducer.send(record)\n  → doSend(record, callback)\n  → accumulator.append(...)\nSender.run() → NetworkClient", source: `${SOURCE}/clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java`
    },
    {
      summary: "ProducerInterceptor.onSend 在序列化和分区之前执行，适合补充 trace header、指标标签或轻量审计信息。异常通常会被记录，不应破坏主发送流程。",
      config: [["interceptor.classes", "TracingProducerInterceptor"], ["执行线程", "调用 send 的线程"], ["输入/输出", "ProducerRecord"]],
      gain: "把横切逻辑从业务代码中分离。", cost: "同步执行；慢操作会直接增加发送延迟。", code: "record = interceptors.onSend(record);\nserializedKey = keySerializer.serialize(...);", source: `${SOURCE}/clients/src/main/java/org/apache/kafka/clients/producer/internals/ProducerInterceptors.java`
    },
    {
      summary: "Kafka 协议只传字节。KeySerializer 与 ValueSerializer 分别把对象变成 byte[]；Headers 的 value 已经是 byte[]。序列化失败发生在客户端，记录不会进入批次。",
      config: [["key.serializer", "StringSerializer"], ["value.serializer", "Avro / Protobuf / JSON"], ["schema", "建议受版本治理"]],
      gain: "网络与 Broker 不依赖 Java 对象类型。", cost: "Producer 与 Consumer 必须共享兼容的数据契约。", code: "byte[] serializedKey = keySerializer.serialize(...);\nbyte[] serializedValue = valueSerializer.serialize(...);", source: `${SOURCE}/clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java`
    },
    {
      summary: "显式 partition 优先；否则有 key 时，默认逻辑对 serializedKey 做 murmur2 后模 Partition 数。user-9527 在 6 个分区中得到 P1。无 key 的默认策略会偏向黏住某个分区以改善批次。",
      config: [["Key", "user-9527"], ["Hash", "313426957"], ["Partition count", "6"], ["Result", "P1"]],
      gain: "相同 key 获得 Partition 内顺序。", cost: "热点 key 会造成分区倾斜；扩容分区会改变取模结果。", code: "Utils.toPositive(\n  Utils.murmur2(serializedKey)\n) % numPartitions // = 1", source: `${SOURCE}/clients/src/main/java/org/apache/kafka/clients/producer/internals/BuiltInPartitioner.java`
    },
    {
      summary: "RecordAccumulator 为每个 TopicPartition 维护 ProducerBatch 队列，并从 BufferPool 申请内存。batch.size 是上限目标，不是必须填满；linger.ms 允许短暂等待更多记录。",
      config: [["batch.size", "16384 bytes"], ["linger.ms", "5 ms（示例）"], ["buffer.memory", "32 MiB"], ["compression.type", "zstd"]],
      gain: "更少请求、更高压缩率、更高吞吐。", cost: "等待会增加少量延迟；缓冲耗尽可能阻塞。", code: "RecordAccumulator.append(\n  topicPartition, timestamp,\n  key, value, headers, callback\n)", source: `${SOURCE}/clients/src/main/java/org/apache/kafka/clients/producer/internals/RecordAccumulator.java`
    },
    {
      summary: "Sender 扫描 ready partitions，按 Leader Broker drain 批次，并把同一 Broker 的多个 Partition 数据组进 ProduceRequest。NetworkClient 管理在途请求、超时和重连。",
      config: [["acks", "all"], ["enable.idempotence", "true"], ["max.in.flight", "5"], ["delivery.timeout.ms", "120000"], ["request.timeout.ms", "30000"], ["retries", "MAX"]],
      gain: "跨 Partition 共享连接与请求，统一重试。", cost: "重试、超时与幂等配置组合不当会放大重复或乱序风险。", code: "Sender.runOnce()\n  → sendProducerData(now)\n  → accumulator.drain(...)\n  → sendProduceRequest(...) ", source: `${SOURCE}/clients/src/main/java/org/apache/kafka/clients/producer/internals/Sender.java`
    },
    {
      summary: "Producer 从 Metadata 缓存得知 P1 的 Leader 是 Broker 1，因此 ProduceRequest 直接发往 Broker 1。若返回 NOT_LEADER_OR_FOLLOWER，会刷新 Metadata 后重试。",
      config: [["bootstrap.servers", "broker0,broker1,broker2"], ["metadata.max.age.ms", "300000"], ["max.block.ms", "60000"], ["P1 Leader", "broker 1"]],
      gain: "客户端直达 Leader，不需要每条消息经过中心路由。", cost: "Leader 切换期间会有短暂刷新和重试。", code: "MetadataCache:\norders.created-1 → Node(1)\n\nProduceRequest → broker-1:9092", source: `${SOURCE}/clients/src/main/java/org/apache/kafka/clients/Metadata.java`
    },
    {
      summary: "ProduceRequest 编码后交给 KafkaChannel 与 Java NIO。若启用 SSL，TLS 在 JVM 用户态完成封装；随后 SocketChannel.write 进入内核 TCP send buffer，再经 TCP/IP 栈与网卡发送。",
      config: [["security.protocol", "PLAINTEXT / SSL / SASL_*"], ["send.buffer.bytes", "131072"], ["connections.max.idle.ms", "540000"]],
      gain: "非阻塞 I/O 可以用少量线程管理多个连接。", cost: "TCP、TLS、拥塞和跨机房网络都会引入尾延迟。", code: "NetworkClient.send(...)\n → KafkaChannel.write() / TLS\n → SocketChannel.write(buffer)\n → kernel TCP send buffer", source: `${SOURCE}/clients/src/main/java/org/apache/kafka/common/network/Selector.java`
    },
    {
      summary: "Broker 的 Acceptor 接受连接，Processor 网络线程读请求并放入 RequestChannel。KafkaRequestHandler 从队列取出请求，KafkaApis 再把 ProduceRequest 交给 ReplicaManager。",
      config: [["num.network.threads", "3"], ["num.io.threads", "8"], ["queued.max.requests", "500"]],
      gain: "网络线程和业务处理线程隔离，连接管理更稳定。", cost: "队列过深会隐藏拥塞并增加排队延迟。", code: "SocketServer.Processor\n → RequestChannel.sendRequest\n → KafkaRequestHandler.run\n → KafkaApis.handleProduceRequest", source: `${SOURCE}/core/src/main/scala/kafka/server/KafkaApis.scala`
    },
    {
      summary: "Topic 只是逻辑名称；每个 Partition 是独立的追加日志和复制单元。Partition 目录里按 baseOffset 切分多个 Segment；新记录只追加到 active segment。",
      config: [["num.partitions", "6"], ["segment.bytes", "1 GiB"], ["segment.ms", "7 days"], ["retention.ms", "7 days"]],
      gain: "Partition 支持并行，Segment 让滚动、清理和索引可控。", cost: "分区太多会增加文件、复制与选主开销。", code: "orders.created\n└─ orders.created-1/\n   ├─ segment(baseOffset=0)\n   ├─ segment(baseOffset=20)\n   └─ active(baseOffset=40)", source: `${SOURCE}/storage/src/main/java/org/apache/kafka/storage/internals/log/LocalLog.java`
    },
    {
      summary: ".log 保存 RecordBatch；.index 是 relative offset 到物理文件位置的稀疏索引；.timeindex 是时间到 offset 的稀疏索引；.txnindex 记录中止事务范围。它们共享相同 baseOffset 文件名。",
      config: [["index.interval.bytes", "4096"], ["segment.index.bytes", "10 MiB"], ["baseOffset", "40"], ["event offset", "42"]],
      gain: "小索引先缩小范围，再顺序扫描少量 .log。", cost: "索引不是每条一项，仍需局部扫描；文件组需要一起滚动。", code: "000...040.log\n000...040.index\n000...040.timeindex\n000...040.txnindex", source: `${SOURCE}/storage/src/main/java/org/apache/kafka/storage/internals/log/LogSegment.java`
    },
    {
      summary: "Broker 对 active .log 的 append 通常先修改 Linux Page Cache 中对应文件页，形成 dirty page；内核之后异步 writeback 到文件系统和 NVMe。热数据的 Consumer Fetch 也可能直接命中 Page Cache。",
      config: [["log.flush.interval.messages", "默认未强制逐条 flush"], ["acks", "all"], ["min.insync.replicas", "2（示例）"], ["OS cache", "由 Linux 管理"]],
      gain: "利用 RAM 与顺序 I/O 获得很高吞吐。", cost: "ACK 与物理介质落盘不是同一个时刻；可靠性依赖副本与故障模型。", code: "FileRecords.append(records)\n → FileChannel.write(...)\n → Linux Page Cache (dirty)\n → filesystem writeback → NVMe", source: `${SOURCE}/clients/src/main/java/org/apache/kafka/common/record/FileRecords.java`
    },
    {
      summary: "最终验收不要求背类名，而是能解释五个因果问题：为什么去 P1、offset 42 在哪里、何时能够 ACK、哪个 Group Member 消费、崩溃后为何从 committed offset 恢复。",
      config: [["路由", "Key + Metadata + Leader"], ["存储", "RecordBatch + Segment + Page Cache"], ["可靠", "ISR + HW + minISR + acks"], ["消费", "Group + Assignment + Fetch"], ["恢复", "Position + Commit + Retry + Lag"]],
      gain: "掌握可迁移的 Kafka 心智模型，而不是孤立配置清单。", cost: "任何生产选择仍需根据业务延迟、吞吐、可靠性与可用性目标权衡。", code: "#A1024\nobject → bytes → batch → log offset 42\n→ replicas/HW → fetch → object\n→ side effect → commit offset 43", source: SOURCE
    }
  ];

  const escapeHtml = value => String(value).replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  const existingSlides = [...document.querySelectorAll(".slide")];
  const noteBySlide = new Map(existingSlides.map((slide, index) => [slide, notes[index]]));

  function normalizeOriginalLessonOrder() {
    const route = existingSlides.find(slide => slide.dataset.section === "09 · METADATA & ROUTING");
    const sender = existingSlides.find(slide => slide.dataset.section === "08 · SENDER");
    if (route && sender) sender.before(route);
  }

  function normalizeAdvancedLessonOrder(items) {
    const ordered = [...items];
    const moveBefore = (section, targetSection) => {
      const from = ordered.findIndex(item => item.section === section);
      const target = ordered.findIndex(item => item.section === targetSection);
      if (from < 0 || target < 0 || from < target) return;
      const [item] = ordered.splice(from, 1);
      ordered.splice(ordered.findIndex(candidate => candidate.section === targetSection), 0, item);
    };
    moveBefore("29 · ASSIGNORS", "28A · AUTO OFFSET RESET");
    return ordered;
  }

  function renderAdvancedLessons() {
    normalizeOriginalLessonOrder();
    const sourceItems = Array.isArray(window.SYSTEMS_XRAY_ADVANCED_SLIDES) ? window.SYSTEMS_XRAY_ADVANCED_SLIDES : [];
    const additions = normalizeAdvancedLessonOrder(sourceItems);
    const anchors = new Map(existingSlides.map(slide => [slide.dataset.section, slide]));
    const tails = new Map();

    additions.forEach(item => {
      const anchor = tails.get(item.after) || anchors.get(item.after);
      if (!anchor) return;
      const article = document.createElement("article");
      const isBlueprint = item.mode === "blueprint";
      article.className = `slide generated-slide${isBlueprint ? " design-blueprint-slide" : ""}`;
      article.dataset.title = item.title;
      article.dataset.section = item.section;
      article.dataset.chapter = item.chapter;
      article.setAttribute("aria-hidden", "true");
      const nodeCount = Math.max(1, item.nodes.length);
      const eventNode = item.nodes.findIndex(node => node.some(value => String(value).includes("#A1024")));
      const hotIndex = eventNode >= 0 ? eventNode : nodeCount - 1;
      const nodes = item.nodes.map((node, index) => `
        <button class="lesson-node hotspot${index === hotIndex ? " is-hot" : ""}" type="button" data-index="${String(index + 1).padStart(2, "0")}">
          <span>${escapeHtml(node[0])}</span><strong>${escapeHtml(node[1])}</strong><small>${escapeHtml(node[2])}</small>
        </button>`).join("");
      const facts = item.facts.map(fact => `
        <div class="lesson-fact"><span>${escapeHtml(fact[0])}</span><strong>${escapeHtml(fact[1])}</strong>${fact[2] ? `<small>${escapeHtml(fact[2])}</small>` : ""}</div>`).join("");
      const pseudocode = isBlueprint ? `<pre class="blueprint-code" aria-label="依据 Kafka 实现提炼的伪代码"><span>IMPLEMENTATION MODEL · PSEUDOCODE</span><code>${escapeHtml(item.note.code)}</code></pre>` : "";
      article.innerHTML = `
        <header class="slide-heading"><span>${escapeHtml(item.section)}</span><h2>${escapeHtml(item.question)}</h2><p>${escapeHtml(item.intro)}</p></header>
        <div class="lesson-board${item.mode === "compare" ? " is-compare" : ""}${isBlueprint ? " is-blueprint" : ""}" data-chapter="${escapeHtml(item.chapter)}">
          <div class="lesson-path" style="--node-count:${nodeCount}">${nodes}</div>
          ${pseudocode}
          <div class="lesson-facts">${facts}</div>
        </div>
        <p class="memory-line"><span>记住</span>${escapeHtml(item.takeaway)}</p>`;
      anchor.after(article);
      tails.set(item.after, article);
      noteBySlide.set(article, item.note);
    });
  }

  renderAdvancedLessons();
  const slides = [...document.querySelectorAll(".slide")];

  const journeyStages = [
    ["code", "代码"],
    ["producer", "Producer"],
    ["network", "网络"],
    ["broker", "Broker"],
    ["storage", "存储"],
    ["replica", "副本"],
    ["consumer", "Consumer"],
    ["commit", "Commit"]
  ];

  function inferJourneyStage(slide, slideIndex) {
    if (slideIndex <= 2) return "code";
    if (slideIndex <= 16) return "producer";
    if (slideIndex === 17) return "network";
    if (slideIndex <= 21) return "broker";
    if (slideIndex <= 28) return "storage";
    if (slideIndex <= 38) return "replica";
    if (slideIndex <= 58) return "consumer";
    return "commit";
  }

  const supplementRules = [
    {
      match: /OPENING|HIGH LEVEL/,
      boundary: "全景图故意省略了 Connect、Streams、Schema Registry 等旁支。当前课程只追踪一条 Record 的主链；真正排障时，要先判断问题属于路由、写入、复制、读取还是恢复点。",
      failure: ["B1 上的 P1 Leader 突然不可用。", "Controller 从合格副本中选出新 Leader，Leader Epoch 增加。", "Producer 与 Consumer 刷新 Metadata，主线短暂停顿后改连新 Leader。"],
      inspect: [["路由", "P1 当前 Leader 与 Leader Epoch"], ["复制", "ISR、HW、UnderReplicatedPartitions"], ["消费", "P1 当前归属哪个 Member"], ["恢复", "P1 committed offset 与 lag"]],
      question: "如果 C0 处理完 #A1024 但还没提交 offset 43 就宕机，会发生什么？",
      answer: "P1 会被重新分配；新 Member 从已提交位置重新读取 offset 42，因此 #A1024 可能再次处理。这是典型的 at-least-once 窗口。"
    },
    {
      match: /BUSINESS CODE|INTERCEPTOR/,
      boundary: "ProducerRecord 只是发送意图，不是最终日志记录。尤其不要把 headers 当作可信业务载荷：它适合追踪和上下文传播，但同样需要大小、隐私和来源约束。",
      failure: ["拦截器同步执行慢查询或远程调用。", "业务线程的 send 延迟上升，线程池开始堆积。", "Producer 本身可能仍健康，但应用已经先出现尾延迟。"],
      inspect: [["线程", "业务线程 dump 是否停在 interceptor"], ["延迟", "send 调用耗时而非只看 Broker RTT"], ["数据", "header 大小、敏感信息与版本"], ["回调", "Future/Callback 是否真正处理失败"]],
      question: "send() 已返回 Future，是否能立刻认为消息已经写入 Kafka？",
      answer: "不能。此时通常只代表客户端已受理；只有 Future/Callback 成功，才表示配置要求的 ACK 条件已经完成。"
    },
    {
      match: /SERIALIZER|SCHEMA|SIZE LIMITS/,
      boundary: "Kafka Broker 只理解协议字节，不理解 OrderCreated 的业务含义。Schema 兼容、字段默认值、枚举演进和 PII 约束都必须在客户端或 Schema 治理层完成。",
      failure: ["Producer 发布了 Consumer 不认识的新字段类型或破坏性 Schema。", "Broker 正常存下合法字节，序列化链路没有报错。", "Consumer 在反序列化阶段持续失败，Partition 可能被毒消息卡住。"],
      inspect: [["客户端", "serialization/deserialization error rate"], ["契约", "Schema compatibility 与版本 ID"], ["大小", "序列化后的字节数，不是 JVM 对象大小"], ["样本", "安全抽取 key/header/schema-id，避免直接打印敏感 value"]],
      question: "为什么一条业务上错误的消息仍可能通过 Broker 校验？",
      answer: "Broker 校验的是 RecordBatch 结构、CRC、大小、时间戳与幂等序列，不会按你的业务 Schema 解释 value。"
    },
    {
      match: /PARTITIONER|PARTITION EDGE/,
      boundary: "同 Key 顺序只在同一 Partition 内成立，而且只在分区数不变、路由算法一致时稳定。增加 Partition 后，取模结果可能改变，历史与新记录会落到不同分区。",
      failure: ["某个大客户形成超级热点 Key。", "对应 Partition 的写入、复制和消费明显高于其他分区。", "扩 Broker 不会自动拆开这个 Key；需要业务拆 Key、调整路由或重新建 Topic。"],
      inspect: [["分布", "各 Partition bytes-in / records-lag 差异"], ["Key", "Top hot keys 与租户流量"], ["顺序", "是否真的需要每个业务实体严格有序"], ["扩容", "增加 Partition 前评估路由漂移"]],
      question: "Topic 从 6 个 Partition 扩到 12 个后，user-9527 一定还去 P1 吗？",
      answer: "不一定。默认有 Key 路由通常依赖 hash % partitionCount；分区数变化会改变结果。"
    },
    {
      match: /ACCUMULATOR|BUFFER POOL|COMPRESSION/,
      boundary: "Batch 按 TopicPartition 聚合，不是整个 Producer 共用一个大包。低流量 Partition 即使全局流量很高，也可能形成许多小批次。压缩收益取决于同批数据的相似度。",
      failure: ["Broker 或网络变慢，Sender 排空速度下降。", "RecordAccumulator 占用持续上升，BufferPool 可用内存接近零。", "新的 send 在 max.block.ms 内等待，最终抛出 TimeoutException。"],
      inspect: [["内存", "bufferpool-wait-time 与 available-bytes"], ["批次", "batch-size-avg / batch-size-max"], ["压缩", "compression-rate-avg"], ["时延", "record-queue-time-avg 与 request-latency"]],
      question: "把 linger.ms 调大，吞吐一定会提高吗？",
      answer: "不一定。它只给更多记录进入同一 Partition 批次的机会；若流量本来就能迅速填满 Batch，收益很小，反而可能增加等待延迟。"
    },
    {
      match: /METADATA|SENDER|IN-FLIGHT|PRODUCE RESPONSE|RETRY BUDGET|IDEMPOTENT/,
      boundary: "请求失败不等于记录一定没写入。典型不确定窗口是 Leader 已追加，但响应在网络中丢失；客户端只能重试。幂等 Producer 用 PID、Epoch 与 Sequence 把这种重试变成可识别的重复。",
      failure: ["ProduceRequest 已到 Leader 并完成追加。", "响应返回途中连接断开，Producer 只看到 timeout。", "启用幂等时相同序列重试不会重复追加；业务层自行重试仍可能制造新记录。"],
      inspect: [["超时", "delivery timeout 与 request timeout 分开看"], ["重试", "record-retry-rate、error-rate"], ["顺序", "max.in.flight 与 idempotence 是否冲突"], ["结果", "应用是否消费 Callback/Future 错误"]],
      question: "为什么把 retries 配得很大也不会无限重试？",
      answer: "delivery.timeout.ms 是整条记录从入批到最终成功或失败的总预算；到达截止时间后仍会完成失败。"
    },
    {
      match: /NETWORK|AUTH ACL QUOTA/,
      boundary: "Kafka 请求延迟包含排队、TLS/SASL、TCP 重传、Broker 处理与副本等待。只看一次 ping 无法定位尾延迟；同一个症状可能来自完全不同的边界。",
      failure: ["跨可用区网络开始丢包或抖动。", "TCP 重传增加，请求停留在 in-flight，Producer 批次排队。", "应用表现为 request timeout；继续无界重试会进一步放大拥塞。"],
      inspect: [["客户端", "request-latency、connection-count、retries"], ["网络", "TCP retransmits、RTT、丢包、跨区流量"], ["安全", "TLS handshake / SASL authentication latency"], ["Broker", "request queue time 与 throttle time"]],
      question: "Kafka 使用 TCP，为什么应用仍然可能收到重复消息？",
      answer: "TCP 只保证单连接字节可靠传输；请求结果仍可能在响应丢失时变得不确定，Producer 或业务重试可能再次发送。"
    },
    {
      match: /BROKER REQUEST|BROKER VALIDATION|OFFSET ASSIGNMENT/,
      boundary: "Broker 的网络线程与请求处理线程是不同资源池。连接很多不一定意味着磁盘忙；反过来，Handler 或请求队列饱和也会让网络侧看起来像普通超时。",
      failure: ["少数巨大 ProduceRequest 占住请求处理与 I/O 资源。", "RequestChannel 排队时间上升，小请求也开始被拖慢。", "客户端看到延迟和 timeout，但 Broker CPU 可能并不满。"],
      inspect: [["队列", "RequestQueueTimeMs 与 queued requests"], ["处理", "LocalTimeMs / RemoteTimeMs"], ["线程", "network processor 与 request handler idle"], ["错误", "MESSAGE_TOO_LARGE、CORRUPT_MESSAGE、quota throttle"]],
      question: "offset 42 是 Producer 在发送前算好的吗？",
      answer: "不是。Producer 只选择 TopicPartition；最终 offset 由该 Partition 的 Leader 在追加日志时分配。"
    },
    {
      match: /LOGICAL STORAGE|RECORD BATCH FORMAT|LOG FILES|SEGMENT|RETENTION|COMPACTION/,
      boundary: "Partition 才是连续日志；Segment 只是文件管理边界。Retention 通常按关闭的 Segment 删除，而不是消费一条就删除一条，也不会等待所有 Consumer 读完。",
      failure: ["某 Consumer 长时间停机，lag 不断扩大。", "Retention 到期后旧 Segment 被删除。", "Consumer 恢复时原 offset 已不存在，只能按 auto.offset.reset 决定失败、最早或最新位置。"],
      inspect: [["文件", "Partition 目录、active segment 与 baseOffset"], ["保留", "retention.ms/bytes 和实际字节增长率"], ["消费", "最慢 Group 的 lag 是否逼近保留窗口"], ["清理", "delete 与 compact 策略是否符合业务预期"]],
      question: "Consumer 提交 offset 后，对应消息会从 .log 删除吗？",
      answer: "不会。消息保留由 Topic 的 retention/compaction 策略决定，与某个 Group 的提交进度无关。"
    },
    {
      match: /PHYSICAL WRITE|STORAGE FAILURE|INDEX LOOKUP|PAGE CACHE OR DISK|ZERO COPY/,
      boundary: "acks=all 关心副本确认边界，不等于每条记录都对每块盘执行 fsync。Kafka 的性能来自顺序追加、OS Page Cache、批处理和较少的数据复制共同作用。",
      failure: ["内存压力导致热日志页被频繁回收。", "Consumer Fetch 从 Page Cache 命中转为物理读，磁盘 await 与尾延迟升高。", "副本 Fetch 也可能变慢，进一步导致 ISR 收缩。"],
      inspect: [["内存", "page cache、major faults、dirty/writeback pages"], ["磁盘", "await、util、吞吐和磁盘剩余空间"], ["Kafka", "fetch latency、replica lag、ISR shrink"], ["热点", "是否单个 Partition 集中在一块盘"]],
      question: "Producer 收到 acks=all 成功，是否证明 #A1024 已经物理落到三块 NVMe？",
      answer: "不能这样推导。它表示满足当前 ISR 与 minISR 的复制确认条件；Kafka 默认并不为每条消息逐盘 fsync。"
    },
    {
      match: /FOLLOWER|ISR LEO HW|ACK MODES|MIN ISR|LEADER FAILURE|AVAILABILITY BLUEPRINT/,
      boundary: "RF、ISR、minISR 和 acks 分别回答不同问题：有几份配置副本、哪些副本跟得上、最低写入底线、Producer 等待什么。把它们混成一个‘副本数’会误判故障语义。",
      failure: ["RF=3 的 P1 中两个 Follower 先后变慢并离开 ISR。", "ISR 只剩 Leader；acks=all 且 minISR=2 的写入被拒绝。", "系统牺牲写可用性，避免在单副本脆弱状态下继续确认。"],
      inspect: [["集合", "配置副本、ISR、当前 Leader 分开查看"], ["进度", "各副本 LEO 与 HW"], ["事件", "ISR shrink/expand、Leader election"], ["策略", "minISR、unclean election、ELR 语义"]],
      question: "RF=3、minISR=2 时，允许坏几台仍保持 acks=all 写入？",
      answer: "通常可容忍一份副本不可用；当 ISR 低于 2 时会拒写。是否还能安全选主要结合 ISR、unclean election 和版本特性判断。"
    },
    {
      match: /TRANSACTIONS|LSO/,
      boundary: "事务可见性由 Last Stable Offset 限制。HW 表示复制边界，LSO 表示 read_committed 可以看到的边界；前面存在未完成事务时，后续普通记录也可能暂时不可见。",
      failure: ["事务 Producer 写入后迟迟没有 commit 或 abort。", "HW 可以继续推进，但 LSO 被未完成事务挡住。", "read_committed Consumer 看起来像出现 lag，却不是副本复制慢。"],
      inspect: [["可见性", "HW 与 LSO 的差值"], ["事务", "open transaction 持续时间"], ["Consumer", "isolation.level 是否为 read_committed"], ["Producer", "transaction timeout 与 fencing 错误"]],
      question: "HW 已经超过 offset 42，read_committed Consumer 就一定能读到吗？",
      answer: "不一定。还要看 LSO；如果前面有未完成事务，read_committed 的可见边界可能仍停在更早位置。"
    },
    {
      match: /CONSUMER GROUP|GROUP COORDINATOR|JOIN & ASSIGN|ASSIGNORS|AUTO OFFSET RESET/,
      boundary: "Group 只协调同一个 group.id 内的分区所有权。不同 Group 会各自读取一遍；同一 Group 中一个 Partition 同时只交给一个 Member，但 Member 数超过 Partition 数时会有人空闲。",
      failure: ["一个新 Member 加入或旧 Member 超过会话/poll 边界。", "Coordinator 触发新一轮分配，旧所有权被撤销或逐步迁移。", "如果处理线程没有正确交接，可能重复处理或长时间停顿。"],
      inspect: [["协调", "group state、generation、coordinator"], ["归属", "每个 Member 当前 assignment"], ["恢复点", "committed offset 是否存在"], ["空闲", "members 与 partitions 的数量关系"]],
      question: "3 个 Consumer、6 个 Partition 时再加第 4 个 Consumer，一定能提升吞吐吗？",
      answer: "不一定。它是否拿到 Partition 取决于分配策略；吞吐还可能受热点 Partition、下游处理或 Broker 限制。"
    },
    {
      match: /REBALANCE|STATIC MEMBERSHIP|HEARTBEAT VS POLL/,
      boundary: "Heartbeat 证明进程还活着，poll 进度证明应用仍在持续取数。两条时钟解决不同问题；业务处理过久可能在心跳仍正常时越过 max.poll.interval.ms。",
      failure: ["Consumer 一批业务处理超过 max.poll.interval.ms。", "Coordinator 认为它不再正常 poll，触发 Rebalance。", "旧实例随后继续提交时可能遇到 generation/fencing 错误，消息也可能被新 Owner 重读。"],
      inspect: [["频率", "rebalance 次数与触发原因"], ["处理", "poll 间隔和单批处理 P99"], ["心跳", "session timeout 与 heartbeat 状态"], ["分配", "cooperative/static membership 是否适配部署方式"]],
      question: "只要 Heartbeat 正常，Consumer 就永远不会因处理太慢而被移出 Group 吗？",
      answer: "不是。max.poll.interval.ms 约束应用 poll 的进度；即使后台心跳还能发送，长期不 poll 仍会失去分区。"
    },
    {
      match: /POLL PIPELINE|FETCH REQUEST|FETCH TUNING/,
      boundary: "poll() 不等于每次都发一个 Fetch。客户端可能先返回本地已缓存记录，同时后台维持 Fetch 会话和预取；因此单次 poll 的耗时不能直接等同于一次 Broker 网络 RTT。",
      failure: ["单条记录处理时间增长，应用消费速度低于到达速度。", "本地缓存与 Partition lag 上升，poll 间隔逐渐逼近上限。", "盲目增大 fetch 数量会让每批处理更久，反而更容易 Rebalance。"],
      inspect: [["到达", "records-lag 与 records-lead"], ["吞吐", "records-consumed-rate / bytes-consumed-rate"], ["批次", "records-per-request 与 poll 返回数量"], ["处理", "每批耗时是否接近 max.poll.interval"]],
      question: "把 max.poll.records 调大，消费吞吐一定会提高吗？",
      answer: "不一定。它只提高单次交给应用的上限；若业务处理成为瓶颈，更大的批次会拉长 poll 间隔并增加重平衡风险。"
    },
    {
      match: /DECOMPRESS|DESERIALIZE|CONSUMER RECORD/,
      boundary: "解压通常发生在 RecordBatch 层，反序列化发生在单条 Record 层。ConsumerRecord 重新暴露 key/value/headers/offset，但此时 value 仍可能因 Schema 或自定义代码失败。",
      failure: ["offset 42 的 value 无法反序列化。", "每次重启仍从相同位置读取，同一 Partition 反复失败。", "需要先保留原始字节和上下文，再决定跳过、修复、重放或送入隔离 Topic。"],
      inspect: [["位置", "准确记录 topic/partition/offset"], ["契约", "schema id、writer/reader 版本"], ["原文", "受控保存原始 bytes，避免日志泄密"], ["策略", "错误分类是否区分可重试与永久失败"]],
      question: "为什么 catch 反序列化异常后简单继续 poll 可能仍卡住？",
      answer: "如果没有推进或正确处理该 offset，下一次仍会读到同一条坏记录；贸然提交又可能造成静默跳过。"
    },
    {
      match: /BUSINESS PROCESSING|PAUSE & RESUME|POSITION VS COMMITTED|COMMIT STRATEGIES|CONSISTENCY BLUEPRINT/,
      boundary: "Kafka 的 commit 只记录读取恢复点，不会自动把数据库、HTTP 或缓存副作用纳入同一事务。先处理后提交偏向重复，先提交后处理偏向丢失。",
      failure: ["数据库写入成功，但提交 offset 43 前进程崩溃。", "新 Owner 从 committed offset 42 重读 #A1024。", "若业务写入没有 eventId 唯一约束或幂等键，同一订单副作用会执行两次。"],
      inspect: [["恢复点", "position 与 committed 分开看"], ["副作用", "eventId/业务键是否有唯一约束"], ["提交", "commit latency 与失败率"], ["背压", "pause/resume 后是否仍持续 poll 保持成员活性"]],
      question: "怎样让‘写数据库 + 提交 Kafka offset’真正原子？",
      answer: "普通 Consumer API 无法自动跨外部数据库原子提交。常见选择是幂等消费/去重表、Inbox/Outbox，或把结果仍写回 Kafka 并使用 Kafka 事务。"
    },
    {
      match: /POISON PILL|DLQ|CONSUMER LAG/,
      boundary: "DLQ 不是自动正确性机制，而是把无法在线解决的记录从主线隔离。必须同时保存原 Topic、Partition、Offset、异常分类、Schema 和重放次数，否则很难安全恢复。",
      failure: ["一条永久坏消息被无限重试。", "该 Partition 后续正常记录全部被阻塞，lag 持续增长。", "隔离后若直接提交，需要确保监控、修复与重放链路不会让消息永久遗忘。"],
      inspect: [["Lag", "区分到达速度上升与消费速度下降"], ["年龄", "oldest unprocessed record age"], ["坏消息", "同一 offset 重试次数与异常类型"], ["重放", "DLQ 修复后是否具备幂等与审计"]],
      question: "Consumer lag 为 0，是否证明业务结果都正确？",
      answer: "不能。它只说明读取/提交位置追上日志边界；错误处理、提前提交、DLQ 遗忘或下游副作用失败都可能被 lag 掩盖。"
    },
    {
      match: /PERFORMANCE BLUEPRINT|FINAL CHECK/,
      boundary: "高吞吐不是某一个‘零拷贝’开关带来的，而是批处理、顺序日志、Page Cache、压缩、分区并行和拉模型叠加。任何一环的热点都可能成为最终上限。",
      failure: ["吞吐下降时直接加 Broker，但热点 Key 仍只落在 P1。", "新节点没有分担该 Partition，P1 的 Leader、磁盘与 Consumer 仍然饱和。", "容量增加了，主瓶颈却没有移动。"],
      inspect: [["先定位", "Producer、Broker、复制还是 Consumer"], ["再分区", "看整体平均值之前先看 Partition 分布"], ["再资源", "CPU、网络、Page Cache、磁盘、下游"], ["最后调参", "只改与已确认瓶颈相关的配置"]],
      question: "看到 Consumer lag 上升，第一反应应该是增加 Consumer 吗？",
      answer: "不是。先判断是到达速度突增、热点 Partition、Broker Fetch 变慢、反序列化失败还是下游处理变慢；若瓶颈不在并行度，加 Consumer 可能只触发 Rebalance。"
    }
  ];

  const supplementFallbacks = {
    code: { boundary: "这一页描述 API 表象；生产系统还要补上输入校验、错误回调、数据契约和可观测字段。", failure: ["输入或上下文字段不完整。", "消息仍可能进入异步链路。", "错误直到下游才暴露，定位成本显著增加。"], inspect: [["输入", "topic/key/header 是否符合约定"], ["结果", "发送失败是否被观察"], ["追踪", "eventId 与 trace 是否能贯穿链路"]], question: "怎样证明同一业务事件没有被重复创建？", answer: "需要稳定 eventId、业务唯一约束或 Outbox 等机制；Kafka 的 offset 不能替代业务事件身份。" },
    producer: { boundary: "Producer 是一个有内存、有后台线程、有超时预算的异步系统，不是简单的网络方法。", failure: ["Broker 变慢。", "批次在客户端排队。", "预算耗尽后异步失败。"], inspect: [["排队", "record queue time"], ["请求", "latency/retry/error"], ["内存", "buffer pool wait"]], question: "send 很快为什么仍可能丢消息？", answer: "send 快只代表入队快；必须处理异步结果，并在退出前正确 flush/close。" },
    network: { boundary: "网络问题要区分连接、TLS、TCP、跨区和 Broker 排队。", failure: ["连接抖动。", "请求超时并重试。", "批次排队与尾延迟一起增长。"], inspect: [["TCP", "RTT/重传"], ["客户端", "request latency"], ["Broker", "queue time"]], question: "ping 正常能排除 Kafka 网络问题吗？", answer: "不能。ping 不覆盖 TLS、连接复用、请求大小、Broker 排队和副本等待。" },
    broker: { boundary: "Broker 接入、校验、追加和副本等待是不同阶段。", failure: ["请求进入队列。", "Handler 或存储路径变慢。", "客户端最终看到统一的 timeout。"], inspect: [["队列", "queue time"], ["处理", "local/remote time"], ["错误", "protocol error codes"]], question: "Broker CPU 不高是否证明 Broker 没瓶颈？", answer: "不能；磁盘、Page Cache、网络、配额和请求队列都可能限制吞吐。" },
    storage: { boundary: "逻辑日志、文件视图、Page Cache 和物理介质是四个不同层次。", failure: ["缓存命中下降。", "物理读写增加。", "Fetch 与副本延迟同时上升。"], inspect: [["文件", "segment/offset"], ["内存", "page cache"], ["磁盘", "await/util"]], question: "看到 .log 文件增长是否说明 Consumer 没提交？", answer: "不一定；日志保留独立于 Consumer commit。" },
    replica: { boundary: "复制确认、读取可见和物理落盘不能画成同一个时刻。", failure: ["Follower 变慢。", "ISR 收缩与 HW 推进受影响。", "minISR 可能触发拒写。"], inspect: [["ISR", "shrink/expand"], ["进度", "LEO/HW"], ["写入", "NOT_ENOUGH_REPLICAS"]], question: "RF=3 是否代表每次 ACK 都等三份副本？", answer: "取决于 acks 与当前 ISR；acks=all 等当前 ISR，并受 minISR 约束。" },
    consumer: { boundary: "Consumer 同时维护网络预取、分区所有权、应用处理和 Group 活性。", failure: ["处理速度下降。", "lag 与 poll 间隔上升。", "最终可能触发 Rebalance。"], inspect: [["Lag", "按 Partition"], ["Poll", "间隔与批量"], ["Group", "state/assignment"]], question: "增加 Consumer 为什么可能没有效果？", answer: "并行度受 Partition 数与热点分布限制，瓶颈也可能在 Broker 或下游。" },
    commit: { boundary: "Offset commit 只是恢复位置，不等同于业务结果提交。", failure: ["副作用成功。", "Offset 提交前宕机。", "恢复后重复处理。"], inspect: [["位置", "position/committed"], ["副作用", "幂等键"], ["提交", "失败与延迟"]], question: "如何避免重复扣款？", answer: "在业务侧使用 eventId/业务键幂等、唯一约束或 Inbox/Outbox，而不是依赖自动提交。" }
  };

  function buildSupplement(slide, slideIndex, item) {
    const scope = `${slide.dataset.section || ""} ${slide.dataset.chapter || ""} ${slide.dataset.title || ""}`.toUpperCase();
    const stage = inferJourneyStage(slide, slideIndex);
    const rule = supplementRules.find(candidate => candidate.match.test(scope)) || supplementFallbacks[stage];
    return { ...rule, stage, source: item.source };
  }

  function addJourneyContext() {
    slides.forEach((slide, slideIndex) => {
      if (slide.classList.contains("cover") || slide.classList.contains("topology-slide")) return;
      const heading = slide.querySelector(":scope > .slide-heading");
      if (!heading) return;
      const activeStage = inferJourneyStage(slide, slideIndex);
      const activeIndex = journeyStages.findIndex(([id]) => id === activeStage);
      const rail = document.createElement("div");
      rail.className = "journey-rail";
      rail.setAttribute("aria-label", `当前位于消息旅程：${journeyStages[activeIndex][1]}`);
      rail.innerHTML = journeyStages.map(([id, label], index) => `<span class="${index < activeIndex ? "is-past" : ""}${id === activeStage ? " is-current" : ""}"><i></i>${label}</span>`).join("");
      heading.appendChild(rail);
    });
  }

  addJourneyContext();

  function createEvidenceBlock(kind, label) {
    const block = document.createElement("div");
    block.className = `evidence-block evidence-${kind}`;
    const kicker = document.createElement("span");
    kicker.textContent = label;
    block.appendChild(kicker);
    return block;
  }

  function enhanceInlineEvidence() {
    slides.forEach(slide => {
      const note = noteBySlide.get(slide) || notes[0];
      const memory = slide.querySelector(":scope > .memory-line");
      const completion = slide.querySelector(":scope > .next-chapter");
      let takeaway = "";

      if (memory) {
        const clone = memory.cloneNode(true);
        clone.querySelector("span")?.remove();
        takeaway = clone.textContent.trim();
        memory.remove();
      } else if (completion) {
        takeaway = completion.querySelector("strong")?.textContent.trim() || "";
        completion.remove();
      }

      const evidence = document.createElement("section");
      const isBlueprintSummary = slide.classList.contains("design-blueprint-slide");
      const isMapSummary = slide.classList.contains("topology-slide");
      evidence.className = `inline-evidence${isBlueprintSummary ? " is-blueprint-summary" : ""}${isMapSummary ? " is-map-summary" : ""}`;
      evidence.setAttribute("aria-label", "本页讲义：结论、机制、关键配置、设计取舍与实现模型");

      const conclusion = createEvidenceBlock("conclusion", "这一步发生什么");
      const conclusionText = document.createElement("strong");
      conclusionText.textContent = takeaway || slide.dataset.title;
      const explanation = document.createElement("p");
      explanation.textContent = note.summary;
      conclusion.append(conclusionText, explanation);

      const config = createEvidenceBlock("config", "生产配置");
      const configList = document.createElement("dl");
      note.config.slice(0, 4).forEach(([key, value]) => {
        const row = document.createElement("div");
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = key;
        dd.textContent = value;
        row.append(dt, dd);
        configList.appendChild(row);
      });
      config.appendChild(configList);

      const tradeoff = createEvidenceBlock("tradeoff", "为什么这样设计");
      const gain = document.createElement("p");
      gain.innerHTML = `<b>得到</b><span>${escapeHtml(note.gain)}</span>`;
      const cost = document.createElement("p");
      cost.innerHTML = `<b>代价</b><span>${escapeHtml(note.cost)}</span>`;
      tradeoff.append(gain, cost);

      const source = createEvidenceBlock("source", "实现模型");
      const sourceHead = document.createElement("div");
      sourceHead.className = "evidence-source-head";
      const sourceLink = document.createElement("a");
      sourceLink.href = note.source;
      sourceLink.target = "_blank";
      sourceLink.rel = "noreferrer";
      sourceLink.textContent = note.source.includes("github.com") ? "实现依据 ↗" : "官方依据 ↗";
      sourceHead.appendChild(sourceLink);
      const code = document.createElement("pre");
      const codeText = document.createElement("code");
      codeText.textContent = note.code;
      code.appendChild(codeText);
      source.append(sourceHead, code);

      evidence.append(conclusion, config, tradeoff);
      if (!isBlueprintSummary && !isMapSummary) evidence.appendChild(source);
      slide.appendChild(evidence);
    });
  }

  enhanceInlineEvidence();
  const overviewGrid = document.getElementById("overview-grid");
  const pageCount = document.getElementById("page-count");
  const pageTitle = document.getElementById("page-title");
  const headerStepTitle = document.getElementById("header-step-title");
  const headerPageCount = document.getElementById("header-page-count");
  const prev = document.getElementById("prev");
  const next = document.getElementById("next");
  const notesPanel = document.getElementById("notes-panel");
  const notesScrim = document.getElementById("notes-scrim");
  const notesToggle = document.getElementById("notes-toggle");
  const overview = document.getElementById("overview");
  let current = readHash();
  let lastFocus = null;

  function readHash() {
    const match = location.hash.match(/slide-(\d+)/);
    return match ? Math.max(0, Math.min(slides.length - 1, Number(match[1]) - 1)) : 0;
  }

  slides.forEach((slide, index) => {
    const number = String(index + 1).padStart(2, "0");
    const card = document.createElement("button");
    card.type = "button";
    card.className = "overview-card";
    card.innerHTML = `<span>${slide.dataset.section}</span><strong>${slide.dataset.title}</strong><small>${number} / ${String(slides.length).padStart(2, "0")}</small>`;
    card.addEventListener("click", () => { closeOverview(); goTo(index); });
    overviewGrid.appendChild(card);
  });
  document.getElementById("overview-count").textContent = `KAFKA · ${slides.length} PAGES · END-TO-END`;

  const overviewCards = [...overviewGrid.children];

  function goTo(index, updateHash = true) {
    const target = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === target);
      slide.classList.toggle("was-active", i < target);
      slide.setAttribute("aria-hidden", String(i !== target));
    });
    current = target;
    const slide = slides[current];
    pageCount.textContent = `${String(current + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
    pageTitle.textContent = slide.dataset.title;
    headerStepTitle.textContent = slide.dataset.title;
    headerPageCount.textContent = pageCount.textContent;
    prev.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    prev.setAttribute("aria-label", current === 0 ? "已经是第一页" : `上一页：${slides[current - 1].dataset.title}`);
    next.setAttribute("aria-label", current === slides.length - 1 ? "课程已完成" : `下一页：${slides[current + 1].dataset.title}`);
    overviewCards.forEach((card, i) => card.classList.toggle("is-active", i === current));
    if (notesPanel.classList.contains("is-open")) fillNotes(current);
    if (updateHash && location.hash !== `#slide-${current + 1}`) history.pushState(null, "", `#slide-${current + 1}`);
  }

  function fillNotes(index) {
    const slide = slides[index] || slides[current];
    const item = noteBySlide.get(slide) || notes[0];
    const supplement = buildSupplement(slide, index, item);
    const stageLabel = journeyStages.find(([id]) => id === supplement.stage)?.[1] || "全景";
    document.getElementById("notes-kicker").textContent = `DEEP DIVE · ${slide.dataset.section}`;
    document.getElementById("notes-title").textContent = slide.dataset.title;
    document.getElementById("notes-stage").textContent = `当前边界 · ${stageLabel}`;
    document.getElementById("notes-boundary").textContent = supplement.boundary;
    document.getElementById("notes-question").textContent = supplement.question;
    document.getElementById("notes-answer-text").textContent = supplement.answer;
    document.getElementById("notes-answer").open = false;
    document.getElementById("notes-source").href = supplement.source;

    const failure = document.getElementById("notes-failure");
    failure.replaceChildren(...supplement.failure.map((textValue, stepIndex) => {
      const li = document.createElement("li");
      const number = document.createElement("b");
      const textNode = document.createElement("span");
      number.textContent = String(stepIndex + 1).padStart(2, "0");
      textNode.textContent = textValue;
      li.append(number, textNode);
      return li;
    }));

    const inspection = document.getElementById("notes-inspect");
    inspection.replaceChildren(...supplement.inspect.map(([label, value]) => {
      const row = document.createElement("div");
      const strong = document.createElement("strong");
      const span = document.createElement("span");
      strong.textContent = label;
      span.textContent = value;
      row.append(strong, span);
      return row;
    }));

    const relatedIndexes = [];
    for (let distance = 1; distance < slides.length && relatedIndexes.length < 2; distance += 1) {
      [index - distance, index + distance].forEach(candidateIndex => {
        if (relatedIndexes.length >= 2 || candidateIndex < 0 || candidateIndex >= slides.length) return;
        if (inferJourneyStage(slides[candidateIndex], candidateIndex) === supplement.stage) relatedIndexes.push(candidateIndex);
      });
    }
    const related = document.getElementById("notes-related");
    related.replaceChildren(...relatedIndexes.map(candidateIndex => {
      const button = document.createElement("button");
      const section = document.createElement("span");
      const title = document.createElement("strong");
      section.textContent = slides[candidateIndex].dataset.section;
      title.textContent = slides[candidateIndex].dataset.title;
      button.type = "button";
      button.append(section, title);
      button.addEventListener("click", () => { closeNotes(); goTo(candidateIndex); });
      return button;
    }));
  }

  function openNotes(index = current) {
    lastFocus = document.activeElement;
    fillNotes(index);
    notesPanel.classList.add("is-open");
    notesPanel.setAttribute("aria-hidden", "false");
    notesToggle.setAttribute("aria-expanded", "true");
    notesScrim.hidden = false;
    requestAnimationFrame(() => document.getElementById("close-notes").focus());
  }

  function closeNotes() {
    notesPanel.classList.remove("is-open");
    notesPanel.setAttribute("aria-hidden", "true");
    notesToggle.setAttribute("aria-expanded", "false");
    notesScrim.hidden = true;
    if (lastFocus instanceof HTMLElement) lastFocus.focus();
  }

  function openOverview() {
    overview.classList.add("is-open");
    overview.setAttribute("aria-hidden", "false");
    document.getElementById("open-overview").setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => document.getElementById("close-overview").focus());
  }

  function closeOverview() {
    overview.classList.remove("is-open");
    overview.setAttribute("aria-hidden", "true");
    document.getElementById("open-overview").setAttribute("aria-expanded", "false");
  }

  prev.addEventListener("click", () => goTo(current - 1));
  next.addEventListener("click", () => goTo(current + 1));
  notesToggle.addEventListener("click", () => notesPanel.classList.contains("is-open") ? closeNotes() : openNotes());
  document.getElementById("close-notes").addEventListener("click", closeNotes);
  notesScrim.addEventListener("click", closeNotes);
  document.getElementById("open-overview").addEventListener("click", openOverview);
  document.getElementById("close-overview").addEventListener("click", closeOverview);
  document.querySelectorAll(".hotspot").forEach(button => button.addEventListener("click", () => {
    const owner = button.closest(".slide");
    const index = slides.indexOf(owner);
    openNotes(index >= 0 ? index : current);
  }));

  window.addEventListener("hashchange", () => goTo(readHash(), false));
  window.addEventListener("popstate", () => goTo(readHash(), false));
  window.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (overview.classList.contains("is-open")) closeOverview();
      else if (notesPanel.classList.contains("is-open")) closeNotes();
      return;
    }
    if (overview.classList.contains("is-open") || notesPanel.classList.contains("is-open")) return;
    if (["ArrowRight", "PageDown"].includes(event.key)) { event.preventDefault(); goTo(current + 1); }
    if (["ArrowLeft", "PageUp"].includes(event.key)) { event.preventDefault(); goTo(current - 1); }
    if (event.key.toLowerCase() === "o") openOverview();
    if (event.key.toLowerCase() === "n") openNotes();
  });

  goTo(current, false);
})();

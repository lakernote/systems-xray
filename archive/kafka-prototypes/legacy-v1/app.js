(function () {
  "use strict";

  const root = document.documentElement;
  const lessonList = document.getElementById("lesson-list");
  const learningStage = document.getElementById("learning-stage");
  const scene = document.getElementById("scene");
  const worldMap = document.getElementById("world-map");
  const stepKicker = document.getElementById("step-kicker");
  const stepTitle = document.getElementById("step-title");
  const timeline = document.getElementById("timeline");
  const timelineText = document.getElementById("timeline-text");
  const previousButton = document.getElementById("previous-step");
  const nextButton = document.getElementById("next-step");
  const playButton = document.getElementById("play-step");
  const speedSelect = document.getElementById("speed");
  const overviewModeButton = document.getElementById("overview-mode");
  const detailModeButton = document.getElementById("detail-mode");
  const inspectorContent = document.getElementById("inspector-content");
  const inspectorTabs = Array.from(document.querySelectorAll("[data-panel]"));

  const state = {
    step: 0,
    panel: "principle",
    selectedField: "value",
    playing: false,
    speed: 1,
    timer: null,
    lastDetailStep: 1
  };

  const worldStops = ["业务代码", "Producer", "Broker", "副本", "Consumer"];

  const recordFieldDetails = {
    topic: {
      title: "topic",
      summary: "消息的逻辑目的地。Producer 会先读取这个 Topic 的分区和 Leader 元数据。",
      facts: [
        ["Java 类型", "String"],
        ["示例值", "orders.created"],
        ["进入协议", "ProduceRequest → TopicData"]
      ],
      note: "Topic 名称不是路由表达式；一条 ProducerRecord 在发送时只属于一个 Topic。"
    },
    partition: {
      title: "partition",
      summary: "可选的显式分区。设置后会跳过默认的 Key 哈希或粘性分区选择。",
      facts: [
        ["Java 类型", "Integer | null"],
        ["当前值", "null"],
        ["最终结果", "由 Partitioner 选择 P1"]
      ],
      note: "生产代码通常不硬编码分区号，否则 Topic 扩容和故障切换会更难维护。"
    },
    timestamp: {
      title: "timestamp",
      summary: "可选事件时间。为空时通常由 Producer 使用当前时间；Broker 也可以配置为覆盖为追加时间。",
      facts: [
        ["Java 类型", "Long | null"],
        ["当前值", "null"],
        ["相关策略", "CreateTime / LogAppendTime"]
      ],
      note: "业务事件时间、发送时间与 Broker 追加时间不是同一个概念。做窗口计算时尤其要区分。"
    },
    key: {
      title: "key",
      summary: "Key 最重要的生产作用，是决定分区亲和性，从而获得同一 Key 在单个分区内的顺序。",
      facts: [
        ["Java 类型", "String"],
        ["当前值", "user-9527"],
        ["序列化后", "10 bytes"],
        ["分区结果", "P1"]
      ],
      note: "Key 不是唯一约束。重复 Key 完全合法；在 compacted Topic 中，它还是压缩保留的身份。"
    },
    value: {
      title: "value",
      summary: "真正承载业务数据。Kafka 不理解对象结构，只保存 Serializer 产生的 byte[]。",
      facts: [
        ["Java 类型", "OrderCreated"],
        ["序列化格式", "JSON（本场景）"],
        ["序列化后", "64 bytes"],
        ["null 的含义", "压缩 Topic 中可作为 tombstone"]
      ],
      note: "生产环境要为 Schema 演进、兼容性和失败消息准备策略，而不仅是选择 JSON 还是 Avro。"
    },
    headers: {
      title: "headers",
      summary: "随消息携带的元数据，适合链路追踪、租户、内容类型等横切信息。",
      facts: [
        ["键类型", "String"],
        ["值类型", "byte[] | null"],
        ["当前数量", "3"],
        ["重复键", "允许，并保持插入顺序"]
      ],
      note: "Header 不经过 key.serializer 或 value.serializer；应用或 Interceptor 应先把 Header 值转换为 byte[]。"
    }
  };

  const steps = [
    {
      id: "overview",
      nav: "Kafka 全局俯瞰",
      kicker: "00 · KAFKA OVERVIEW",
      title: "先看懂 Kafka 全貌",
      world: -1,
      scene: renderOverviewScene,
      principle: {
        heading: "先建立一张完整地图",
        summary: "一条消息从业务代码出发，经 Producer 加工后只写入某个 Partition 的 Leader；副本同步提供可靠性，Consumer Group 再主动拉取并提交进度。",
        flow: [
          "Producer 把对象变成字节，选择 Partition 并组成 Batch。",
          "Batch 发送到该 Partition 所在的 Leader Broker。",
          "Follower 从 Leader 拉取数据，推进可见进度。",
          "Consumer Group 按分区分工消费，并保存下一条 Offset。"
        ],
        note: "点击全景图里的 Producer、Broker、副本或 Consumer，可以直接钻入对应内部步骤。"
      },
      data: [
        ["业务事件", "OrderCreated · Message #A1024"],
        ["Topic", "orders.created"],
        ["目标分区", "P1 · Leader Broker 2"],
        ["副本布局", "Broker 2 Leader · Broker 1/3 Follower"],
        ["消费分工", "Consumer C2 ← P1"],
        ["消费进度", "已处理 offset 42 → commit 43"]
      ],
      config: [
        ["partitions", "3", "决定并行度、顺序边界与水平扩展单位。"],
        ["replication.factor", "3", "每个 Partition 在三个 Broker 上保存副本。"],
        ["acks + min.insync.replicas", "all + 2", "共同定义本场景的写入可靠性边界。"],
        ["consumer group", "order-risk-service", "组内 Consumer 分担 Partition，同一分区同时只交给一个组内成员。"]
      ]
    },
    {
      id: "record",
      nav: "ProducerRecord 解剖",
      kicker: "01 · PRODUCER RECORD",
      title: "一条消息诞生",
      world: 0,
      scene: renderRecordScene,
      principle: {
        heading: "先看清消息的六个组成部分",
        summary: "业务对象被包装成 ProducerRecord。此时它仍是 JVM 中的对象，还没有分区、Offset，也没有写入 Kafka。",
        flow: [
          "业务创建 OrderCreated 对象。",
          "组装 topic、key、value 与 headers。",
          "partition 和 timestamp 可以暂时留空。",
          "调用 producer.send(record) 进入异步发送流程。"
        ],
        note: "点击画面中的任意字段，可以查看它在生产中的真实作用。"
      },
      data: [
        ["泛型", "ProducerRecord<String, OrderCreated>"],
        ["Topic", "orders.created"],
        ["Partition", "null → 稍后计算"],
        ["Timestamp", "null → 稍后补充"],
        ["Key", "user-9527"],
        ["Value", "OrderCreated{A1024, 99.80}"],
        ["Headers", "traceparent / tenant-id / content-type"]
      ],
      config: [
        ["client.id", "order-service", "标识客户端，方便日志、指标和配额定位。"],
        ["bootstrap.servers", "kafka-1:9092,kafka-2:9092", "只用于首次发现集群，不代表消息只发往这些节点。"],
        ["max.block.ms", "60s", "元数据不可用或缓冲区耗尽时，send 最长阻塞时间。"]
      ]
    },
    {
      nav: "拦截器与元数据",
      kicker: "02 · INTERCEPTOR & METADATA",
      title: "补充链路信息，寻找目的地",
      world: 1,
      scene: renderInterceptorScene,
      principle: {
        heading: "控制信息先于数据发送",
        summary: "ProducerInterceptor 可以修改 Record 或注入 Header；Producer 同时依赖元数据缓存知道 Topic 有几个分区、各 Leader 在哪里。",
        flow: [
          "onSend() 注入 traceparent 等横切信息。",
          "读取本地 Metadata Cache。",
          "元数据过期或缺失时向 Broker 请求刷新。",
          "得到分区列表与 Leader 节点后才能继续。"
        ],
        note: "拦截器运行在发送调用路径上。耗时逻辑、异常或线程不安全代码都会影响生产吞吐。"
      },
      data: [
        ["新增 Header", "traceparent → 00-a1024...-01"],
        ["Topic 分区", "P0 / P1 / P2"],
        ["Leader", "P0→B1 · P1→B2 · P2→B3"],
        ["Record 状态", "仍未序列化"]
      ],
      config: [
        ["interceptor.classes", "TracingProducerInterceptor", "按顺序执行多个 ProducerInterceptor。"],
        ["metadata.max.age.ms", "5m", "即使没有变化，也会周期性刷新元数据。"],
        ["metadata.max.idle.ms", "5m", "Topic 长时间空闲后可从缓存移除。"]
      ]
    },
    {
      nav: "序列化 Key / Value / Header",
      kicker: "03 · SERIALIZATION",
      title: "对象第一次变成字节",
      world: 1,
      scene: renderSerializationScene,
      principle: {
        heading: "Kafka 的边界是 byte[]",
        summary: "Key 与 Value 分别交给各自 Serializer。Header 的键是 String，值本来就是 byte[]，不会再次经过 Value Serializer。",
        flow: [
          "key.serializer 把 user-9527 转成 UTF-8 字节。",
          "value.serializer 把 OrderCreated 编码成 JSON 字节。",
          "Headers 原样携带其 byte[] 值。",
          "计算序列化后大小，超限会在客户端失败。"
        ],
        note: "Avro、Protobuf 等常与 Schema Registry 配合，在 Payload 前携带协议标记和 Schema ID。"
      },
      data: [
        ["Key bytes", "75 73 65 72 2D 39 35 32 37"],
        ["Value bytes", "7B 22 6F 72 64 65 72 49 64 ... 7D"],
        ["Header value", "byte[]（不经过 value.serializer）"],
        ["估算总大小", "约 168 bytes（含 Record 开销）"]
      ],
      config: [
        ["key.serializer", "StringSerializer", "决定 Key 的字节形式；它还会影响默认分区结果。"],
        ["value.serializer", "JsonSerializer<OrderCreated>", "决定 Value 的 wire format。"],
        ["max.request.size", "1 MiB", "Producer 单个请求允许的最大尺寸。"],
        ["schema.registry.url", "https://schema.internal", "使用 Schema Registry Serializer 时的服务地址。"]
      ]
    },
    {
      nav: "选择 Partition",
      kicker: "04 · PARTITIONING",
      title: "Key 决定消息去哪里",
      world: 1,
      scene: renderPartitionScene,
      principle: {
        heading: "顺序保证存在于分区内部",
        summary: "本例没有显式 partition，但存在 Key，因此默认逻辑会对序列化后的 Key bytes 做稳定哈希，并映射到可用分区。",
        flow: [
          "若显式指定 partition，直接使用它。",
          "否则存在 Key：对 keyBytes 做哈希。",
          "313,426,957 % 3 得到 P1。",
          "相同 Key 在分区数不变时通常落入相同分区。"
        ],
        note: "Topic 扩容会改变取模结果，相同 Key 可能迁移到新分区；这是生产设计中经常被忽略的顺序风险。"
      },
      data: [
        ["输入", "keyBytes(user-9527)"],
        ["Hash", "toPositive(murmur2) = 313426957"],
        ["分区数", "3"],
        ["结果", "Partition 1 · Leader Broker 2"]
      ],
      config: [
        ["partitioner.class", "Kafka 内置分区逻辑", "可替换，但自定义实现必须考虑可用分区、扩容和负载倾斜。"],
        ["partitioner.ignore.keys", "false", "启用后内置逻辑可忽略 Key，通常会破坏按 Key 分区的预期。"],
        ["partition", "null", "ProducerRecord 显式 partition 的优先级高于 Partitioner。"]
      ]
    },
    {
      nav: "批处理与压缩",
      kicker: "05 · RECORD ACCUMULATOR",
      title: "消息进入分区批次",
      world: 1,
      scene: renderBatchScene,
      principle: {
        heading: "Producer 的高吞吐来自批量发送",
        summary: "序列化后的消息按 TopicPartition 放入 RecordAccumulator。多个小 Record 组成 RecordBatch，并以批次为单位压缩和发送。",
        flow: [
          "为 orders.created-P1 找到或创建当前 Batch。",
          "把 Message #A1024 追加到 Batch。",
          "Batch 满、linger 到期或内存压力触发发送。",
          "Sender 线程取走 ready Batch。"
        ],
        note: "batch.size 不是“达到后才发送”的硬门槛；若没有等待条件，未填满的 Batch 也可以被发送。"
      },
      data: [
        ["队列维度", "TopicPartition → Deque<ProducerBatch>"],
        ["当前 Batch", "orders.created-P1 · 3 records"],
        ["压缩粒度", "RecordBatch"],
        ["内存来源", "BufferPool / buffer.memory"]
      ],
      config: [
        ["batch.size", "16 KiB", "单个分区 Batch 的目标上限。"],
        ["linger.ms", "5 ms", "允许短暂等待更多消息以提高批量度。"],
        ["compression.type", "zstd", "以 Batch 为单位压缩；吞吐、CPU 与网络的权衡。"],
        ["buffer.memory", "32 MiB", "Producer 用于暂存待发送 Record 的总内存近似上限。"],
        ["delivery.timeout.ms", "120s", "从 send 到最终成功或失败的总交付时间上限。"]
      ]
    },
    {
      nav: "网络请求与 Broker 入口",
      kicker: "06 · PRODUCE REQUEST",
      title: "Batch 穿过网络边界",
      world: 2,
      scene: renderNetworkScene,
      principle: {
        heading: "Sender 按 Broker 聚合请求",
        summary: "P1 的 Leader 是 Broker 2。Sender 将发往同一 Broker 的多个 Partition Batch 组装为 ProduceRequest，经 NetworkClient 发送。",
        flow: [
          "Sender 从 RecordAccumulator 取 ready Batch。",
          "按照目标 Leader Broker 分组。",
          "构造 ProduceRequest 并写入网络连接。",
          "Broker SocketServer 读取后进入请求队列。"
        ],
        note: "生产问题常卡在这条边界：元数据过期、连接抖动、请求排队、限流和请求超时都发生在此附近。"
      },
      data: [
        ["目标节点", "Broker 2 · leader of orders.created-P1"],
        ["请求", "ProduceRequest"],
        ["Correlation ID", "1842"],
        ["载荷", "TopicData → PartitionData → RecordBatch"]
      ],
      config: [
        ["request.timeout.ms", "30s", "等待 Broker 响应的最长时间。"],
        ["max.in.flight.requests.per.connection", "5", "单连接未响应请求上限；与重试、顺序和幂等性相关。"],
        ["retries", "由交付超时约束", "可重试错误会在 delivery.timeout.ms 内再次发送。"],
        ["connections.max.idle.ms", "9m", "空闲连接关闭阈值。"]
      ]
    },
    {
      nav: "Log Segment 内部存储",
      kicker: "07 · LOG STORAGE",
      title: "消息追加到磁盘日志",
      world: 2,
      scene: renderStorageScene,
      principle: {
        heading: "Kafka 的核心操作是顺序追加",
        summary: "Broker 校验请求并把 RecordBatch 追加到 Leader Partition 的 Active Segment，同时建立稀疏 Offset 和时间索引。",
        flow: [
          "KafkaApis 把请求交给 ReplicaManager。",
          "Leader 分配连续 Offset，本消息得到 offset=42。",
          "RecordBatch 追加到 .log 文件。",
          ".index 与 .timeindex 维护稀疏定位信息。"
        ],
        note: "Kafka 大量利用操作系统 Page Cache；确认语义不能简单理解为“每条消息都 fsync 一次”。"
      },
      data: [
        ["目录", "orders.created-1/"],
        ["Active Segment", "00000000000000000000.log"],
        ["消息 Offset", "42"],
        ["Batch 元数据", "CRC / attributes / timestamps / PID / sequence"],
        ["索引", ".index：offset→position · .timeindex：time→offset"]
      ],
      config: [
        ["log.segment.bytes", "1 GiB", "Segment 达到大小后滚动。"],
        ["log.segment.ms", "按集群策略", "即使未达到大小，也可按时间滚动。"],
        ["log.retention.ms", "7 days（示例）", "delete 策略下的时间保留窗口。"],
        ["cleanup.policy", "delete / compact", "决定按保留策略删除，还是按 Key 压缩。"],
        ["message.max.bytes", "Broker 限制", "Broker/Topic 接受的最大 RecordBatch 尺寸。"]
      ]
    },
    {
      nav: "副本复制与 ACK",
      kicker: "08 · REPLICATION & ACK",
      title: "副本追上，确认返回",
      world: 3,
      scene: renderReplicaScene,
      principle: {
        heading: "Follower 主动向 Leader 拉取",
        summary: "Leader 追加成功后，Follower Replica Fetcher 拉取新数据。满足 acks 和最小 ISR 条件后，ProduceResponse 才能返回成功。",
        flow: [
          "Broker 2 的 Leader 已拥有 offset 42。",
          "Broker 1、3 的 Follower 拉取并追加该 Batch。",
          "ISR 副本进度推动 High Watermark。",
          "acks=all 条件满足，Producer Future 完成。"
        ],
        note: "replication.factor 决定副本数量；min.insync.replicas 与 acks=all 一起决定可用性和丢失风险的边界。"
      },
      data: [
        ["Leader", "Broker 2"],
        ["ISR", "[2, 1, 3]"],
        ["LEO", "43"],
        ["High Watermark", "43"],
        ["ProduceResponse", "partition=1 · baseOffset=42 · error=NONE"]
      ],
      config: [
        ["acks", "all", "等待所有当前 ISR 副本满足确认条件。"],
        ["min.insync.replicas", "2", "ISR 少于 2 时拒绝 acks=all 的写入。"],
        ["replication.factor", "3", "P1 一共有 3 份副本。"],
        ["enable.idempotence", "true", "通过 Producer ID、Epoch 和 Sequence 抑制重试造成的重复写入。"]
      ]
    },
    {
      nav: "消费、反序列化与提交",
      kicker: "09 · CONSUMER",
      title: "字节重新变回业务对象",
      world: 4,
      scene: renderConsumerScene,
      principle: {
        heading: "拉取成功不等于业务处理成功",
        summary: "Consumer 从当前 Fetch Position 拉取 Batch，解压并反序列化 Key/Value。业务处理完成后，才应决定何时提交下一条 Offset。",
        flow: [
          "FetchRequest 从 P1 请求 offset 42。",
          "校验、解压并解析 RecordBatch。",
          "Deserializer 把 Key/Value 恢复为对象。",
          "处理成功后提交 offset 43，表示下一次从 43 开始。"
        ],
        note: "Header 仍以 String + byte[] 到达 ConsumerRecord。提交 offset 43，不是 42，是生产故障排查中的高频知识点。"
      },
      data: [
        ["ConsumerRecord", "topic=orders.created · partition=1 · offset=42"],
        ["Key", "user-9527"],
        ["Value", "OrderCreated{orderId=A1024, amount=99.80}"],
        ["Headers", "traceparent / tenant-id / content-type"],
        ["Commit", "orders.created-P1 → 43"]
      ],
      config: [
        ["group.id", "order-risk-service", "Consumer Group 的逻辑身份。"],
        ["enable.auto.commit", "false", "由业务处理边界显式决定提交时机。"],
        ["max.poll.records", "500", "一次 poll 返回的 Record 数量上限。"],
        ["max.poll.interval.ms", "5m", "两次 poll 间允许的最长业务处理时间。"],
        ["auto.offset.reset", "earliest / latest", "没有有效已提交 Offset 时从哪里开始。"],
        ["isolation.level", "read_committed", "事务场景下只读取已提交数据。"]
      ]
    }
  ];

  function escapeText(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function messageLabel() {
    return '<span class="message-id"><i class="message-glyph" aria-hidden="true"></i>Message #A1024</span>';
  }

  function renderOverviewScene() {
    return `
      <div class="scene-frame overview-scene">
        <div class="overview-intro">
          <div>
            <span class="eyebrow">ONE MESSAGE · END TO END</span>
            <strong>对象变字节，字节进日志，日志再变回对象</strong>
          </div>
          <div class="overview-legend" aria-label="路径图例">
            <span><i class="legend-line is-data"></i>消息路径</span>
            <span><i class="legend-line is-replica"></i>副本同步</span>
            <span><i class="legend-line is-control"></i>元数据 / Offset</span>
          </div>
        </div>

        <div class="overview-canvas">
          <button class="overview-system app-system" type="button" data-jump-step="1">
            <span class="system-type">BUSINESS APP</span>
            <strong>Order Service</strong>
            <code>OrderCreated<br />#A1024</code>
            <span class="drill-hint">查看 ProducerRecord →</span>
          </button>

          <div class="journey-arrow data-arrow" aria-hidden="true">
            <span>send()</span><i></i>
          </div>

          <button class="overview-system producer-system" type="button" data-jump-step="3">
            <span class="system-type">KAFKA PRODUCER</span>
            <strong>加工与路由</strong>
            <span class="micro-pipeline">
              <i>Serializer</i><i>Partitioner</i><i>Batch</i>
            </span>
            ${messageLabel()}
            <span class="drill-hint">进入 Producer →</span>
          </button>

          <div class="journey-arrow data-arrow" aria-hidden="true">
            <span>ProduceRequest</span><i></i>
          </div>

          <div class="cluster-system">
            <div class="cluster-heading">
              <div>
                <span class="system-type">KAFKA CLUSTER</span>
                <strong>Topic · orders.created</strong>
              </div>
              <span class="kraft-state">KRaft · metadata</span>
            </div>

            <button class="broker-grid" type="button" data-jump-step="7" aria-label="进入 Broker 与 Log Segment 细节">
              <span class="overview-broker">
                <b>Broker 1</b>
                <i><em>P0</em><small>Leader</small></i>
                <i class="replica-copy"><em>P1</em><small>Follower · 42</small></i>
                <i><em>P2</em><small>Follower</small></i>
              </span>
              <span class="overview-broker is-message-leader">
                <b>Broker 2</b>
                <i><em>P0</em><small>Follower</small></i>
                <i class="leader-record"><em>P1</em><small>Leader · #A1024 · 42</small></i>
                <i><em>P2</em><small>Follower</small></i>
              </span>
              <span class="overview-broker">
                <b>Broker 3</b>
                <i><em>P0</em><small>Follower</small></i>
                <i class="replica-copy"><em>P1</em><small>Follower · 42</small></i>
                <i><em>P2</em><small>Leader</small></i>
              </span>
            </button>

            <button class="replication-route" type="button" data-jump-step="8">
              <span><i></i>Follower 主动从 P1 Leader 拉取 · ISR [2,1,3]</span>
              <strong>查看副本与 ACK →</strong>
            </button>
            <div class="offset-store"><span>__consumer_offsets</span><code>order-risk-service · P1 → 43</code></div>
          </div>

          <div class="journey-arrow data-arrow" aria-hidden="true">
            <span>Fetch</span><i></i>
          </div>

          <button class="overview-system consumer-system" type="button" data-jump-step="9">
            <span class="system-type">CONSUMER GROUP</span>
            <strong>order-risk-service</strong>
            <span class="consumer-assignment"><i>C1 · P0/P2</i><i class="is-active">C2 · P1 · #A1024</i></span>
            <code>deserialize → process → commit 43</code>
            <span class="drill-hint">进入 Consumer →</span>
          </button>
        </div>

        <div class="overview-sequence" aria-label="消息的七个高层阶段">
          <span><b>1</b>创建 Record</span>
          <span><b>2</b>序列化</span>
          <span><b>3</b>选择 P1</span>
          <span><b>4</b>Leader 追加</span>
          <span><b>5</b>副本同步</span>
          <span><b>6</b>ACK</span>
          <span><b>7</b>消费并提交</span>
        </div>
      </div>`;
  }

  function renderRecordScene() {
    const selected = state.selectedField;
    const field = (name, value, valueClass) => `
      <button class="record-field ${selected === name ? "is-active" : ""}" type="button" data-record-field="${name}">
        <span class="field-name">${name}</span>
        <span class="field-value ${valueClass || ""}">${value}</span>
      </button>`;

    return `
      <div class="scene-frame record-layout">
        <div class="code-origin">
          <span class="origin-label">order-service / CheckoutHandler.java</span>
          <div class="code-window" aria-label="创建 ProducerRecord 的 Java 示例">
            <div class="window-bar"><i></i><i></i><i></i></div>
            <pre><span class="accent-code">OrderCreated</span> event =
  new OrderCreated("A1024", 99.80);

var record = new ProducerRecord&lt;&gt;(
  "orders.created",
  "user-9527",
  event
);</pre>
          </div>
          <div class="send-call"><span>producer.send(record)</span></div>
        </div>

        <div class="record-sheet">
          <div class="record-header">
            ${messageLabel()}
            <span class="record-type">ProducerRecord&lt;K,V&gt;</span>
          </div>
          <div class="record-fields">
            ${field("topic", "orders.created")}
            ${field("partition", "null · 自动选择", "is-null")}
            ${field("timestamp", "null · 稍后补充", "is-null")}
            ${field("key", '"user-9527"')}
            ${field("value", "OrderCreated { A1024, 99.80 }")}
            ${field("headers", "traceparent · tenant-id · content-type")}
          </div>
        </div>
      </div>`;
  }

  function renderInterceptorScene() {
    return `
      <div class="scene-frame">
        <div class="pipeline" style="--columns: 3">
          <div class="flow-node">
            <div class="flow-node-title"><span>业务 Record</span><small>INPUT</small></div>
            ${messageLabel()}
            <div class="data-chip-list">
              <div class="data-chip key"><span>key</span><strong>user-9527</strong></div>
              <div class="data-chip value"><span>value</span><strong>OrderCreated</strong></div>
            </div>
          </div>
          <div class="flow-node is-focus">
            <div class="flow-node-title"><span>ProducerInterceptor</span><small>onSend()</small></div>
            <div class="data-chip-list">
              <div class="data-chip header"><span>+ header</span><strong>traceparent</strong></div>
              <div class="data-chip header"><span>+ header</span><strong>tenant-id</strong></div>
              <div class="data-chip header"><span>+ header</span><strong>content-type</strong></div>
            </div>
          </div>
          <div class="flow-node">
            <div class="flow-node-title"><span>Metadata Cache</span><small>ROUTING</small></div>
            <div class="data-chip-list">
              <div class="data-chip"><span>P0</span><strong>Leader B1</strong></div>
              <div class="data-chip"><span>P1</span><strong>Leader B2</strong></div>
              <div class="data-chip"><span>P2</span><strong>Leader B3</strong></div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderSerializationScene() {
    const bytes = ["7B", "22", "6F", "72", "64", "65", "72", "49", "64", "22", "3A", "22", "41", "31", "30", "32", "34", "22"];
    return `
      <div class="scene-frame">
        <div class="pipeline" style="--columns: 3">
          <div class="flow-node">
            <div class="flow-node-title"><span>JVM 对象</span><small>BEFORE</small></div>
            <div class="data-chip-list">
              <div class="data-chip key"><span>key</span><strong>String</strong></div>
              <div class="data-chip value"><span>value</span><strong>OrderCreated</strong></div>
              <div class="data-chip header"><span>headers</span><strong>String + byte[]</strong></div>
            </div>
          </div>
          <div class="transformer">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h12M12 3l4 4-4 4M20 17H8M12 13l-4 4 4 4"></path></svg>
            <span>serialize()</span>
          </div>
          <div class="flow-node is-focus">
            <div class="flow-node-title"><span>Wire bytes</span><small>AFTER</small></div>
            ${messageLabel()}
            <div class="byte-strip">${bytes.map((byte) => `<i>${byte}</i>`).join("")}</div>
            <div class="data-chip header"><span>headers</span><strong>already byte[]</strong></div>
          </div>
        </div>
      </div>`;
  }

  function renderPartitionScene() {
    return `
      <div class="scene-frame">
        <div class="decision-tree">
          <div class="decision-node">
            ${messageLabel()}
            <strong>keyBytes</strong>
            <code>75 73 65 72 2D...</code>
          </div>
          <span class="arrow" aria-hidden="true">→</span>
          <div class="decision-node">
            <strong>Murmur2</strong>
            <code>toPositive(hash)</code>
            <code>= 313426957</code>
          </div>
          <span class="arrow" aria-hidden="true">→</span>
          <div class="decision-node is-result">
            <strong>313426957 % 3</strong>
            <code>= Partition 1</code>
          </div>
        </div>
        <div class="partition-row" aria-label="Topic orders.created 的三个分区">
          <div class="partition">orders.created · P0</div>
          <div class="partition is-selected">${messageLabel()}<br />orders.created · P1</div>
          <div class="partition">orders.created · P2</div>
        </div>
      </div>`;
  }

  function renderBatchScene() {
    return `
      <div class="scene-frame accumulator-layout">
        <div class="incoming-records">
          <span class="eyebrow">SERIALIZED RECORDS</span>
          <div class="mini-record"><i class="message-glyph"></i><span>#A1022</span><small>P1</small></div>
          <div class="mini-record"><i class="message-glyph"></i><span>#A1023</span><small>P1</small></div>
          <div class="mini-record is-message"><i class="message-glyph"></i><span>#A1024</span><small>P1</small></div>
        </div>
        <div class="accumulator">
          <div class="accumulator-title">
            <strong>RecordAccumulator</strong>
            <code>buffer.memory · 32 MiB</code>
          </div>
          <div class="batch-lane">
            <span>P0 deque</span>
            <div class="batch"><i class="batch-unit">...</i><i class="batch-unit">...</i></div>
          </div>
          <div class="batch-lane">
            <span>P1 deque</span>
            <div class="batch">
              <i class="batch-unit">22</i><i class="batch-unit">23</i><i class="batch-unit is-message">24</i><i class="batch-unit">free</i>
            </div>
          </div>
          <div class="batch-lane">
            <span>P2 deque</span>
            <div class="batch"><i class="batch-unit">...</i><i class="batch-unit">free</i></div>
          </div>
        </div>
      </div>`;
  }

  function renderNetworkScene() {
    return `
      <div class="scene-frame network-layout">
        <div class="stack">
          <div class="stack-layer"><span>RecordAccumulator</span><code>P1 Batch</code></div>
          <div class="stack-layer is-focus"><span>Sender</span><code>ready → drain</code></div>
          <div class="stack-layer"><span>NetworkClient</span><code>node 2</code></div>
        </div>
        <div class="request-packet">
          <svg viewBox="0 0 32 24" aria-hidden="true"><path d="M2 5h28v14H2zM3 6l13 9L29 6"></path></svg>
          <span>ProduceRequest #1842</span>
          ${messageLabel()}
        </div>
        <div class="stack">
          <div class="stack-layer is-focus"><span>SocketServer</span><code>network thread</code></div>
          <div class="stack-layer"><span>RequestChannel</span><code>queue</code></div>
          <div class="stack-layer"><span>KafkaApis</span><code>handler</code></div>
        </div>
      </div>`;
  }

  function renderStorageScene() {
    return `
      <div class="scene-frame storage-layout">
        <div class="broker-pipeline">
          <span class="eyebrow">BROKER 2 · REQUEST PATH</span>
          <div class="broker-stage">SocketServer</div>
          <div class="broker-stage">RequestChannel</div>
          <div class="broker-stage">KafkaApis</div>
          <div class="broker-stage">ReplicaManager</div>
          <div class="broker-stage is-active">UnifiedLog.appendAsLeader()</div>
        </div>
        <div class="log-folder">
          <div class="folder-title">
            <strong>orders.created-1/</strong>
            <span>active segment</span>
          </div>
          <div class="segment-files">
            <div class="segment-file">00000000000000000000.log</div>
            <div class="segment-file">00000000000000000000.index</div>
            <div class="segment-file">00000000000000000000.timeindex</div>
          </div>
          <div class="log-records" aria-label="顺序追加日志">
            <div class="log-record">38</div>
            <div class="log-record">39</div>
            <div class="log-record">40</div>
            <div class="log-record">41</div>
            <div class="log-record is-message">42</div>
          </div>
          <div class="offset-pointer">▲ Message #A1024 · offset 42</div>
        </div>
      </div>`;
  }

  function renderReplicaScene() {
    const broker = (id, role, delay) => `
      <div class="broker-box ${role === "LEADER" ? "is-leader" : ""}">
        <div class="broker-name"><span>Broker ${id}</span><span class="role-label">${role}</span></div>
        <div class="isr-state">
          <div class="replica-record"><span>offset 41</span><span>✓</span></div>
          <div class="replica-record is-message" style="animation-delay:${delay}ms"><span>offset 42</span><span>#A1024</span></div>
        </div>
        <div class="ack-line"><span>${role === "LEADER" ? "ACK → Producer" : "ISR · synced"}</span></div>
      </div>`;
    return `
      <div class="scene-frame replica-layout">
        ${broker(2, "LEADER", 0)}
        ${broker(1, "FOLLOWER", 180)}
        ${broker(3, "FOLLOWER", 360)}
      </div>`;
  }

  function renderConsumerScene() {
    return `
      <div class="scene-frame consumer-layout">
        <div class="consumer-stage">
          <h3>FetchResponse</h3>
          ${messageLabel()}
          <code>P1 · offset 42 · compressed RecordBatch</code>
        </div>
        <span class="arrow" aria-hidden="true">→</span>
        <div class="consumer-stage is-focus">
          <h3>Deserializer</h3>
          <code>StringDeserializer(key)</code>
          <code>JsonDeserializer(value)</code>
          <code>Headers → byte[]</code>
        </div>
        <span class="arrow" aria-hidden="true">→</span>
        <div class="consumer-stage">
          <h3>业务对象</h3>
          <div class="object-preview">
            <span>key <strong>user-9527</strong></span>
            <span>orderId <strong>A1024</strong></span>
            <span>amount <strong>99.80</strong></span>
            <span>commit <strong>offset 43</strong></span>
          </div>
        </div>
      </div>`;
  }

  function renderLessonList() {
    lessonList.innerHTML = steps
      .map((step, index) => `
        <button
          class="lesson-button ${index < state.step ? "is-complete" : ""}"
          type="button"
          data-step="${index}"
          ${index === state.step ? 'aria-current="step"' : ""}
        >
          <span class="lesson-number">${index < state.step ? "✓" : String(index).padStart(2, "0")}</span>
          <span class="lesson-title">${escapeText(step.nav)}</span>
        </button>`)
      .join("");

    lessonList.querySelectorAll("[data-step]").forEach((button) => {
      button.addEventListener("click", () => setStep(Number(button.dataset.step)));
    });
  }

  function renderWorldMap() {
    const current = steps[state.step];
    const currentWorld = current.world;
    worldMap.innerHTML = worldStops
      .map((name, index) => `
        <div class="world-stop ${current.id === "overview" ? "is-overview" : ""} ${index === currentWorld ? "is-active" : ""} ${index < currentWorld ? "is-past" : ""}">
          <span>${escapeText(name)}</span>
        </div>`)
      .join("");
  }

  function renderInspector() {
    inspectorTabs.forEach((tab) => {
      const selected = tab.dataset.panel === state.panel;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    if (steps[state.step].id === "record" && state.panel === "data") {
      const selected = recordFieldDetails[state.selectedField];
      inspectorContent.innerHTML = `
        <section class="inspector-section">
          <span class="inspector-label">SELECTED FIELD</span>
          <h2>${escapeText(selected.title)}</h2>
          <p>${escapeText(selected.summary)}</p>
          <ul class="fact-list">
            ${selected.facts.map(([label, value]) => `<li><span>${escapeText(label)}</span><code>${escapeText(value)}</code></li>`).join("")}
          </ul>
          <div class="production-note"><strong>生产提示</strong>${escapeText(selected.note)}</div>
        </section>`;
      return;
    }

    const current = steps[state.step];
    if (state.panel === "principle") {
      inspectorContent.innerHTML = `
        <section class="inspector-section">
          <span class="inspector-label">WHAT & WHY</span>
          <h2>${escapeText(current.principle.heading)}</h2>
          <p>${escapeText(current.principle.summary)}</p>
          <ol class="process-list">
            ${current.principle.flow.map((item) => `<li>${escapeText(item)}</li>`).join("")}
          </ol>
          <div class="production-note"><strong>生产提示</strong>${escapeText(current.principle.note)}</div>
        </section>`;
      return;
    }

    if (state.panel === "data") {
      inspectorContent.innerHTML = `
        <section class="inspector-section">
          <span class="inspector-label">MESSAGE STATE</span>
          <h2>此刻的数据形态</h2>
          <ul class="fact-list">
            ${current.data.map(([label, value]) => `<li><span>${escapeText(label)}</span><code>${escapeText(value)}</code></li>`).join("")}
          </ul>
        </section>`;
      return;
    }

    inspectorContent.innerHTML = `
      <section class="inspector-section">
        <span class="inspector-label">PRODUCTION CONFIG</span>
        <h2>真正影响这一步的设置</h2>
        <div class="config-list">
          ${current.config.map(([name, value, help]) => `
            <div class="config-item">
              <span>${escapeText(name)}</span>
              <code>${escapeText(value)}</code>
              <p>${escapeText(help)}</p>
            </div>`).join("")}
        </div>
      </section>`;
  }

  function bindSceneInteractions() {
    scene.querySelectorAll("[data-record-field]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedField = button.dataset.recordField;
        state.panel = "data";
        renderScene();
        renderInspector();
      });
    });

    scene.querySelectorAll("[data-jump-step]").forEach((button) => {
      button.addEventListener("click", () => {
        stopPlayback();
        setStep(Number(button.dataset.jumpStep));
      });
    });
  }

  function renderScene() {
    const current = steps[state.step];
    stepKicker.textContent = current.kicker;
    stepTitle.textContent = current.title;
    learningStage.classList.toggle("is-overview", current.id === "overview");
    overviewModeButton.setAttribute("aria-pressed", String(current.id === "overview"));
    detailModeButton.setAttribute("aria-pressed", String(current.id !== "overview"));
    scene.innerHTML = current.scene();
    bindSceneInteractions();
  }

  function renderTransport() {
    timeline.max = String(steps.length - 1);
    timeline.value = String(state.step);
    timelineText.textContent = state.step === 0 ? "全景总览" : `细节 ${state.step} / ${steps.length - 1}`;
    previousButton.disabled = state.step === 0;
    nextButton.disabled = state.step === steps.length - 1;
    playButton.classList.toggle("is-playing", state.playing);
    playButton.setAttribute("aria-label", state.playing ? "暂停" : "播放");
  }

  function renderAll() {
    renderLessonList();
    renderWorldMap();
    renderScene();
    renderInspector();
    renderTransport();
    root.style.setProperty("--current-step", String(state.step));
  }

  function setStep(nextStep) {
    state.step = Math.max(0, Math.min(steps.length - 1, nextStep));
    if (state.step > 0) state.lastDetailStep = state.step;
    renderAll();
    if (state.playing) scheduleNext();
  }

  function scheduleNext() {
    window.clearTimeout(state.timer);
    if (!state.playing) return;
    if (state.step >= steps.length - 1) {
      stopPlayback();
      return;
    }
    state.timer = window.setTimeout(() => setStep(state.step + 1), 2800 / state.speed);
  }

  function startPlayback() {
    if (state.step >= steps.length - 1) state.step = 0;
    state.playing = true;
    renderAll();
    scheduleNext();
  }

  function stopPlayback() {
    state.playing = false;
    window.clearTimeout(state.timer);
    renderTransport();
  }

  previousButton.addEventListener("click", () => {
    stopPlayback();
    setStep(state.step - 1);
  });

  nextButton.addEventListener("click", () => {
    stopPlayback();
    setStep(state.step + 1);
  });

  playButton.addEventListener("click", () => {
    if (state.playing) stopPlayback();
    else startPlayback();
  });

  timeline.addEventListener("input", (event) => {
    stopPlayback();
    setStep(Number(event.target.value));
  });

  speedSelect.addEventListener("change", (event) => {
    state.speed = Number(event.target.value);
    if (state.playing) scheduleNext();
  });

  overviewModeButton.addEventListener("click", () => {
    stopPlayback();
    setStep(0);
  });

  detailModeButton.addEventListener("click", () => {
    stopPlayback();
    setStep(state.lastDetailStep);
  });

  inspectorTabs.forEach((tab, tabIndex) => {
    tab.addEventListener("click", () => {
      state.panel = tab.dataset.panel;
      renderInspector();
    });
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (tabIndex + direction + inspectorTabs.length) % inspectorTabs.length;
      inspectorTabs[nextIndex].click();
      inspectorTabs[nextIndex].focus();
    });
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

  renderAll();
})();

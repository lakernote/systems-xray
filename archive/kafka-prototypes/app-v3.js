(function () {
  'use strict';

  var commit = '80a74f3b84525563ef060b6e0e1b70bc127ec064';
  function source(path, start, end) {
    return 'https://github.com/apache/kafka/blob/' + commit + '/' + path + '#L' + start + '-L' + (end || start);
  }

  var steps = [
    {
      scene: 'overview', phase: 0, zone: '集群定位', title: '先只看五个物理边界',
      summary: '三台 Producer 共享一个 Kafka 集群；六个 Partition 分布在三台 Broker；两个 Consumer Group 会各自读取同一条 Event。',
      form: 'ProducerRecord · 尚未发送', position: [198, 286], route: 'overview-producer', focus: ['overview-producer-2'],
      remember: ['一条消息只由一台 Producer 发出', '它只写入一个 Partition Leader', '每个 Consumer Group 都能独立读到它'],
      input: 'OrderCreated Java object', output: 'ProducerRecord(topic, key, value, headers)',
      configs: [['producers', '3 instances'], ['brokers', '3 nodes'], ['partitions', '6 · RF=3'], ['consumer groups', '2 independent']],
      gain: '先建立故障域、网络边界和并行度的全局坐标。', cost: '这层不展示线程、内存页和文件位置；需要逐层进入。',
      code: '// 本次只追踪 order-service 产生的一条消息\nEvent id = #A1024\nTopic = orders.created\nKey = user-9527', source: null
    },
    {
      scene: 'producer', phase: 0, zone: '业务代码', title: '我在 send(record) 这一行诞生',
      summary: '业务代码组装 topic、key、value、headers。此时我仍是 Producer JVM Heap 里的对象，没有 Partition，也没有 Offset。',
      form: 'ProducerRecord<String, OrderCreated>', position: [210, 260], route: 'producer-create', focus: ['producer-code'],
      remember: ['Key 用于选择 Partition', 'Value 是业务对象，稍后才序列化', 'Header 适合追踪、租户与内容类型'],
      input: 'OrderCreated event', output: 'ProducerRecord<String, OrderCreated>',
      configs: [['topic', 'orders.created'], ['partition', 'null · 自动选择'], ['timestamp', 'null · Broker/Client 补充'], ['headers', 'traceparent · tenant-id · content-type']],
      gain: '统一信封把业务事件与 Kafka 发送 API 对齐。', cost: '字段自由意味着团队必须自己治理 Key、Header 与 Schema。',
      code: '// Key 决定分区，也决定同一用户的局部顺序\nString key = "user-9527";\n\n// Header 从 API 层开始就是 byte[]\nProducerRecord<String, OrderCreated> record =\n    new ProducerRecord<>("orders.created", null, key, event, headers);\n\n// 异步：Future 返回不等于 Broker 已确认\nproducer.send(record, callback);',
      source: source('clients/src/main/java/org/apache/kafka/clients/producer/ProducerRecord.java', 49, 156)
    },
    {
      scene: 'producer', phase: 0, zone: '序列化', title: 'Java 对象在这里变成 byte[]',
      summary: 'Key 和 Value 分别序列化。跨进程传播的是字节与 Schema，而不是 JVM 对象。',
      form: 'Serialized Record · key/value bytes', position: [438, 285], route: 'producer-serialize', focus: ['producer-serializer'],
      remember: ['Key 的真实字节参与哈希', 'Value 格式决定体积和兼容性', '毒消息通常来自 Schema 不兼容'],
      input: 'String + OrderCreated', output: 'keyBytes + valueBytes + header bytes',
      configs: [['key.serializer', 'StringSerializer'], ['value.serializer', 'JSON / Avro / Protobuf'], ['request.max.bytes', '1 MiB · 示例']],
      gain: '形成稳定、跨语言的传输格式。', cost: '压缩率、CPU、可读性和 Schema 演进无法同时最优。',
      code: 'byte[] keyBytes = keySerializer.serialize(topic, headers, key);\nbyte[] valueBytes = valueSerializer.serialize(topic, headers, event);',
      source: source('clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java', 1188, 1229)
    },
    {
      scene: 'producer', phase: 0, zone: '选择分区', title: '六个 Partition 中，我被路由到 P1',
      summary: 'Partition 未显式指定时，Producer 使用序列化后的 Key 做哈希；user-9527 稳定落到 P1。',
      form: 'TopicPartition · orders.created-1', position: [655, 285], route: 'producer-partition', focus: ['producer-partitioner', 'producer-p1'],
      remember: ['相同 Key 通常进入同一 Partition', 'Kafka 只保证 Partition 内顺序', '增加分区会改变取模结果'],
      input: 'keyBytes + partition count 6', output: 'TopicPartition P1',
      configs: [['partition', 'null'], ['partitioner.ignore.keys', 'false'], ['num.partitions', '6']],
      gain: '获得 Key 亲和、局部顺序和水平并行。', cost: '热门 Key 会形成热点；分区扩容后 Key 映射可能改变。',
      code: 'int partition = Utils.toPositive(\n    Utils.murmur2(keyBytes)\n) % 6; // → P1',
      source: source('clients/src/main/java/org/apache/kafka/clients/producer/internals/BuiltInPartitioner.java', 404, 416)
    },
    {
      scene: 'producer', phase: 0, zone: '客户端缓冲', title: '我进入 P1 专属 ProducerBatch',
      summary: 'RecordAccumulator 按 TopicPartition 维护队列。我会与邻近记录共享 ByteBuffer、压缩和一次 ProduceRequest。',
      form: 'ProducerBatch · P1 · zstd', position: [846, 285], route: 'producer-batch', focus: ['producer-accumulator'],
      remember: ['Batch 是按 TopicPartition 聚合的', 'batch.size 是上限，不保证填满', 'linger.ms 用少量等待换吞吐'],
      input: 'serialized record + P1', output: 'ProducerBatch in P1 deque',
      configs: [['batch.size', '16 KiB'], ['linger.ms', '5 ms'], ['buffer.memory', '32 MiB'], ['compression.type', 'zstd']],
      gain: '摊薄请求开销，提高压缩率、网络与磁盘吞吐。', cost: '更大 Batch 和 linger 会增加低流量消息等待时间。',
      code: 'RecordAppendResult result = accumulator.append(\n    topicPartition, timestamp, keyBytes, valueBytes, headers, callback\n);',
      source: source('clients/src/main/java/org/apache/kafka/clients/producer/internals/RecordAccumulator.java', 250, 380)
    },
    {
      scene: 'producer', phase: 0, zone: 'Sender 线程', title: '后台线程 Drain P1 Batch',
      summary: '业务线程已经放手。Sender 选择已就绪的 Batch，处理重试、in-flight，并构造 ProduceRequest。',
      form: 'ProduceRequest · correlation 1842', position: [765, 438], route: 'producer-sender', focus: ['producer-sender'],
      remember: ['send() 与网络发送不在同一线程', 'acks=all 决定确认边界', '重试必须与幂等性一起理解'],
      input: 'ready ProducerBatch', output: 'ProduceRequest for Broker 2',
      configs: [['acks', 'all'], ['retries', 'max'], ['enable.idempotence', 'true'], ['max.in.flight.requests.per.connection', '5']],
      gain: '业务调用与网络 I/O 解耦，并统一处理批量与重试。', cost: '排队、重试和 in-flight 让延迟与顺序边界更复杂。',
      code: '// kafka-producer-network-thread\nRecordAccumulator.ReadyCheckResult ready = accumulator.ready(metadata);\nMap<Integer, List<ProducerBatch>> batches = accumulator.drain(...);',
      source: source('clients/src/main/java/org/apache/kafka/clients/producer/internals/Sender.java', 350, 460)
    },
    {
      scene: 'producer', phase: 1, zone: '主机出口', title: '协议字节进入 Linux 与 NIC',
      summary: 'NetworkClient 编码 Kafka Protocol Frame，经 TLS/TCP、Socket Send Buffer 和网卡离开 Producer 主机。',
      form: 'Encrypted TCP bytes', position: [1012, 495], route: 'producer-nic', focus: ['producer-network', 'producer-nic'],
      remember: ['Kafka 请求复用长连接', 'Socket Buffer 属于内核，不是 JVM Heap', '交换机只看到网络包，不懂 Topic'],
      input: 'ProduceRequest', output: 'Ethernet frames → Broker 2',
      configs: [['security.protocol', 'SASL_SSL'], ['send.buffer.bytes', '128 KiB'], ['connections.max.idle.ms', '9 min']],
      gain: '标准 TCP/TLS 提供跨主机传输、安全和流量控制。', cost: 'TLS、拥塞、丢包与重传都会放大尾延迟。',
      code: 'NetworkSend send = request.toSend(header);\nselector.send(send);\n// userspace → socket buffer → NIC',
      source: source('clients/src/main/java/org/apache/kafka/clients/NetworkClient.java', 520, 620)
    },
    {
      scene: 'overview', phase: 1, zone: '物理网络', title: '我只被发送到 P1 Leader 所在的 Broker 2',
      summary: 'Producer 已通过元数据知道 P1 Leader 是 Broker 2，所以流量穿过 ToR Switch 定向进入 10.20.8.22:9093。',
      form: 'TCP stream · Producer 2 → Broker 2', position: [405, 286], route: 'overview-network', focus: ['overview-switch', 'overview-broker-2'],
      remember: ['不是广播给所有 Broker', '目标 Broker 由 Partition Leader 决定', 'Broker 1/3 稍后通过副本 Fetch 获取数据'],
      input: 'frames from 10.20.4.17', output: 'frames to 10.20.8.22:9093',
      configs: [['bootstrap.servers', 'B1,B2,B3'], ['metadata.max.age.ms', '5 min'], ['client.dns.lookup', 'use_all_dns_ips']],
      gain: '客户端直接连接 Leader，数据路径短。', cost: 'Leader 迁移后客户端必须刷新元数据并重试。',
      code: 'Metadata: orders.created-P1 → leader Broker 2\nTCP: 10.20.4.17:49152 → 10.20.8.22:9093', source: null
    },
    {
      scene: 'broker', phase: 2, zone: 'Broker 网络入口', title: 'Broker NIC 与 SocketServer 收到请求',
      summary: '网卡、内核 Receive Buffer、Kafka Processor 依次交接完整请求；网络线程不会直接完成日志追加。',
      form: 'RequestChannel.Request', position: [160, 315], route: 'broker-receive', focus: ['broker-nic', 'broker-socket'],
      remember: ['网络 Processor 与 API Handler 分工', 'RequestChannel 是排队边界', '网络线程拥塞会影响所有 API'],
      input: 'TLS/TCP Kafka frame', output: 'decoded Produce request',
      configs: [['num.network.threads', '3'], ['queued.max.requests', '500'], ['socket.receive.buffer.bytes', '100 KiB']],
      gain: '网络收发与请求处理隔离。', cost: '队列过长会隐藏过载并增加延迟。',
      code: 'NetworkReceive receive = selector.completedReceives();\nrequestChannel.sendRequest(request);',
      source: source('core/src/main/scala/kafka/network/SocketServer.scala', 719, 820)
    },
    {
      scene: 'broker', phase: 2, zone: '请求处理', title: 'RequestChannel 把请求交给 KafkaApis',
      summary: 'Handler 线程执行认证、授权、配额和 Produce API 分派，然后交给 ReplicaManager。',
      form: 'KafkaApis.handleProduceRequest', position: [380, 270], route: 'broker-handler', focus: ['broker-request', 'broker-apis'],
      remember: ['Request Queue Time 是关键延迟指标', 'API Handler 处理多类请求', '授权和配额发生在追加之前'],
      input: 'RequestChannel.Request', output: 'validated Produce partition data',
      configs: [['num.io.threads', '8'], ['request.timeout.ms', '30 s'], ['producer_byte_rate', 'quota']],
      gain: '统一实现安全、配额与协议语义。', cost: '慢 Handler 会造成请求排队并传播背压。',
      code: 'case ApiKeys.PRODUCE =>\n  handleProduceRequest(request, requestLocal)',
      source: source('core/src/main/scala/kafka/server/KafkaApis.scala', 690, 820)
    },
    {
      scene: 'broker', phase: 2, zone: 'P1 Leader', title: 'P1 Leader 为我分配 offset 42',
      summary: '六个 Partition 各有独立日志。只有 Broker 2 上的 P1 Leader 决定这条消息在 P1 中的顺序。',
      form: 'MemoryRecords · baseOffset 42', position: [600, 270], route: 'broker-leader', focus: ['broker-replica', 'broker-p1'],
      remember: ['Offset 只在 P1 内有意义', 'P1 LEO 从 42 推进到 43', 'minISR 与 acks=all 共同定义可写门槛'],
      input: 'P1 record batch', output: 'batch with baseOffset 42',
      configs: [['replication.factor', '3'], ['min.insync.replicas', '2'], ['acks', 'all']],
      gain: '单 Leader 简化分区内排序和并发控制。', cost: '单个热门 Partition 的写入受一个 Leader 上限约束。',
      code: 'appendInfo = partition.appendRecordsToLeader(\n    records, origin, requiredAcks\n); // baseOffset = 42',
      source: source('core/src/main/scala/kafka/cluster/Partition.scala', 1290, 1400)
    },
    {
      scene: 'broker', phase: 2, zone: '日志追加', title: 'UnifiedLog 把逻辑 Offset 交给本地日志',
      summary: '上层使用 offset 42；LocalLog 选择当前 Active Segment，并把 RecordBatch 顺序追加到文件。',
      form: 'FileRecords append · position 8192', position: [820, 270], route: 'broker-log', focus: ['broker-log'],
      remember: ['Event 不会单独成为一个文件', 'RecordBatch 才是压缩和 CRC 单元', 'Segment 是日志滚动与删除单元'],
      input: 'MemoryRecords · offset 42', output: 'active segment append at byte 8192',
      configs: [['segment.bytes', '1 GiB'], ['segment.ms', '7 days'], ['index.interval.bytes', '4096']],
      gain: '顺序追加简单、高吞吐，并适配 Page Cache。', cost: '按 offset 查找需要 Segment、稀疏索引和批次扫描。',
      code: 'localLog.append(\n    appendInfo.lastOffset, appendInfo.maxTimestamp, validRecords\n);',
      source: source('storage/src/main/java/org/apache/kafka/storage/internals/log/UnifiedLog.java', 1200, 1310)
    },
    {
      scene: 'storage', phase: 3, zone: '逻辑 ↔ 物理映射', title: 'offset 42 最终对应 RAM 页、Extent 与 LBA',
      summary: 'Topic/P1/Segment 是 Kafka 逻辑地址；文件位置 8192 映射到 Page Cache page 2、XFS extent，再由 NVMe Controller 写入 LBA。',
      form: 'dirty Page Cache page · later writeback', position: [772, 456], route: 'storage-map', focus: ['storage-page', 'storage-xfs', 'storage-nvme'],
      remember: ['ACK 通常不等于每条消息已 fsync', '热写入先命中 RAM Page Cache', 'Topic 不是 NVMe 里的一个物理盒子'],
      input: 'segment file position 8192', output: 'dirty 4 KiB page → LBA 884736',
      configs: [['log.dirs', '/var/lib/kafka/data'], ['filesystem', 'XFS'], ['vm.dirty_*', 'Linux writeback policy'], ['log.flush.interval.messages', 'unset']],
      gain: '写入和读取共享文件页，顺序 I/O、预读和批量回写效率高。', cost: '确认边界依赖副本语义；主机内存压力和回写抖动会影响尾延迟。',
      code: '/var/lib/kafka/data/orders.created-1/\n  00000000000000000000.log\n\noffset 42 → .index → file position 8192\nposition 8192 → page index 2 → XFS extent → LBA 884736', source: null
    },
    {
      scene: 'overview', phase: 2, zone: '副本与 ACK', title: 'Broker 1 和 3 各自保存 P1 Follower',
      summary: 'Follower 主动向 Leader 拉取 Batch，分别写入自己的 Page Cache 与 Segment；满足 acks=all 条件后 Producer 才得到确认。',
      form: 'P1 replicas · B1/B2/B3 · HW 43', position: [687, 334], route: 'overview-replica', focus: ['overview-broker-1', 'overview-broker-2', 'overview-broker-3'],
      remember: ['RF=3 是三份独立副本', 'Follower 通过 Fetch 拉取，不是 Leader 主动推送', 'HW 表示所有已提交读取者都可见的边界'],
      input: 'Leader P1 LEO 43', output: 'ISR [B1,B2,B3] · HW 43 · ProduceResponse',
      configs: [['replication.factor', '3'], ['min.insync.replicas', '2'], ['replica.lag.time.max.ms', '30 s']],
      gain: '一台 Broker 故障后仍有同步副本可选主。', cost: '网络、内存与磁盘容量开销接近副本倍数。',
      code: 'P1 replicas = [B1 follower, B2 leader, B3 follower]\nISR = [1, 2, 3]\nHighWatermark = 43', source: null
    },
    {
      scene: 'overview', phase: 4, zone: 'Consumer Group', title: '同一条 Event 会被两个 Group 各读一次',
      summary: 'Group A 中 A2 负责 P1/P4；Group B 中 B2 负责 P1/P3/P5。组内不重复，组间拥有独立位置。',
      form: 'Fetch P1@42 · two independent groups', position: [1010, 302], route: 'overview-consume', focus: ['overview-consumer-a2', 'overview-consumer-b2'],
      remember: ['Partition 在一个 Group 内只分配给一个 Consumer', '不同 Group 不会互相抢消息', 'Consumer 数量超过 Partition 后会有实例空闲'],
      input: 'P1 log · offset 42', output: 'A2 copy + B2 copy',
      configs: [['group.id A', 'order-risk-service'], ['group.id B', 'analytics-etl'], ['partition.assignment.strategy', 'cooperative-sticky']],
      gain: '同一份日志可以同时支持风控、分析等多个独立用途。', cost: '每个 Group 都会产生自己的 Fetch 流量、Lag 和业务副作用。',
      code: 'Group A: A1=[P0,P3] A2=[P1,P4] A3=[P2,P5]\nGroup B: B1=[P0,P2,P4] B2=[P1,P3,P5]', source: null
    },
    {
      scene: 'consumer', phase: 4, zone: 'Fetch 路径', title: 'Consumer A2 主动拉取 P1@42',
      summary: 'Broker 按 Segment 文件位置读取。热页直接从 Page Cache 返回；缺页时才触发 XFS/NVMe 读取。',
      form: 'FetchResponse · RecordBatch', position: [318, 296], route: 'consumer-fetch', focus: ['consumer-fetcher'],
      remember: ['Kafka Consumer 是 pull 模型', '热读路径是 Page Cache → Socket', '冷读路径才访问 NVMe'],
      input: 'FetchRequest(P1, offset=42)', output: 'RecordBatch bytes',
      configs: [['fetch.min.bytes', '1'], ['fetch.max.wait.ms', '500 ms'], ['max.partition.fetch.bytes', '1 MiB']],
      gain: 'Consumer 自己控制节奏，Broker 可合并更多数据返回。', cost: '参数过大提高吞吐但增加等待与单次内存占用。',
      code: 'FetchRequest: P1 @ offset 42\nBroker: position = index.lookup(42)\nHot: Page Cache → socket\nCold: NVMe → Page Cache → socket',
      source: source('core/src/main/scala/kafka/server/AbstractFetch.java', 150, 300)
    },
    {
      scene: 'consumer', phase: 4, zone: '恢复业务对象', title: '解析 Batch，再反序列化为 OrderCreated',
      summary: 'Consumer 校验 CRC、解压并迭代记录，恢复 key/value/header 字节；Deserializer 才把 Value 变回业务对象。',
      form: 'ConsumerRecord<String, OrderCreated>', position: [730, 296], route: 'consumer-deserialize', focus: ['consumer-parser', 'consumer-deserializer', 'consumer-handler'],
      remember: ['先解析 RecordBatch，再解析单条 Record', 'Header 会原样恢复', '业务处理成功不等于 Offset 已提交'],
      input: 'compressed RecordBatch bytes', output: 'OrderCreated + key + headers + offset 42',
      configs: [['key.deserializer', 'StringDeserializer'], ['value.deserializer', 'Schema-aware'], ['max.poll.records', '500']],
      gain: '业务代码重新获得类型化对象与 Kafka 元数据。', cost: '反序列化失败会形成阻塞该 Partition 的毒消息。',
      code: 'K key = keyDeserializer.deserialize(topic, headers, keyBytes);\nV value = valueDeserializer.deserialize(topic, headers, valueBytes);\nhandler.onMessage(new ConsumerRecord<>(..., 42L, key, value, headers));',
      source: source('clients/src/main/java/org/apache/kafka/clients/consumer/internals/CompletedFetch.java', 250, 340)
    },
    {
      scene: 'consumer', phase: 4, zone: '提交位置', title: '处理 offset 42 后，提交的是 next=43',
      summary: 'Group A 把 P1→43 写入 __consumer_offsets。Group B 保存自己的另一套位置；两者互不覆盖。',
      form: 'Committed Offset · P1 next=43', position: [945, 458], route: 'consumer-commit', focus: ['consumer-commit'],
      remember: ['恢复时从 43 开始，不是从 42 开始', '先处理后提交可能重复', '先提交后处理可能丢业务'],
      input: 'processed ConsumerRecord offset 42', output: 'committed next offset 43',
      configs: [['enable.auto.commit', 'false'], ['commitSync / commitAsync', 'sync · 示例'], ['group.id', 'order-risk-service']],
      gain: '消费位置与日志解耦，每个 Group 可以暂停、恢复和回放。', cost: '业务副作用与 Offset Commit 通常不是跨系统原子操作。',
      code: 'consumer.commitSync(Map.of(\n  new TopicPartition("orders.created", 1),\n  new OffsetAndMetadata(43L) // 下一读取位置\n));',
      source: source('clients/src/main/java/org/apache/kafka/clients/consumer/internals/AsyncKafkaConsumer.java', 1790, 1835)
    }
  ];

  var phaseStarts = [0, 6, 8, 12, 14];
  var state = { step: 0, playing: false, timer: 0, tab: 'lesson' };
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ui = {
    scenes: Array.prototype.slice.call(document.querySelectorAll('.scene-panel')),
    components: Array.prototype.slice.call(document.querySelectorAll('[data-step]')),
    routes: Array.prototype.slice.call(document.querySelectorAll('[data-route]')),
    phaseButtons: Array.prototype.slice.call(document.querySelectorAll('[data-phase]')),
    tabs: Array.prototype.slice.call(document.querySelectorAll('[data-tab]')),
    token: document.getElementById('event-token'),
    breadcrumb: document.getElementById('breadcrumb'),
    stepZone: document.getElementById('step-zone'),
    stepTitle: document.getElementById('step-title'),
    stepSummary: document.getElementById('step-summary'),
    stepCount: document.getElementById('step-count'),
    eventForm: document.getElementById('event-form'),
    remember: document.getElementById('remember-list'),
    input: document.getElementById('step-input'),
    output: document.getElementById('step-output'),
    configs: document.getElementById('config-list'),
    gain: document.getElementById('tradeoff-gain'),
    cost: document.getElementById('tradeoff-cost'),
    code: document.getElementById('source-code'),
    source: document.getElementById('source-link'),
    timeline: document.getElementById('timeline'),
    prev: document.getElementById('prev-step'),
    next: document.getElementById('next-step'),
    play: document.getElementById('play-trace'),
    speed: document.getElementById('speed')
  };

  function phaseName(index) {
    return ['Producer', '物理网络', 'Broker / P1', '存储映射', 'Consumer A2'][index];
  }

  function renderPanel(step) {
    ui.remember.innerHTML = step.remember.map(function (item, index) {
      return '<li><span>' + (index + 1) + '</span><p>' + item + '</p></li>';
    }).join('');
    ui.input.textContent = step.input;
    ui.output.textContent = step.output;
    ui.configs.innerHTML = step.configs.map(function (item) {
      return '<div><code>' + item[0] + '</code><strong>' + item[1] + '</strong></div>';
    }).join('');
    ui.gain.textContent = step.gain;
    ui.cost.textContent = step.cost;
    ui.code.textContent = step.code;
    if (step.source) {
      ui.source.href = step.source;
      ui.source.hidden = false;
    } else {
      ui.source.hidden = true;
    }
  }

  function setTab(tab) {
    state.tab = tab;
    ui.tabs.forEach(function (button) {
      var active = button.dataset.tab === tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.info-view').forEach(function (panel) {
      var active = panel.dataset.view === tab;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
  }

  function moveToken(position, animate) {
    if (window.gsap && animate && !reducedMotion) {
      window.gsap.to(ui.token, { x: position[0], y: position[1], duration: 0.45, ease: 'power3.out' });
    } else {
      ui.token.setAttribute('transform', 'translate(' + position[0] + ' ' + position[1] + ')');
    }
  }

  function renderStep(index, animate) {
    index = Math.max(0, Math.min(steps.length - 1, index));
    var step = steps[index];
    var previousScene = steps[state.step] && steps[state.step].scene;
    state.step = index;

    ui.scenes.forEach(function (scene) {
      scene.classList.toggle('active', scene.dataset.scene === step.scene);
    });
    ui.components.forEach(function (node) {
      var active = step.focus.indexOf(node.id) !== -1 || Number(node.dataset.step) === index;
      node.classList.toggle('active', active);
      node.setAttribute('aria-current', active ? 'step' : 'false');
    });
    ui.routes.forEach(function (route) {
      route.classList.toggle('active', route.dataset.route === step.route);
    });
    ui.phaseButtons.forEach(function (button, phaseIndex) {
      button.classList.toggle('active', phaseIndex === step.phase);
      button.classList.toggle('passed', phaseIndex < step.phase);
      button.setAttribute('aria-current', phaseIndex === step.phase ? 'step' : 'false');
    });

    ui.stepZone.textContent = step.zone;
    ui.stepTitle.textContent = step.title;
    ui.stepSummary.textContent = step.summary;
    ui.stepCount.textContent = String(index + 1).padStart(2, '0') + ' / ' + steps.length;
    ui.eventForm.textContent = step.form;
    ui.timeline.value = index;
    ui.timeline.style.setProperty('--progress', (index / (steps.length - 1) * 100) + '%');
    ui.breadcrumb.innerHTML = '<span>一条消息</span><i>›</i><span>' + phaseName(step.phase) + '</span><i>›</i><strong>' + step.zone + '</strong>';
    renderPanel(step);

    if (previousScene !== step.scene && window.gsap && animate && !reducedMotion) {
      var activeScene = document.querySelector('.scene-panel.active');
      window.gsap.fromTo(activeScene, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out' });
      window.gsap.set(ui.token, { opacity: 0 });
      moveToken(step.position, false);
      window.gsap.to(ui.token, { opacity: 1, duration: 0.2, delay: 0.12 });
    } else {
      moveToken(step.position, animate);
    }
  }

  function stop() {
    state.playing = false;
    window.clearTimeout(state.timer);
    ui.play.setAttribute('aria-pressed', 'false');
    ui.play.setAttribute('aria-label', '播放');
  }

  function schedule() {
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(function () {
      if (!state.playing) return;
      if (state.step === steps.length - 1) { stop(); return; }
      renderStep(state.step + 1, true);
      schedule();
    }, Number(ui.speed.value));
  }

  function togglePlay() {
    if (state.playing) { stop(); return; }
    if (state.step === steps.length - 1) renderStep(0, false);
    state.playing = true;
    ui.play.setAttribute('aria-pressed', 'true');
    ui.play.setAttribute('aria-label', '暂停');
    schedule();
  }

  ui.components.forEach(function (node) {
    node.addEventListener('click', function () { stop(); renderStep(Number(node.dataset.step), true); });
    node.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); stop(); renderStep(Number(node.dataset.step), true);
      }
    });
  });
  ui.phaseButtons.forEach(function (button, index) {
    button.addEventListener('click', function () { stop(); renderStep(phaseStarts[index], true); });
  });
  ui.tabs.forEach(function (button) {
    button.addEventListener('click', function () { setTab(button.dataset.tab); });
  });
  ui.prev.addEventListener('click', function () { stop(); renderStep(state.step - 1, true); });
  ui.next.addEventListener('click', function () { stop(); renderStep(state.step + 1, true); });
  ui.play.addEventListener('click', togglePlay);
  ui.timeline.addEventListener('input', function () { stop(); renderStep(Number(ui.timeline.value), true); });
  ui.speed.addEventListener('change', function () { if (state.playing) schedule(); });

  document.addEventListener('keydown', function (event) {
    if (event.target.matches('button, input, select, a')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); stop(); renderStep(state.step + 1, true); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); stop(); renderStep(state.step - 1, true); }
    if (event.key === ' ') { event.preventDefault(); togglePlay(); }
  });

  setTab('lesson');
  renderStep(0, false);
})();

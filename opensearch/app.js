(() => {
  "use strict";

  const slides = window.OPENSEARCH_COURSE || [];
  const stages = window.OPENSEARCH_STAGES || [];
  const stage = document.querySelector("#slide-stage");
  const prev = document.querySelector("#prev");
  const next = document.querySelector("#next");
  const pageCount = document.querySelector("#page-count");
  const pageTitle = document.querySelector("#page-title");
  const headerCount = document.querySelector("#header-count");
  const headerTitle = document.querySelector("#header-title");
  const deepPanel = document.querySelector("#deep-panel");
  const deepToggle = document.querySelector("#deep-toggle");
  const deepScrim = document.querySelector("#deep-scrim");
  const overview = document.querySelector("#overview");
  const overviewGrid = document.querySelector("#overview-grid");
  let index = 0;
  let lastFocus = null;

  const esc = value => String(value ?? "").replace(/[&<>\"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[char]);

  function nodesMarkup(item) {
    const count = Math.max(1, item.nodes.length);
    const vectorMesh = item.stage === "vector" ? `<svg class="vector-mesh" viewBox="0 0 1000 180" preserveAspectRatio="none" aria-hidden="true">
      <g class="mesh-links"><path d="M80 120 220 62 365 125 505 45 650 116 790 54 925 105"/><path d="M80 120 365 125 650 116 925 105"/><path d="M220 62 505 45 790 54"/><path d="M220 62 650 116M365 125 790 54M505 45 925 105"/></g>
      <g class="mesh-points"><circle cx="80" cy="120" r="8"/><circle cx="220" cy="62" r="8"/><circle cx="365" cy="125" r="8"/><circle cx="505" cy="45" r="10"/><circle cx="650" cy="116" r="8"/><circle cx="790" cy="54" r="8"/><circle cx="925" cy="105" r="8"/></g>
    </svg>` : "";
    return `<div class="machine-path" style="--node-count:${count}">
      ${vectorMesh}
      <div class="machine-line" aria-hidden="true"><i></i></div>
      ${item.nodes.map((node, i) => `<button class="machine-node hotspot" type="button" data-deep-open data-component-index="${i}" aria-label="深挖 ${esc(node[1])}">
        <span class="node-index">${String(i + 1).padStart(2, "0")}</span>
        <span class="node-label">${esc(node[0])}</span>
        <strong>${esc(node[1])}</strong>
        <small>${esc(node[2])}</small>
      </button>`).join("")}
      <span class="document-token" aria-hidden="true"><i></i><b>#D2048</b></span>
    </div>`;
  }

  function systemPrimerMarkup() {
    return `<div class="physical-scene system-primer">
      <section class="primer-cluster">
        <header><span>OPENSEARCH CLUSTER</span><b>一组共同工作的进程 / 机器</b></header>
        <div class="primer-nodes">
          <section class="primer-node"><header>DATA NODE 0</header><div class="primer-shard primary"><b>P0</b><small>Primary</small></div><div class="primer-shard replica"><b>R1</b><small>P1 Replica</small></div></section>
          <section class="primer-node"><header>DATA NODE 1</header><div class="primer-shard primary"><b>P1</b><small>Primary</small></div><div class="primer-shard replica"><b>R2</b><small>P2 Replica</small></div></section>
          <section class="primer-node is-focus"><header>DATA NODE 2</header><div class="primer-shard primary"><b>P2</b><small>#D2048 的 Primary</small></div><div class="primer-shard replica"><b>R0</b><small>P0 Replica</small></div></section>
        </div>
      </section>
      <div class="primer-zoom" aria-hidden="true"><span>放大 P2</span><i></i></div>
      <section class="primer-lucene">
        <header><span>LUCENE SHARD P2</span><b>Shard 内部才是索引文件</b></header>
        <div class="primer-segments"><div><span>SEGMENT _0</span><small>不可变文件集合</small></div><div><span>SEGMENT _1</span><small>不可变文件集合</small></div><div class="future"><span>BUFFER</span><small>下次 Refresh → 新 Segment</small></div></div>
      </section>
      <div class="primer-caption"><b>Index products-v3 是逻辑名字</b><span>它的 P0 / P1 / P2 Primary 与 Replica 被分散到多个 Nodes；每个 Shard 本身是一套 Lucene 索引。</span></div>
    </div>`;
  }

  function requestAnatomyMarkup() {
    return `<div class="physical-scene request-anatomy">
      <section class="api-anatomy">
        <header>这条请求逐段读</header>
        <div class="request-parts">
          <span class="method"><b>PUT</b><small>HTTP 方法</small></span>
          <span><b>products-v3</b><small>Index 逻辑名称</small></span>
          <span><b>_create</b><small>已存在则 409</small></span>
          <span><b>sku-8821</b><small>Document _id</small></span>
          <span class="custom-part"><b>routing=tenant-17</b><small>可选的自定义路由</small></span>
        </div>
        <pre><code>{
  "name": "Wireless Headphones",
  "price": 249,
  "tenant_id": "tenant-17"
}</code></pre>
      </section>
      <section class="routing-explainer">
        <header><span>ROUTING 决定写进哪个 PRIMARY SHARD</span><b>两种情况不要混</b></header>
        <div class="routing-lane default-lane"><span>默认</span><strong>不传 routing</strong><i>→</i><code>_routing = _id = sku-8821</code><i>→</i><b>hash → 某一个 Shard</b></div>
        <div class="routing-lane custom-lane"><span>本课程</span><strong>routing=tenant-17</strong><i>→</i><code>_routing = tenant-17</code><i>→</i><b>hash → P2（示意）</b></div>
        <div class="routing-why"><span><b>为什么用它？</b> 模拟多租户：tenant-17 的文档定向到同一路由空间；按同一 routing 搜索时可少查 Shards。</span><span><b>代价</b> 大租户可能制造热点，所以它是设计选择，不是必填默认值。</span></div>
      </section>
      <div class="routing-contract"><b>一旦写入使用 tenant-17</b><span>后续 GET / UPDATE / DELETE 也必须使用 tenant-17；漏传会算出另一个 Shard，常见表现是 found:false。</span></div>
    </div>`;
  }

  function indexContractMarkup() {
    return `<div class="physical-scene index-contract-topology">
      <section class="contract-request">
        <header><span>CONTROL PLANE API</span><b>先定义逻辑契约</b></header>
        <pre><code>PUT products-v3
{
  "number_of_shards": 3,
  "number_of_replicas": 1,
  "mappings": { "sku": "keyword", "name": "text" }
}</code></pre>
      </section>
      <section class="contract-index">
        <header><span>LOGICAL INDEX</span><strong>products-v3</strong></header>
        <div class="contract-alias"><small>WRITE ALIAS</small><b>products-write</b><i>→</i><strong>products-v3</strong></div>
        <div class="contract-rules"><span><b>3</b> routing buckets</span><span><b>1</b> replica / primary</span><span><b>mapping</b> field contract</span></div>
      </section>
      <section class="contract-cluster">
        <header><span>PHYSICAL ALLOCATION</span><b>6 个 Shard copies 分散到 3 个 Nodes</b></header>
        <div class="contract-nodes">
          <div><small>DATA NODE 0</small><b class="is-primary">P0</b><b>R1</b></div>
          <div><small>DATA NODE 1</small><b class="is-primary">P1</b><b class="is-focus">R2</b></div>
          <div><small>DATA NODE 2</small><b class="is-primary is-focus">P2</b><b>R0</b></div>
        </div>
        <p><strong>#D2048</strong> 稍后由 routing 选中 P2；R2 是它的另一份完整 copy。</p>
      </section>
      <div class="contract-lesson"><b>Index ≠ 一块磁盘</b><span>Index 是跨 Nodes 的逻辑契约；Shard copy 才是数据与故障转移的物理单位。</span></div>
    </div>`;
  }

  function indexReplaceMarkup() {
    return `<div class="physical-scene replace-topology">
      <section class="replace-api-rail">
        <button class="replace-api create-only hotspot" type="button" data-deep-open data-component-name="Create Only" data-component-detail="/_create/{id} 或 op_type=create 只允许不存在的 _id；VersionMap/Internal Reader 发现 live 版本时返回 409，不会覆盖。"><span>CREATE ONLY</span><code>PUT /_create/sku-8821</code><b>exists → 409</b></button>
        <div class="replace-vs">VS</div>
        <button class="replace-api index-api hotspot" type="button" data-deep-open data-component-name="Index / Replace" data-component-detail="PUT /_doc/{id} 把请求体当成新的完整 Document；已存在时写完整新 Lucene 文档并 soft-delete 旧版本，未发送字段不会自动继承。"><span>INDEX</span><code>PUT /_doc/sku-8821</code><b>exists → replace full document</b></button>
      </section>
      <section class="replace-segment-frame">
        <header><span>LUCENE SHARD P2 · REPLACE PHYSICAL VIEW</span><b>逻辑 1 份 · 物理暂时 2 个版本</b></header>
        <button class="replace-version old-copy hotspot" type="button" data-deep-open data-component-name="旧 Lucene Document" data-component-detail="旧版本的 postings、Doc Values 与 _source 仍在旧 Segment 中；隐藏 __soft_deletes 标记让新 Searcher 不再把它当业务 live 文档。"><small>SEGMENT _2 · docID 7</small><strong>#D2048 · v7</strong><pre>{ name, price:249, stock:10 }</pre><em>__soft_deletes=1</em></button>
        <div class="replace-write"><span>softUpdateDocument</span><i></i><b>mark old + add full new</b></div>
        <button class="replace-version new-copy hotspot" type="button" data-deep-open data-component-name="新 Lucene Document" data-component-detail="普通 Index API 的请求体就是新完整文档。若只发送 price，新版本只包含 price；Update API 才会先读旧 _source 再合并局部字段。"><small>NEW DOC · docID 42</small><strong>#D2048 · v8</strong><pre>{ price:229 }</pre><em>LIVE after Refresh</em></button>
        <div class="replace-merge"><span>RETENTION-AWARE MERGE</span><b>new Segment keeps live version</b><small>old bytes reclaimed after refCount=0</small></div>
      </section>
      <div class="replace-warning"><b>字段陷阱</b><span>Replace 只传 <code>{ price:229 }</code>，新文档不会保留旧的 name / stock。</span><strong>Refresh 隐藏旧版本；Merge 才回收旧字节。</strong></div>
    </div>`;
  }

  function clientEntryMarkup() {
    return `<div class="physical-scene client-entry-topology">
      <section class="business-clients"><header>BUSINESS SERVICES</header><span>order-service</span><span>catalog-service</span><span>search-api</span><small>应用不追踪 Primary 在哪台机器</small></section>
      <div class="entry-arrow" aria-hidden="true"><b>HTTPS</b><i></i></div>
      <button class="stable-endpoint hotspot" type="button" data-deep-open data-component-name="稳定 DNS / Load Balancer Endpoint" data-component-detail="业务通常只配置一个稳定域名。真正的高可用来自该域名背后多个跨故障域健康目标，而不是一个固定 Data Node IP。"><span>RECOMMENDED</span><strong>search.example.com</strong><small>1 stable endpoint</small></button>
      <section class="coordinator-pool"><header><span>LB HEALTHY TARGETS</span><b>2–3 个入口节点</b></header><div><button class="hotspot" type="button" data-deep-open data-component-name="Coordinator 1" data-component-detail="解析请求、读取本地 Cluster State、路由并转发；也可能承担 Search reduce。"><b>coord-1</b><small>AZ-A · healthy</small></button><button class="hotspot" type="button" data-deep-open data-component-name="Coordinator 2" data-component-detail="入口节点可以是 coordinating-only，也可以是兼任协调职责的 Data Node，取决于集群规模。"><b>coord-2</b><small>AZ-B · healthy</small></button><button class="hotspot" type="button" data-deep-open data-component-name="Coordinator 3" data-component-detail="多入口让滚动升级或单节点故障不会切断业务；仍需客户端总超时、退避与幂等重试。"><b>coord-3</b><small>AZ-C · healthy</small></button></div></section>
      <section class="seed-alternative"><span>NO LOAD BALANCER?</span><strong>Client Node Pool</strong><code>[node-1, node-2, node-3]</code><small>2–3 个 initial HTTP hosts · 不是 discovery.seed_hosts</small></section>
      <div class="entry-lesson"><b>避免</b><code>http://one-data-node:9200</code><span>单 IP 重启即断流</span><i></i><strong>入口节点再根据 Cluster State 找到真正的 P2 Primary。</strong></div>
    </div>`;
  }

  function coordinatorRoutingMarkup() {
    return `<div class="physical-scene coordinator-physical">
      <svg class="coordinator-paths" viewBox="0 0 1200 230" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id="coord-request-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7Z"/></marker>
          <marker id="coord-return-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7Z"/></marker>
        </defs>
        <path class="coord-request-path" d="M125 105 H225 M680 105 H1012"/>
        <path class="coord-return-path" d="M1012 180 H680 C520 180 410 198 225 180 H125"/>
        <path class="coord-state-path" d="M790 30 C700 30 690 54 615 54"/>
      </svg>
      <button class="coord-client hotspot" type="button" data-deep-open data-component-name="业务客户端" data-component-detail="客户端只连接稳定 Endpoint，并不知道 P2 Primary 当前在哪台机器。请求不会收到 HTTP 302 去直连 Node-2；Node-0 代表客户端完成内部寻址。"><span>CLIENT · HTTPS</span><strong>PUT products-write</strong><code>/_create/sku-8821</code><small>routing=tenant-17 · #D2048</small></button>
      <section class="coord-cluster-boundary">
        <header><span>OPENSEARCH CLUSTER · DATA PATH</span><b>Cluster State v928 已发布到每个节点</b></header>
        <section class="coord-receiver-machine">
          <header><span>PHYSICAL NODE-0</span><b>RECEIVING NODE = COORDINATOR FOR THIS REQUEST</b></header>
          <div class="coord-http-port"><span>① HTTP / REST</span><b>parse · auth · request context</b><small>此刻只在 Node-0 内存</small></div>
          <button class="coord-local-state hotspot" type="button" data-deep-open data-component-name="Node-0 的本地 Cluster State" data-component-detail="Cluster Manager 发布状态更新，各节点保存本地副本。这里包含 products-write → products-v3、3 个 Primary Shards，以及 P2 Primary 当前分配在 Node-2；普通 CRUD 不需要每次同步询问 Cluster Manager。"><span>② JVM HEAP · LOCAL CLUSTER STATE v928</span><div><small>ALIAS</small><code>products-write → products-v3</code></div><div><small>INDEX META</small><code>primary_shards = 3</code></div><div class="is-focus"><small>ROUTING TABLE</small><code>P2.primary → Node-2</code></div></button>
          <button class="coord-routing-cpu hotspot" type="button" data-deep-open data-component-name="路由计算与物理寻址" data-component-detail="先决定逻辑 Shard：hash(routing ?? _id) % primaryShards。本例 tenant-17 → P2。再查 Cluster State 的 routing table，把逻辑 P2 翻译成物理 Node-2。"><span>③ ROUTE ON CPU</span><code>hash(tenant-17) % 3</code><strong>= P2</strong><small>逻辑 Shard 与物理 Node 分两步</small></button>
          <button class="coord-transport-out hotspot" type="button" data-deep-open data-component-name="节点间 Transport 转发" data-component-detail="Node-0 使用 OpenSearch 节点间 Transport 把请求发送给 Node-2。Node-0 不把 #D2048 写到自己的 Segment；它等待内部响应，再复用原 HTTP 连接返回客户端。"><span>④ INTERNAL TRANSPORT</span><strong>Node-0 → Node-2</strong><small>not a client redirect</small></button>
          <div class="coord-no-write"><b>NODE-0 不持久化 #D2048</b><span>只保留请求上下文、队列与临时响应状态</span></div>
        </section>
        <section class="coord-node-rack">
          <header><span>SHARD ALLOCATION · PHYSICAL MACHINES</span><b>同一逻辑 Index 分散在多个 Nodes</b></header>
          <div class="coord-data-node muted-node"><span>NODE-1</span><strong>P1 Primary</strong><small>R2 Replica</small><em>不是本次写目标</em></div>
          <button class="coord-data-node target-node hotspot" type="button" data-deep-open data-component-name="Node-2 上的 P2 Primary" data-component-detail="真正改变索引状态的是这里：P2 Primary 分配 seq_no，写自己的 IndexWriter 与 Translog，再复制到 R2。完成后把结果返回 Node-0。"><span>PHYSICAL NODE-2</span><strong>P2 PRIMARY</strong><div class="coord-shard-tray"><b>#D2048</b><small>IndexWriter + Translog</small></div><output>⑤ execute → replicate → ACK</output></button>
          <div class="coord-manager-note"><span>CONTROL PLANE</span><b>Cluster Manager</b><small>维护并发布状态；不在每条 CRUD 数据路径上</small></div>
        </section>
      </section>
      <div class="coord-packet" aria-hidden="true"><i></i><b>#D2048</b></div>
      <div class="coord-return-packet" aria-hidden="true"><i></i><b>201 created</b></div>
      <div class="coord-principle"><span><b>1 · 谁决定去哪里？</b> Node-0 + 本地 Cluster State</span><i></i><span><b>2 · 谁真正写？</b> Node-2 / P2 Primary</span><i></i><span><b>3 · 谁回答客户端？</b> 仍是 Node-0 的原 HTTP 连接</span></div>
    </div>`;
  }

  function ingestPipelineMarkup() {
    return `<div class="physical-scene ingest-lab">
      <button class="ingest-document raw-doc hotspot" type="button" data-deep-open data-component-name="原始业务 JSON" data-component-detail="这是应用发送给 Pipeline 的 _source：price 还是字符串，并包含不应该落库的 password/cardNumber。"><span>INPUT · RAW JSON</span><pre>{\n  "orderId": "A1024",\n  "userId": "U9527",\n  "price": "249.00",\n  "password": "secret",\n  "cardNumber": "6222..."\n}</pre></button>
      <section class="processor-rack"><header><span>order-normalize-v1</span><b>PROCESSORS RUN IN ORDER</b></header><ol><li><b>rename</b><code>userId → user_id</code></li><li><b>convert</b><code>price → double</code></li><li><b>set</b><code>ingested_at = _ingest.timestamp</code></li><li><b>set</b><code>source_system = order-service</code></li><li><b>remove</b><code>password · cardNumber</code></li></ol></section>
      <button class="ingest-document clean-doc hotspot" type="button" data-deep-open data-component-name="进入 Mapping 的最终 JSON" data-component-detail="Pipeline 输出才交给 Mapping/Analyzer。它已经完成字段重命名、类型转换、时间补充与敏感字段移除。"><span>OUTPUT · INDEXABLE JSON</span><pre>{\n  "orderId": "A1024",\n  "user_id": "U9527",\n  "price": 249.0,\n  "ingested_at": "2026-08-25T...Z",\n  "source_system": "order-service"\n}</pre></button>
      <div class="ingest-failure"><b>on_failure</b><span>convert 失败 → 设置 ingest_error / 拒绝</span><code>先用 _simulate?verbose=true 看每一步中间结果</code></div>
      <div class="ingest-vs-analyzer"><span><b>PIPELINE</b> 改 JSON / _source</span><i></i><span><b>ANALYZER</b> 把 text 变成 terms</span><strong>两个边界不要混</strong></div>
    </div>`;
  }

  function physicalWriteMarkup() {
    return `<div class="physical-scene write-topology">
      <button class="request-rack hotspot" type="button" data-deep-open data-component-name="Client / HTTP" data-component-detail="保存业务 JSON、_id 与 routing，并把一次 Create 请求发给任一可达节点。">
        <span>CLIENT · HTTP</span><strong>PUT /_create/sku-8821</strong>
        <code>routing=tenant-17</code><small>JSON #D2048</small>
      </button>
      <div class="request-wire" aria-hidden="true"><b>1 · route</b><i></i></div>
      <section class="cluster-frame">
        <header><span>DEFAULT · DOCUMENT REPLICATION</span><code>products-v3 · P2 + R2</code></header>
        <div class="cluster-machines">
          <button class="coordinator-rack hotspot" type="button" data-deep-open data-component-name="Coordinating Node + Active Shard Gate" data-component-detail="先解析 routing 找到 P2，再检查 wait_for_active_shards 门槛。默认值 1 只要求 Primary active；这是写前条件，不是本次写的 ACK quorum。">
            <span>COORDINATOR</span><strong>hash(routing) → P2</strong>
            <div class="active-shard-gate"><em>PREFLIGHT</em><b>wait_for_active_shards=1</b><small>P2 active ✓ · 才开始写</small></div>
          </button>
          <section class="data-node primary-machine">
            <header><span>DATA NODE 2</span><b>P2 · PRIMARY</b></header>
            <div class="shard-frame">
              <div class="engine-strip"><span>PRIMARY PERFORM</span><b>exists? ✓ · seq_no=43 · term=7</b></div>
              <div class="physical-trays">
                <button class="memory-tray hotspot" type="button" data-deep-open data-component-name="Indexing Buffer" data-component-detail="保存已完成分析、尚未 Refresh 成新 Segment 的内存索引结构。">
                  <small>① JVM / RAM</small><strong>Index Buffer</strong><em>index #D2048</em>
                </button>
                <button class="disk-tray hotspot" type="button" data-deep-open data-component-name="Translog" data-component-detail="顺序追加本次写操作并按 durability 策略 fsync，用于崩溃后重放恢复。">
                  <small>② NVMe · P2 LOCAL</small><strong>translog-7.tlog</strong><em>append op[43] · fsync(request)</em>
                </button>
                <div class="segment-shelf"><small>③ CURRENT SEARCHER VIEW</small><span>_0.cfs</span><span>_1.cfs</span><em>尚未 Refresh，不含 #D2048</em></div>
              </div>
            </div>
          </section>
          <section class="data-node replica-machine">
            <header><span>DATA NODE 1</span><b>R2 · REPLICA</b></header>
            <div class="replica-operation"><small>2 · RECEIVE REPLICA REQUEST</small><strong>index(op[43], term=7)</strong><span>① Replica 自己 index → Buffer</span><span>② Replica 自己 append → Translog</span><span>③ durability=request → fsync</span><em>ACK · local_checkpoint=43</em></div>
          </section>
        </div>
        <div class="replication-wire" aria-hidden="true"><b>PRIMARY PUSH · ReplicaRequest(op + seq_no + term)</b><i></i></div>
      </section>
      <div class="ack-rail"><span>3 · ReplicaResponse ACK → Primary</span><i></i><b>4 · CLIENT RESPONSE</b><code>201 · result=created · _shards { total:2, successful:2, failed:0 }</code></div>
    </div>`;
  }

  function searchWindowMarkup() {
    return `<div class="physical-scene visibility-topology">
      <div class="visibility-request"><span>同一条查询</span><code>POST /products-v3/_search</code><small>name: wireless</small></div>
      <section class="shard-timeline">
        <header><span>DATA NODE 2 · LUCENE SHARD P2</span><code>时间从左向右</code></header>
        <div class="visibility-state before-refresh">
          <div class="state-heading"><span>T0 · ACK 刚返回</span><strong>Searcher v41</strong></div>
          <div class="state-machinery">
            <div class="ram-box"><small>JVM · BUFFER</small><b>#D2048</b><em>已写入，未发布</em></div>
            <div class="searcher-eye"><small>SEARCHER v41 只看</small><b>→</b></div>
            <div class="segment-stack"><small>SEGMENTS</small><span>_0</span><span>_1</span><em>不含 #D2048</em></div>
          </div>
          <output><b>0</b> hits <small>文档没有丢</small></output>
        </div>
        <div class="refresh-gate"><span>REFRESH</span><b>Buffer → new Segment</b><i aria-hidden="true"></i></div>
        <div class="visibility-state after-refresh">
          <div class="state-heading"><span>T1 · 发布新视图</span><strong>Searcher v42</strong></div>
          <div class="state-machinery">
            <div class="ram-box empty"><small>JVM · BUFFER</small><b>empty</b><em>开始接收下一批</em></div>
            <div class="searcher-eye"><small>SEARCHER v42 现在看</small><b>→</b></div>
            <div class="segment-stack"><small>SEGMENTS</small><span>_0</span><span>_1</span><span class="fresh-segment">_2 · #D2048</span></div>
          </div>
          <output><b>1</b> hit <small>#D2048 可搜索</small></output>
        </div>
      </section>
      <div class="visibility-lesson"><b>GET</b> 走 Engine 的实时读取路径；<b>Search</b> 只查询已发布给 Searcher 的 Segments。</div>
    </div>`;
  }

  function physicalGetMarkup() {
    return `<div class="physical-scene get-topology">
      <button class="get-request hotspot" type="button" data-deep-open data-component-name="Realtime GET" data-component-detail="用相同 _id + routing 定位单个 Shard group，并从 Engine 读取最新版本。"><span>CLIENT</span><strong>GET /_doc/sku-8821</strong><code>routing=tenant-17</code></button>
      <div class="routing-calculator"><span>ROUTING</span><strong>hash(tenant-17) % 3</strong><b>→ P2 shard group</b></div>
      <section class="index-partitions">
        <header>INDEX · products-v3</header>
        <div class="partition is-skipped"><span>P0</span><b>SKIP</b></div>
        <div class="partition is-skipped"><span>P1</span><b>SKIP</b></div>
        <div class="partition is-target"><span>P2</span><b>TARGET</b><i>#D2048</i></div>
      </section>
      <section class="shard-copy-group">
        <header>SHARD GROUP P2 · 选择一个可用 COPY</header>
        <div class="copy primary-copy"><span>DATA NODE 2</span><strong>P2 Primary</strong><small>available</small></div>
        <div class="copy-choice"><b>OR</b><small>preference / ARS</small></div>
        <div class="copy replica-copy"><span>DATA NODE 1</span><strong>R2 Replica</strong><small>chosen</small></div>
      </section>
      <section class="engine-get-box"><span>ENGINE GET · realtime=true</span><strong>resolve latest version</strong><p>即使尚未 Refresh，也读取当前最新 _source</p><output>200 · found · seq_no=43</output></section>
      <div class="get-path-label"><b>只访问 1 个 shard group</b><span>P0/P1 不广播 · P2/R2 不会同时都读</span></div>
    </div>`;
  }

  function versionMapMarkup() {
    return `<div class="physical-scene version-map-topology">
      <section class="version-engine-frame">
        <header><span>DATA NODE 2 · PRIMARY SHARD P2 · JVM HEAP</span><b>LiveVersionMap</b></header>
        <div class="uid-lock"><small>PER-ID LOCK</small><strong>uid = sku-8821</strong><code>serialize writes for this id</code></div>
        <button class="version-entry current-entry hotspot" type="button" data-deep-open data-component-name="IndexVersionValue" data-component-detail="普通最近版本只保存 version、seq_no、primary_term，以及需要时的 Translog location；它不是完整 _source 缓存。"><span>CURRENT MAP</span><b>sku-8821</b><dl><dt>version</dt><dd>8</dd><dt>seq_no</dt><dd>44</dd><dt>term</dt><dd>7</dd><dt>translog</dt><dd>gen12@9812</dd></dl></button>
        <button class="version-entry delete-entry hotspot" type="button" data-deep-open data-component-name="DeleteVersionValue" data-component-detail="删除条目增加 deleted=true 与时间戳，使 realtime GET 立即返回 found=false，并帮助拒绝迟到的旧操作。"><span>DELETE TOMBSTONES MAP</span><b>sku-9911</b><dl><dt>deleted</dt><dd>true</dd><dt>seq_no</dt><dd>81</dd><dt>term</dt><dd>7</dd><dt>time</dt><dd>now</dd></dl></button>
      </section>
      <section class="version-read-path"><header>REALTIME GET DECISION</header><div><b>1</b><span>lookup uid</span></div><div><b>2</b><span>deleted? → 404</span></div><div><b>3</b><span>has location? → TranslogLeafReader</span></div><div><b>4</b><span>otherwise → Internal Searcher</span></div></section>
      <section class="version-refresh-cycle"><header><span>REFRESH TRANSITION</span><b>保证并发切换不漏写</b></header><div class="map-box"><small>beforeRefresh</small><strong>current → old</strong></div><i></i><div class="map-box fresh-map"><small>new writes</small><strong>new current</strong></div><i></i><div class="map-box clear-map"><small>afterRefresh</small><strong>old cleared</strong></div><p>普通版本由 Lucene Reader 接管；delete tombstones 走独立保留窗口。</p></section>
      <div class="version-not"><b>VERSIONMAP 不是</b><span>完整 _source</span><span>倒排索引</span><span>Cluster State</span><span>持久文件</span></div>
    </div>`;
  }

  function engineWriteOrderMarkup() {
    return `<div class="physical-scene engine-order-topology">
      <section class="engine-order-rail">
        <button class="engine-order-stage iw-stage hotspot" type="button" data-deep-open data-component-name="1 · Lucene IndexWriter" data-component-detail="源码先调用 indexIntoLucene：添加新 Document 或 softUpdateDocument，在 JVM 中构建 postings、Doc Values、stored fields 等未来搜索结构。"><span>01 · METHOD ORDER</span><strong>indexIntoLucene()</strong><small>IndexWriter RAM structures</small><code>search representation</code></button>
        <button class="engine-order-stage tlog-stage hotspot" type="button" data-deep-open data-component-name="2 · Translog append" data-component-detail="随后 translogManager.add 追加操作。Translog 保存可重放的 Index/Delete/Noop 操作，不保存完整倒排索引。"><span>02 · METHOD ORDER</span><strong>translogManager.add()</strong><small>sequential recovery record</small><code>generation + offset</code></button>
        <button class="engine-order-stage vmap-stage hotspot" type="button" data-deep-open data-component-name="3 · VersionMap update" data-component-detail="写入成功后把 uid 映射到最新 version/seq_no/term 和可选 Translog location，服务 realtime GET 与并发判断。"><span>03 · METHOD ORDER</span><strong>versionMap.put()</strong><small>latest identity metadata</small><code>uid → VersionValue</code></button>
        <button class="engine-order-stage fsync-stage hotspot" type="button" data-deep-open data-component-name="4 · Durability boundary" data-component-detail="默认 durability=request 时，在该 Shard copy ACK 前需要把对应 Translog location 同步到持久存储；async 则允许按 sync_interval 批量同步。"><span>04 · ACK BOUNDARY</span><strong>Translog fsync</strong><small>durability=request</small><code>then shard ACK</code></button>
      </section>
      <section class="two-purpose-ledger"><div><span>为什么保留 IndexWriter？</span><strong>为了搜索</strong><p>提前构建倒排、列式、点树与向量结构，Refresh 时批量发布 Segment。</p></div><div><span>为什么再写 Translog？</span><strong>为了恢复</strong><p>顺序追加比每条写都 Lucene Commit 更轻；Flush 后安全 Commit 可接管并滚动旧日志。</p></div></section>
      <div class="engine-later"><span><b>T1 · Refresh</b> 搜索可见</span><i></i><span><b>T2 · Flush</b> Lucene commit + new translog generation</span><i></i><span><b>T3 · Merge</b> compact immutable segments</span></div>
    </div>`;
  }

  function documentRewriteMarkup() {
    return `<div class="physical-scene rewrite-topology">
      <div class="rewrite-code"><span>UPDATE API</span><code>POST /_update/sku-8821</code><small>doc: { price: 229 }</small></div>
      <section class="document-version old-version"><header>BEFORE · LUCENE DOC v7</header><strong>#D2048</strong><dl><dt>price</dt><dd>249</dd><dt>seq_no</dt><dd>43</dd><dt>soft flag</dt><dd>absent</dd></dl></section>
      <div class="rewrite-engine"><span>PRIMARY ENGINE</span><b>1 · GET current _source</b><b>2 · apply doc / script</b><b>3 · softUpdateDocument</b><small>原子地标旧版本 + 添加新文档</small></div>
      <section class="document-version new-version"><header>AFTER · LUCENE DOC v8</header><strong>#D2048</strong><dl><dt>price</dt><dd>229</dd><dt>seq_no</dt><dd>44</dd><dt>current</dt><dd>true</dd></dl></section>
      <div class="old-version-fate"><span>OLD v7 · HIDDEN DV</span><b>__soft_deletes = 1</b><small>不是 .liv；仍占旧 Segment 字节</small></div>
      <div class="rewrite-rail"><span>Translog: index op[44]</span><span>Replica: 应用翻译后的最终 Index/Delete</span><span>并发保护: if_seq_no + if_primary_term</span></div>
    </div>`;
  }

  function updateTranslationMarkup() {
    return `<div class="physical-scene update-translation-topology">
      <button class="script-request hotspot" type="button" data-deep-open data-component-name="UpdateRequest" data-component-detail="客户端表达意图：读取当前 _source 后把 stock 减 1。此时还不是可以复制给 Replica 的最终 Lucene 操作。"><span>CLIENT · UPDATE INTENT</span><code>ctx._source.stock -= 1</code><small>current stock expected: 10</small></button>
      <section class="primary-translator"><header><span>P2 PRIMARY · UpdateHelper.prepare()</span><b>只在这里运行 doc / script</b></header><div class="primary-read"><small>REALTIME GET</small><pre>{ sku:"K100", stock:10 }</pre></div><div class="script-cpu"><small>RUN SCRIPT</small><strong>10 − 1 = 9</strong><code>retry conflict? read + run again</code></div><div class="translation-switch"><span>TRANSLATE RESULT</span><div><b>UPDATED</b><code>IndexRequest(full source)</code></div><div><b>DELETED</b><code>DeleteRequest</code></div><div><b>NOOP</b><code>no shard write</code></div></div></section>
      <section class="replica-results"><header>REPLICATION TARGETS</header><button class="hotspot" type="button" data-deep-open data-component-name="Replica R2" data-component-detail="R2 收到完整新 source 与 Primary 分配的 seq_no/term，在自己的 IndexWriter/Translog 应用 Index 操作；不重新执行 stock -= 1。"><span>R2 · NODE 1</span><strong>INDEX stock=9</strong><small>script not executed</small></button><button class="hotspot" type="button" data-deep-open data-component-name="Replica R2B" data-component-detail="若还有第二个 Replica，它也应用同一个确定结果；所有副本因此不会因时间、随机值或重试得到不同 JSON。"><span>R2B · NODE 3</span><strong>INDEX stock=9</strong><small>same seq_no + term</small></button></section>
      <div class="translation-wire" aria-hidden="true"><span>Primary sends concrete operation</span><i></i></div>
      <div class="translation-lesson"><b>不是广播脚本</b><span>Primary 决定 stock=9</span><i></i><strong>Replica 只执行 INDEX stock=9</strong><em>时间 / 随机 / 重试不会让副本分叉</em></div>
    </div>`;
  }

  function deleteTimelineMarkup() {
    return `<div class="physical-scene delete-topology">
      <div class="delete-request"><span>DELETE API</span><code>DELETE /_doc/sku-8821</code><small>same routing → P2</small></div>
      <section class="delete-shard-frame">
        <header>DATA NODE 2 · PRIMARY SHARD P2 · 时间从左向右</header>
        <div class="delete-state live-state"><span>T0 · BEFORE</span><strong>Segment _2</strong><div class="doc-row"><b>docID 42 · #D2048</b><i>soft=0</i></div><small>当前 Searcher 可见</small></div>
        <div class="delete-operation"><span>DELETE OP</span><b>seq_no 45</b><small>softUpdate + tombstone</small></div>
        <div class="delete-state hidden-state"><span>T1 · AFTER REFRESH</span><strong>Hidden DocValues</strong><div class="doc-row"><b>docID 42 · #D2048</b><i>soft=1</i></div><small>Searcher 已过滤；旧字节与历史仍在</small></div>
        <div class="merge-operation"><span>RETENTION-AWARE MERGE</span><b>safe to omit?</b></div>
        <div class="delete-state reclaimed-state"><span>T2+ · MERGE + REF=0</span><strong>New Segment _5</strong><div class="doc-row empty-row"><b>#D2048 absent</b><i>bytes freed</i></div><small>旧文件无引用后才删除</small></div>
      </section>
      <div class="delete-lesson"><b>API 删除成功</b>、<b>Search 不再命中</b>、<b>磁盘空间回收</b>是三个不同时间点。</div>
    </div>`;
  }

  function deleteRecordsMarkup() {
    return `<div class="physical-scene delete-records-topology">
      <section class="delete-origin"><header>DELETE /sku-8821 · seq_no=45 · term=7</header><div><b>旧业务 Document</b><code>docID 42 · __soft_deletes=1</code><small>Refresh 后普通 Search 过滤</small></div></section>
      <section class="delete-records-rack">
        <button class="delete-record heap-record hotspot" type="button" data-deep-open data-component-name="① LiveVersionMap · DeleteVersionValue" data-component-detail="Heap entry：uid → version、seq_no、primary_term、deleted=true、delete time。它让 realtime GET 立即 404，并参与版本/迟到操作判断；不是完整业务文档。"><span>JVM HEAP · NOW</span><strong>DeleteVersionValue</strong><dl><dt>uid</dt><dd>sku-8821</dd><dt>deleted</dt><dd>true</dd><dt>seq/term</dt><dd>45 / 7</dd><dt>time</dt><dd>now</dd></dl><small>回答：现在最新状态是什么？</small></button>
        <button class="delete-record translog-record hotspot" type="button" data-deep-open data-component-name="② Translog · Delete Operation" data-component-detail="顺序日志记录 id、routing、seq_no、primary_term 等删除操作。最近 Lucene commit 之后若进程崩溃，恢复时可以重放。"><span>NVMe LOG · RECOVERY</span><strong>DELETE operation</strong><dl><dt>id</dt><dd>sku-8821</dd><dt>routing</dt><dd>tenant-17</dd><dt>seq/term</dt><dd>45 / 7</dd><dt>location</dt><dd>gen12@10420</dd></dl><small>回答：Commit 前崩溃怎么恢复？</small></button>
        <button class="delete-record lucene-record hotspot" type="button" data-deep-open data-component-name="③ Lucene · Internal Tombstone" data-component-detail="Engine 构造的内部 Lucene Document，含 _tombstone、uid、seq_no、primary_term、routing，并且自身也带 __soft_deletes；普通 Search 看不到，retention policy 可保留它用于恢复历史。"><span>LUCENE HISTORY</span><strong>soft-deleted tombstone</strong><dl><dt>_tombstone</dt><dd>delete</dd><dt>business _source</dt><dd>none</dd><dt>seq/term</dt><dd>45 / 7</dd><dt>soft flag</dt><dd>1</dd></dl><small>回答：复制历史怎样证明删除？</small></button>
      </section>
      <div class="delete-record-lifecycle"><span><b>Heap marker</b> 独立 prune</span><i></i><span><b>Translog</b> Flush/commit 后滚动</span><i></i><span><b>Lucene history</b> Retention-aware Merge</span><i></i><span><b>Old files</b> reader ref=0 后删除</span></div>
      <div class="delete-record-warning"><b>名字相似但不是同一对象</b><span>VersionMap tombstone = Heap 状态项</span><span>Lucene tombstone = 内部历史文档</span><strong>都不是第二份可搜索业务 _source</strong></div>
    </div>`;
  }

  function mergeLifecycleMarkup() {
    return `<div class="physical-scene merge-lifecycle-topology">
      <div class="merge-clock" aria-hidden="true">
        <span><b>T0</b> WRITE / ACK</span><i></i><span><b>T1</b> REFRESH</span><i></i><span><b>T2</b> MERGE</span><i></i><span><b>T3</b> REF=0 / RECLAIM</span>
      </div>
      <section class="merge-physical-rail">
        <button class="merge-stage engine-stage hotspot" type="button" data-deep-open data-component-name="InternalEngine · softUpdateDocument" data-component-detail="UPDATE 会原子地给匹配 uid 的旧文档更新 soft-delete DocValues，并添加完整新文档；DELETE 则添加内部 tombstone，同时 soft-delete 旧版本。Primary/Replica 与 Translog 完成后 API 可先返回，磁盘空间此刻还没回收。">
          <span>01 · PRIMARY ENGINE</span><strong>softUpdateDocument</strong>
          <code>uid=sku-8821</code>
          <div class="engine-ops"><em>UPDATE</em><b>old → soft</b><b>add new v8</b></div>
          <div class="engine-ops delete-op"><em>DELETE</em><b>old → soft</b><b>add tombstone</b></div>
          <small>ACK ≠ Search 隐藏 ≠ 释放空间</small>
        </button>

        <button class="merge-stage marker-stage hotspot" type="button" data-deep-open data-component-name="隐藏的 __soft_deletes DocValues" data-component-detail="标记是 NumericDocValuesField('__soft_deletes', 1)。调用当下可先进入 IndexWriter 的 buffered DocValues updates；应用到已有 Segment 后形成新的 DocValues/FieldInfos generation（扩展名与命名取决于 codec）。DELETE 新增的内部 tombstone 自身也带这个字段，并随新 Segment 落盘。它不是业务 _source，也不是 hard-delete 的 .liv。">
          <span>02 · OLD SEGMENT _2</span><strong>标记写在这里</strong>
          <div class="segment-drawer"><b>_2.cfs / postings / _source</b><small>旧内容保持不可变</small></div>
          <div class="segment-drawer soft-dv"><b>buffered DV update → new generation</b><small>示意：_2_1.{dvd,dvm,fnm} · soft(docID 42)=1</small></div>
          <div class="hard-delete-note"><b>.liv</b><span>是 hard delete liveDocs；不是本页主路径</span></div>
        </button>

        <button class="merge-stage searcher-stage hotspot" type="button" data-deep-open data-component-name="Refresh 与 Searcher 快照" data-component-detail="Refresh 打开新 Searcher；新视图把带 __soft_deletes 的旧版本当作不可见。已在执行的旧 Searcher/PIT 仍可完成自己的 point-in-time 读取，因此它们和新 Searcher 可以短时并存。">
          <span>03 · REFRESH</span><strong>Searcher v44</strong>
          <div class="searcher-view old-view"><b>old v7</b><small>soft=1 · FILTERED</small></div>
          <div class="searcher-view new-view"><b>new v8</b><small>soft absent · VISIBLE</small></div>
          <output>Search: v7 0 hit · v8 1 hit</output>
          <small>旧 Searcher / PIT 可继续持有旧视图</small>
        </button>

        <button class="merge-stage policy-stage hotspot" type="button" data-deep-open data-component-name="SoftDeletesRetentionMergePolicy" data-component-detail="Merge 不等于无条件扔掉所有 soft-deleted 文档。OpenSearch 根据 safe commit、global checkpoint、retention operations 与 retention leases 计算 minRetainedSeqNo；仍需 peer recovery / changes history 的旧操作会被带入新 Segment。">
          <span>04 · BACKGROUND MERGE</span><strong>Retention Gate</strong>
          <div class="merge-input"><b>_1</b><b>_2</b><b>_3</b><i>→</i><strong>_6</strong></div>
          <div class="retention-rule"><em>KEEP HISTORY</em><code>seq_no ≥ minRetained</code></div>
          <div class="retention-rule drop-rule"><em>OMIT OLD</em><code>seq_no &lt; minRetained</code></div>
          <small>先写新 Segment，磁盘可能暂时上升</small>
        </button>

        <button class="merge-stage reclaim-stage hotspot" type="button" data-deep-open data-component-name="旧 Segment 文件回收" data-component-detail="新 Segment 发布后，旧 Segment 还可能被 Searcher、PIT 或 Scroll 引用。引用计数归零且文件不再被当前 commit/reader 使用后，Lucene 才能删除旧文件；这才是磁盘字节真正可回收的时刻。">
          <span>05 · FILE LIFECYCLE</span><strong>什么时候真删除？</strong>
          <div class="old-file-stack"><s>_1.cfs</s><s>_2.cfs</s><s>_3.cfs</s></div>
          <div class="reader-ref"><b>old readers / PIT</b><code>refCount: 2 → 1 → 0</code></div>
          <div class="file-deleter"><span>IndexFileDeleter</span><b>unlink old files ✓</b></div>
          <small>Merge 完成仍不保证磁盘立即下降</small>
        </button>
      </section>
      <div class="merge-three-clocks">
        <span><b>① 操作成功</b><small>Primary/Replica + Translog</small></span>
        <span><b>② 业务不可见</b><small>Refresh 后新 Searcher 过滤</small></span>
        <span><b>③ 物理回收</b><small>Retention 允许 + Merge + ref=0</small></span>
      </div>
    </div>`;
  }

  function distributedSearchMarkup() {
    return `<div class="physical-scene distributed-search">
      <svg class="search-route-lines" viewBox="0 0 1000 190" preserveAspectRatio="none" aria-hidden="true">
        <defs><marker id="search-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7Z"/></marker></defs>
        <path class="query-line" d="M116 95 H255"/><path class="query-line" d="M255 88 C340 88 370 34 438 34"/><path class="query-line" d="M255 95 H438"/><path class="query-line" d="M255 102 C340 102 370 156 438 156"/>
        <path class="return-line" d="M790 34 H835"/><path class="return-line" d="M790 95 H835"/><path class="return-line" d="M790 156 H835"/><path class="return-bus" d="M835 34 V156"/><path class="return-line gather-return" d="M835 156 C730 184 420 182 255 116"/>
        <path class="fetch-line" d="M255 126 C350 178 395 156 438 156"/><path class="fetch-line" d="M790 156 C830 156 842 120 872 112"/>
      </svg>
      <button class="search-client hotspot" type="button" data-deep-open data-component-name="Search Client" data-component-detail="提交 query、filter、sort 与 size；最终还应检查 timed_out 和 _shards.failed。"><span>CLIENT</span><strong>POST /_search</strong><small>query + filter · size=10</small></button>
      <button class="search-coordinator hotspot" type="button" data-deep-open data-component-name="Search Coordinator" data-component-detail="向每个目标 Shard group 扇出请求，收集 Local Top K 并做全局归并。"><span>COORDINATING NODE</span><strong>fan-out / reduce</strong><small>全局请求状态</small></button>
      <section class="search-cluster-frame">
        <header>OPENSEARCH CLUSTER · 每个 shard group 只选一个 copy</header>
        <div class="search-shards">
          <button class="search-shard hotspot" type="button" data-deep-open data-component-name="Shard P0" data-component-detail="在本地 Searcher 的 Lucene Segments 上执行查询，只返回本 Shard 的 Top K 候选。"><span>DATA NODE 0 · P0</span><strong>Lucene Segments</strong><small>local Top K</small></button>
          <button class="search-shard hotspot" type="button" data-deep-open data-component-name="Shard P1" data-component-detail="代表 P1 shard group 被选中的一个 copy；Primary 与 Replica 不会在同一次请求中同时计算。"><span>DATA NODE 1 · P1</span><strong>Lucene Segments</strong><small>local Top K</small></button>
          <button class="search-shard hotspot is-winner" type="button" data-deep-open data-component-name="Shard P2" data-component-detail="本地候选包含 #D2048；Query phase 先返回 docID/score，Fetch phase 才取回 _source。"><span>DATA NODE 2 · P2</span><strong>Lucene Segments</strong><small>#D2048 · docID 42</small></button>
        </div>
      </section>
      <div class="search-result"><span>GLOBAL TOP 10</span><strong>Reduce → winners</strong><small>Fetch 只回胜者所在 Shards</small></div>
      <div class="phase-legend"><span><b>1</b> Scatter query</span><span><b>2</b> Local Top K</span><span><b>3</b> Gather + global reduce</span><span><b>4</b> Fetch winners</span></div>
    </div>`;
  }

  function visualMarkup(item) {
    if (item.mode === "system-primer") return systemPrimerMarkup();
    if (item.mode === "request-anatomy") return requestAnatomyMarkup();
    if (item.mode === "index-contract") return indexContractMarkup();
    if (item.mode === "index-replace") return indexReplaceMarkup();
    if (item.mode === "client-entry") return clientEntryMarkup();
    if (item.mode === "coordinator-routing") return coordinatorRoutingMarkup();
    if (item.mode === "ingest-pipeline") return ingestPipelineMarkup();
    if (item.mode === "physical-write") return physicalWriteMarkup();
    if (item.mode === "physical-get") return physicalGetMarkup();
    if (item.mode === "version-map") return versionMapMarkup();
    if (item.mode === "engine-write-order") return engineWriteOrderMarkup();
    if (item.mode === "search-window") return searchWindowMarkup();
    if (item.mode === "document-rewrite") return documentRewriteMarkup();
    if (item.mode === "update-translation") return updateTranslationMarkup();
    if (item.mode === "delete-timeline") return deleteTimelineMarkup();
    if (item.mode === "delete-records") return deleteRecordsMarkup();
    if (item.mode === "merge-lifecycle") return mergeLifecycleMarkup();
    if (item.mode === "distributed-search") return distributedSearchMarkup();
    const lessonVisual = window.OPENSEARCH_LESSON_VISUAL?.(item);
    if (lessonVisual) return lessonVisual;
    return nodesMarkup(item);
  }

  function factsMarkup(item) {
    return `<div class="fact-rack">${item.facts.map((fact, i) => `<div class="fact-module">
      <span>${String(i + 1).padStart(2, "0")}</span><strong>${esc(fact[0])}</strong><p>${esc(fact[1])}</p>${fact[2] ? `<small>${esc(fact[2])}</small>` : ""}
    </div>`).join("")}</div>`;
  }

  function evidenceMarkup(item) {
    const configs = item.config.map(pair => `<li><span>${esc(pair[0])}</span><code>${esc(pair[1])}</code></li>`).join("");
    return `<footer class="evidence-band">
      <section class="evidence-conclusion"><span>本页结论</span><p>${esc(item.takeaway)}</p></section>
      <section class="evidence-config"><span>关键参数 / 事实</span><ul>${configs}</ul></section>
      <section class="evidence-tradeoff"><span>设计取舍</span><p class="gain">＋ ${esc(item.gain)}</p><p class="cost">－ ${esc(item.cost)}</p></section>
      <section class="evidence-code"><span>实现伪代码</span><pre><code>${esc(item.pseudo)}</code></pre><button type="button" data-deep-open>故障与验证 ↗</button></section>
    </footer>`;
  }

  function coverArtwork() {
    return `<div class="cover-request-lab" aria-hidden="true">
      <header><span>APPLICATION MEMORY</span><b>此刻还没有进入 OpenSearch</b></header>
      <div class="cover-document"><small>BUSINESS OBJECT → JSON</small><strong>#D2048</strong><pre>{
  "sku": "sku-8821",
  "name": "Wireless Headphones",
  "price": 249,
  "tenant_id": "tenant-17"
}</pre></div>
      <div class="cover-journey"><span><b>1</b> 发出请求</span><span><b>2</b> 找到 Shard</span><span><b>3</b> 写入与复制</span><span><b>4</b> Refresh 后搜索</span></div>
    </div>`;
  }

  function slideMarkup(item, i) {
    const isCover = item.mode === "cover";
    const visualLabel = item.section.split("·").at(-1)?.trim() || item.mode;
    return `<article class="slide mode-${esc(item.mode)}" data-slide="${i}" data-stage="${esc(item.stage)}" aria-hidden="true">
      <header class="slide-heading">
        <div><span>${esc(item.section)}</span><h1>${esc(item.question)}</h1><p>${esc(item.intro)}</p></div>
        <div class="slide-identity"><small>${esc(item.stage).toUpperCase()} LAYER</small><code>${String(i + 1).padStart(2, "0")}</code></div>
      </header>
      <div class="visual-board" data-mode="${esc(visualLabel)}">
        ${isCover ? coverArtwork() : visualMarkup(item)}
        ${factsMarkup(item)}
      </div>
      ${evidenceMarkup(item)}
    </article>`;
  }

  function render() {
    stage.innerHTML = slides.map(slideMarkup).join("");
    stage.querySelectorAll(".lesson-visual > section, .lesson-visual > div:not(.lesson-principle):not(.lesson-arrow)").forEach((el, i) => {
      if (el.matches("button, [data-deep-open]") || el.querySelector("button, [data-deep-open]")) return;
      const heading = el.querySelector("header, strong, b, small")?.textContent?.trim() || `物理对象 ${i + 1}`;
      const detail = el.textContent.replace(/\s+/g, " ").trim();
      el.classList.add("lesson-clickable");
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.dataset.deepOpen = "";
      el.dataset.componentName = heading;
      el.dataset.componentDetail = detail;
      el.setAttribute("aria-label", `深挖 ${heading}`);
    });
    overviewGrid.innerHTML = slides.map((item, i) => `<button type="button" data-overview-index="${i}">
      <span>${String(i + 1).padStart(2, "0")} · ${esc(item.section)}</span>
      <strong>${esc(item.question)}</strong><small>${esc(stages.find(([key]) => key === item.stage)?.[1] || item.stage)}</small>
    </button>`).join("");
    document.querySelector("#overview-count").textContent = `OPENSEARCH · ${slides.length} 个问题`;
  }

  function parseHash() {
    const match = location.hash.match(/^#slide-(\d+)$/);
    if (!match) return 0;
    return Math.max(0, Math.min(slides.length - 1, Number(match[1]) - 1));
  }

  function show(nextIndex, updateHash = true) {
    index = Math.max(0, Math.min(slides.length - 1, nextIndex));
    document.querySelectorAll(".slide").forEach((el, i) => {
      const active = i === index;
      el.classList.toggle("is-active", active);
      el.setAttribute("aria-hidden", String(!active));
    });
    const item = slides[index];
    const count = `${String(index + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
    pageCount.textContent = count;
    headerCount.textContent = count;
    pageTitle.textContent = item.title;
    headerTitle.textContent = item.question;
    prev.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    next.classList.toggle("primary", index < slides.length - 1);
    next.querySelector("strong").textContent = index === slides.length - 1 ? "已经完成" : "下一页";
    updateDeep(item);
    document.querySelectorAll("[data-overview-index]").forEach(el => el.classList.toggle("is-current", Number(el.dataset.overviewIndex) === index));
    if (updateHash && location.hash !== `#slide-${index + 1}`) history.pushState({ slide: index + 1 }, "", `#slide-${index + 1}`);
  }

  function updateDeep(item, component = null) {
    const data = item.deep || {};
    const stageName = stages.find(([key]) => key === item.stage)?.[1] || item.stage;
    const failures = [...(data.failure || [])];
    const inspections = [...(data.inspect || [])];
    document.querySelector("#deep-kicker").textContent = component ? `COMPONENT · ${item.section}` : `DEEP DIVE · ${item.section}`;
    document.querySelector("#deep-title").textContent = component?.name || item.question;
    document.querySelector("#deep-stage").textContent = component ? `${component.label || "组件"} · ${stageName}边界` : `当前边界 · ${stageName}`;
    document.querySelector("#deep-boundary").textContent = component
      ? `${component.description} 本页上下文：${data.boundary || item.takeaway}`
      : data.boundary || "本页没有额外边界说明。";
    if (component) {
      failures.unshift(`如果 ${component.name} 在这里变慢、失败或收到错误输入，当前请求会在进入下一边界前停住或降级。`);
      inspections.unshift(["当前组件", `${component.label || "COMPONENT"} · ${component.description}`]);
    }
    document.querySelector("#deep-failure").innerHTML = failures.slice(0, 3).map(row => `<li>${esc(row)}</li>`).join("");
    document.querySelector("#deep-inspect").innerHTML = inspections.slice(0, 4).map(pair => `<p><span>${esc(pair[0])}</span><code>${esc(pair[1])}</code></p>`).join("");
    document.querySelector("#deep-question").textContent = component ? `${component.name} 完成什么工作后，#D2048 才能进入下一边界？` : data.question || "你能用自己的话复述本页因果链吗？";
    document.querySelector("#deep-answer-text").textContent = component ? `${component.description} 之后沿本页主线继续：${item.takeaway}` : data.answer || item.takeaway;
    document.querySelector("#deep-answer").removeAttribute("open");
    const same = slides.map((slide, i) => ({ slide, i })).filter(entry => entry.slide.stage === item.stage && entry.i !== index);
    const nearby = same.sort((a, b) => Math.abs(a.i - index) - Math.abs(b.i - index)).slice(0, 2);
    document.querySelector("#deep-related").innerHTML = nearby.map(entry => `<button type="button" data-related-index="${entry.i}"><span>${String(entry.i + 1).padStart(2, "0")}</span>${esc(entry.slide.question)}</button>`).join("");
    const source = document.querySelector("#deep-source");
    source.href = item.source;
    source.textContent = "查看本页官方依据 ↗";
  }

  function openDeep(component = null) {
    lastFocus = document.activeElement;
    updateDeep(slides[index], component);
    deepPanel.classList.add("is-open");
    deepPanel.setAttribute("aria-hidden", "false");
    deepPanel.inert = false;
    deepToggle.setAttribute("aria-expanded", "true");
    deepScrim.hidden = false;
    requestAnimationFrame(() => deepScrim.classList.add("is-open"));
    document.body.classList.add("has-panel");
    document.querySelector("#close-deep").focus({ preventScroll: true });
  }

  function closeDeep() {
    deepPanel.classList.remove("is-open");
    deepPanel.setAttribute("aria-hidden", "true");
    deepPanel.inert = true;
    deepToggle.setAttribute("aria-expanded", "false");
    deepScrim.classList.remove("is-open");
    document.body.classList.remove("has-panel");
    setTimeout(() => { if (!deepScrim.classList.contains("is-open")) deepScrim.hidden = true; }, 220);
    if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
  }

  function openOverview() {
    lastFocus = document.activeElement;
    overview.classList.add("is-open");
    overview.setAttribute("aria-hidden", "false");
    overview.inert = false;
    document.querySelector("#open-overview").setAttribute("aria-expanded", "true");
    closeDeep();
    document.querySelector("#close-overview").focus({ preventScroll: true });
  }

  function closeOverview() {
    overview.classList.remove("is-open");
    overview.setAttribute("aria-hidden", "true");
    overview.inert = true;
    document.querySelector("#open-overview").setAttribute("aria-expanded", "false");
    if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
  }

  render();
  show(parseHash(), false);
  prev.addEventListener("click", () => show(index - 1));
  next.addEventListener("click", () => show(index + 1));
  deepToggle.addEventListener("click", () => deepPanel.classList.contains("is-open") ? closeDeep() : openDeep());
  document.querySelector("#close-deep").addEventListener("click", closeDeep);
  deepScrim.addEventListener("click", closeDeep);
  document.querySelector("#open-overview").addEventListener("click", openOverview);
  document.querySelector("#close-overview").addEventListener("click", closeOverview);

  document.addEventListener("click", event => {
    const deepButton = event.target.closest("[data-deep-open]");
    if (deepButton) {
      const nodeIndex = deepButton.dataset.componentIndex;
      const node = nodeIndex === undefined ? null : slides[index].nodes[Number(nodeIndex)];
      const component = node
        ? { label: node[0], name: node[1], description: node[2] }
        : deepButton.dataset.componentName
          ? { label: "PHYSICAL COMPONENT", name: deepButton.dataset.componentName, description: deepButton.dataset.componentDetail || "这是当前物理路径上的一个组件。" }
          : null;
      openDeep(component);
    }
    const overviewButton = event.target.closest("[data-overview-index]");
    if (overviewButton) { show(Number(overviewButton.dataset.overviewIndex)); closeOverview(); }
    const related = event.target.closest("[data-related-index]");
    if (related) { show(Number(related.dataset.relatedIndex)); closeDeep(); }
  });

  window.addEventListener("hashchange", () => show(parseHash(), false));
  window.addEventListener("popstate", () => show(parseHash(), false));
  window.addEventListener("keydown", event => {
    const lessonHotspot = event.target.closest?.("[role='button'][data-deep-open]");
    if (lessonHotspot && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      lessonHotspot.click();
      return;
    }
    if (event.target.closest("input, textarea, select, summary")) return;
    if (event.key === "Escape") { closeDeep(); closeOverview(); }
    if (overview.classList.contains("is-open") || deepPanel.classList.contains("is-open")) return;
    if (event.key === "ArrowRight" || event.key === "PageDown") show(index + 1);
    if (event.key === "ArrowLeft" || event.key === "PageUp") show(index - 1);
    if (event.key.toLowerCase() === "o") openOverview();
    if (event.key.toLowerCase() === "n") openDeep();
  });
})();

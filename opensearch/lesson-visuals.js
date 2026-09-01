(() => {
  "use strict";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function hot(label, title, text, extra = "") {
    return '<button class="lesson-object hotspot ' + extra + '" type="button" data-deep-open data-component-name="' + esc(title) +
      '" data-component-detail="' + esc(text) + '"><small>' + esc(label) + '</small><strong>' + esc(title) +
      '</strong><span>' + esc(text) + '</span></button>';
  }

  function arrow(label = "") {
    return '<div class="lesson-arrow" aria-hidden="true"><span>' + esc(label) + '</span><i></i></div>';
  }

  function routingPhysical() {
    return '<div class="lesson-visual lv-routing-physical">' +
      '<section class="routing-request"><small>01 · SINGLE DOCUMENT CRUD</small><strong>PUT products-v3/_doc/sku-8821</strong><code>?routing=tenant-17</code><span>没有自定义 routing 时使用 _id</span></section>' +
      arrow("choose key") +
      '<section class="routing-hash"><header>02 · DETERMINISTIC ROUTING</header><code>routingValue = request.routing ?? _id</code><strong>hash("tenant-17") mod 3 = 2</strong><span>课程示意 · routing_partition_size=1</span></section>' +
      arrow("one target") +
      '<section class="routing-shards"><header>03 · PRIMARY SHARD GROUPS</header><div><b>P0</b><span>not touched</span></div><div><b>P1</b><span>not touched</span></div><div class="selected"><b>P2</b><span>Primary on Node-2</span><strong>#D2048</strong></div></section>' +
      '<section class="routing-reuse"><b>SAME ROUTING REQUIRED</b><span>GET</span><span>UPDATE</span><span>DELETE</span><em>错一个值，就会去另一个 Shard，看起来像“文档消失”</em></section>' +
      '<div class="lesson-principle"><b>定向不是广播</b><span>一次 Document CRUD 只到一个 Primary shard；若配置 routing_partition_size&gt;1，同一 routing 会落到一个 Shard 子集，并再结合 _id 选定位置。</span></div>' +
    '</div>';
  }

  function bm25Physical() {
    return '<div class="lesson-visual lv-bm25-physical">' +
      '<section class="bm25-query"><small>MATCH QUERY · name</small><strong>wireless · noise · cancelling</strong><code>score = Σ IDF(term) × saturatedTF × lengthNorm</code><span>下面数值仅用于解释方向；真实结果用 _explain</span></section>' +
      '<section class="bm25-doc winner"><header><b>#D2048 · short product name</b><strong>8.7</strong></header><p><mark>wireless</mark> <mark>noise</mark> <mark>cancelling</mark> headphones</p><div class="bm25-signals"><span><b>3 / 3</b> query terms</span><span><b>TF=1</b> each</span><span><b>len=4</b> short field</span></div><div class="score-bars"><i style="--w:38%">wireless · rare</i><i style="--w:25%">noise</i><i style="--w:37%">cancelling</i></div></section>' +
      '<section class="bm25-doc loser"><header><b>doc B · long description</b><strong>3.1</strong></header><p><mark>noise</mark> noise noise noise noise noise noise … 33 more words</p><div class="bm25-signals"><span><b>1 / 3</b> query terms</span><span><b>TF=7</b> saturates</span><span><b>len=40</b> normalized</span></div><div class="score-bars"><i style="--w:76%">noise repeats</i><i class="missing" style="--w:12%">no wireless</i><i class="missing" style="--w:12%">no cancelling</i></div></section>' +
      '<section class="bm25-boundary"><b>SHARD-LOCAL STATISTICS</b><span>query_then_fetch 默认先用各 Shard 的 term/doc stats 评分</span><strong>dfs_query_then_fetch</strong><em>先收集全局统计，更一致但多一次分布式阶段</em></section>' +
      '<div class="lesson-principle"><b>重复词不会无限刷分</b><span>BM25 同时考虑命中哪些词、词有多稀有、TF 饱和与字段长度；业务 boosts 还会继续改变结果。</span></div>' +
    '</div>';
  }

  function mappingPhysical() {
    return '<div class="lesson-visual lv-mapping-physical">' +
      '<section class="mapping-source">' +
        '<header><span>01 · ONE INPUT VALUE</span><b>_source · stored once</b></header>' +
        '<pre>{\n  "name": "Wireless Headphones",\n  "price": 249.0\n}</pre>' +
        '<small>原 JSON 中没有 name.raw；它不是第二份业务字段</small>' +
      '</section>' +
      '<section class="mapping-contract">' +
        '<header>02 · EXPLICIT MAPPING CONTRACT</header>' +
        '<pre>"name": {\n  "type": "text",\n  "fields": {\n    "raw": { "type": "keyword" }\n  }\n}</pre>' +
        '<strong>fields.raw 显式命名这条分叉</strong>' +
        '<small>默认 dynamic string 通常生成 .keyword；本例故意命名 .raw</small>' +
      '</section>' +
      '<section class="mapping-lanes">' +
        '<article class="mapping-lane text-lane">' +
          '<header><span>03A · name : text</span><b>为全文检索写</b></header>' +
          '<div class="mapping-machine"><small>ANALYZER</small><strong>standard + lowercase</strong></div>' +
          '<div class="token-cells"><code>wireless</code><code>headphones</code></div>' +
          '<div class="mapping-media"><b>TERM DICT / POSTINGS</b><code>wireless → [doc 7]</code><code>headphones → [doc 7]</code></div>' +
          '<div class="mapping-read"><strong>match name</strong><span>按 tokens 找候选并评分</span></div>' +
          '<em>text 默认没有 Doc Values；不直接做 sort / agg</em>' +
        '</article>' +
        '<article class="mapping-lane keyword-lane">' +
          '<header><span>03B · name.raw : keyword</span><b>为精确值与列式读取写</b></header>' +
          '<div class="mapping-machine"><small>NO TOKENIZER</small><strong>可选 normalizer</strong></div>' +
          '<div class="token-cells one"><code>Wireless Headphones</code></div>' +
          '<div class="keyword-media"><div class="mapping-media"><b>TERM / POSTINGS</b><code>whole value → [doc 7]</code></div><div class="mapping-media column"><b>DOC VALUES</b><code>doc 7 → whole value</code></div></div>' +
          '<div class="mapping-read"><strong>term · sort · aggregation</strong><span>精确匹配 + docID→value</span></div>' +
          '<em>keyword 默认 index=true 且 doc_values=true</em>' +
        '</article>' +
      '</section>' +
      '<div class="mapping-cost"><b>同一个输入，多个物理表示</b><span>换来不同查询方向；代价是更多磁盘、Refresh、Merge 与重建成本。</span></div>' +
    '</div>';
  }

  function analyzer() {
    return '<div class="lesson-visual lv-analyzer"><section class="analyzer-source"><small>FIELD · name</small><strong>Wireless Noise-Cancelling</strong><span>原始 JSON 值</span></section>' +
      arrow("character stream") +
      '<section class="analyzer-belt">' +
      hot("01 · CHAR FILTER", "normalize punctuation", "Noise-Cancelling → Noise Cancelling") +
      hot("02 · TOKENIZER", "standard tokenizer", "切成三个带位置的 token") +
      hot("03 · TOKEN FILTER", "lowercase", "统一小写；也可做同义词与词形处理") +
      '</section>' + arrow("token stream") +
      '<section class="token-ledger"><header><span>TERM</span><span>POSITION</span><span>OFFSETS</span></header><div><code>wireless</code><b>0</b><span>0–8</span></div><div><code>noise</code><b>1</b><span>9–14</span></div><div><code>cancelling</code><b>2</b><span>15–25</span></div></section>' +
      '<div class="lesson-principle"><b>Analyzer 不会修改 _source</b><span>它为字段生成 Terms；改 Analyzer 后，旧 Segment 里的 Terms 不会自动变化。</span></div></div>';
  }

  function inverted() {
    return '<div class="lesson-visual lv-inverted"><section class="forward-docs"><header>FORWARD · DOC → WORDS</header><div><b>docID 7 · #D2048</b><span>wireless noise cancelling</span></div><div><b>docID 18</b><span>white noise machine</span></div><div><b>docID 31</b><span>noise cancelling earbuds</span></div></section>' +
      arrow("invert once at write time") +
      '<section class="term-dictionary"><header>TERM DICTIONARY</header><code>cancelling</code><code class="is-focus">noise</code><code>wireless</code></section>' +
      arrow("seek noise") +
      '<section class="postings-strip"><small>POSTINGS · noise</small><strong>7 → 18 → 31</strong><span>有序 docID + freq + positions</span></section>' +
      '<div class="lesson-principle"><b>“倒排”是查询方向反转</b><span>搜索 noise 不扫描全部 JSON，而是从 term 直接取得候选 docIDs。</span></div></div>';
  }

  function physicalViews() {
    return '<div class="lesson-visual lv-physical-views"><section class="views-document"><small>ONE LOGICAL DOCUMENT</small><strong>#D2048</strong><code>Lucene docID 7</code></section><section class="views-orbit">' +
      hot("TERM → DOCS", "Inverted Index", "全文匹配与过滤：noise → [7,18,31]", "view-inverted") +
      hot("DOC → VALUE", "Doc Values", "排序与聚合：doc 7 → price 249", "view-values") +
      hot("STORED JSON", "_source", "Fetch、Update 与 Reindex 读取原始 JSON", "view-source") +
      hot("OPTIONAL", "Stored Fields", "单独存储并直接取回选择字段", "view-stored") +
      '</section><div class="lesson-principle"><b>同一个值被写成多个物理方向</b><span>这换来快速读取，也带来磁盘占用、Refresh 和 Merge 写放大。</span></div></div>';
  }

  function replica() {
    return '<div class="lesson-visual lv-replica"><section class="replica-machine primary"><header><span>DATA NODE 2</span><b>P2 PRIMARY</b></header><div class="replica-operation"><small>operation</small><strong>INDEX #D2048</strong><code>seq_no=43 · term=7</code></div><div class="local-media"><span>IndexWriter Buffer</span><span>Translog</span></div><small>决定具体操作与顺序</small></section>' +
      '<div class="replica-wire"><span>PRIMARY PUSH</span><b>ReplicaRequest</b><i></i><code>INDEX + seq_no 43</code></div>' +
      '<section class="replica-machine"><header><span>DATA NODE 1</span><b>R2 REPLICA</b></header><div class="replica-operation"><small>apply</small><strong>INDEX seq_no 43</strong><code>local result → ACK</code></div><div class="local-media"><span>自己的 Buffer</span><span>自己的 Translog</span></div><small>本地执行，不是 Primary 远程写磁盘</small></section>' +
      '<div class="lesson-principle"><b>Replica 默认不是拉取 Document</b><span>Primary 主动推送已经决定的操作；响应 _shards 才说明本次实际成功几份。</span></div></div>';
  }

  function refresh() {
    return '<div class="lesson-visual lv-refresh"><section class="refresh-buffer"><small>JVM · INDEXWRITER BUFFER</small><strong>#D2048</strong><span>realtime GET 可读</span><em>Search 尚不可见</em></section>' +
      arrow("REFRESH · not FLUSH") +
      '<section class="refresh-segment"><header>NEW SEGMENT _4</header><div><b>.tim / .tip</b><b>.doc / .pos</b><b>.dvd / .dvm</b><b>.fdt / .fdx</b></div><span>写出不可变文件并打开 reader</span></section>' +
      arrow("publish Searcher v42") +
      '<section class="searcher-switch"><div><small>OLD QUERY</small><b>Searcher v41</b><span>继续完成旧快照</span></div><div class="is-live"><small>NEW QUERY</small><b>Searcher v42</b><span>#D2048 visible</span></div></section>' +
      '<div class="lesson-principle"><b>Refresh 改的是 Search 可见性</b><span>不是完整 durability commit，也不会因为一次 Refresh 就自动回收 Translog。</span></div></div>';
  }

  function recoveryPhysical() {
    return '<div class="lesson-visual lv-recovery-physical">' +
      '<section class="recovery-state before"><header>01 · BEFORE FLUSH</header><div class="recovery-commit"><small>LUCENE COMMIT · gen 5</small><b>segments_5</b><span>_0 · _1 · checkpoint 42</span></div><div class="recovery-log"><small>TRANSLOG · gen 22</small><code>op 43 · INDEX #D2048</code><code>op 44…57</code></div><em>最近操作尚未进入安全 commit</em></section>' +
      '<section class="recovery-action"><small>02 · FLUSH</small><strong>IndexWriter commit</strong><i></i><b>fsync commit metadata</b><i></i><strong>roll Translog generation</strong><span>自动按阈值执行；手工 Flush 应少用</span></section>' +
      '<section class="recovery-state after"><header>03 · SAFE RESTART POINT</header><div class="recovery-commit live"><small>LUCENE COMMIT · gen 6</small><b>segments_6</b><span>包含至 checkpoint 57</span></div><div class="recovery-log fresh"><small>TRANSLOG · gen 23</small><code>op 58…</code><code>new operations</code></div><em>旧 generation 在满足保留/恢复条件后清理</em></section>' +
      '<section class="recovery-restart"><header>CRASH / RESTART</header><div><b>1</b><span>打开最后有效 Lucene commit</span></div><div><b>2</b><span>重放 commit 之后仍需恢复的 Translog ops</span></div><div><b>3</b><span>恢复最新 Engine 状态，再对外服务</span></div></section>' +
      '<div class="lesson-principle"><b>Flush 缩短恢复尾巴</b><span>耐久写依赖 Translog fsync；Flush 建立新的 Lucene commit，并让更早日志在不再需要时可清理。</span></div>' +
    '</div>';
  }

  function segmentFiles() {
    return '<div class="lesson-visual lv-segment-files"><section class="disk-volume"><header><span>NVME · SHARD P2</span><b>/index/</b></header><div class="commit-file"><b>segments_N</b><span>当前 commit 引用哪些 Segments</span></div><div class="segment-cabinets"><section><header>SEGMENT _0</header><code>_0.tim · term dictionary</code><code>_0.doc/.pos · postings</code><code>_0.dvd · doc values</code><code>_0.fdt · stored fields</code></section><section class="is-focus"><header>SEGMENT _4 · #D2048</header><code>_4.tim · wireless/noise</code><code>_4.doc · docID 42</code><code>_4.dvd · price 249</code><code>_4.fdt · _source JSON</code></section></div></section>' +
      '<div class="lesson-principle"><b>Shard 不是一个不断追加的大 JSON 文件</b><span>它是一套 Lucene Index；每个 Segment 又是一组按用途拆分的 codec 文件。</span></div></div>';
  }

  function bulk() {
    return '<div class="lesson-visual lv-bulk"><section class="ndjson-sheet"><header>ONE HTTP BODY · NDJSON</header><code>{"index":{"_id":"1"}}</code><code>{"price":249}</code><code>{"delete":{"_id":"2"}}</code><code>{"create":{"_id":"3"}}</code></section>' +
      arrow("parse + group by shard") +
      '<section class="bulk-shards"><div><b>P0</b><span>item 2</span></div><div class="is-focus"><b>P1</b><span>item 1 · item 3</span></div><div><b>P2</b><span>no item</span></div></section>' +
      arrow("independent results") +
      '<section class="bulk-results"><header>HTTP 200 · errors:true</header><code class="ok">item 1 · 201 created</code><code class="bad">item 2 · 429 rejected</code><code class="bad">item 3 · 409 conflict</code><strong>逐项判断与安全重试</strong></section>' +
      '<div class="lesson-principle"><b>Bulk 省协议成本，不是事务</b><span>一个 item 失败不会自动回滚其他 item；批次大小还要同时看字节数、耗时与队列。</span></div></div>';
  }

  function replicationOptions() {
    return '<div class="lesson-visual lv-replication-options"><section class="replication-lane document-lane"><header><span>DOCUMENT REPLICATION · DEFAULT</span><b>复制“操作”</b></header><div class="replication-role"><small>P2 PRIMARY</small><strong>Analyze + Index #D2048</strong><span>build local Buffer / Translog</span></div>' +
      arrow("INDEX op + seq_no 43") +
      '<div class="replication-role"><small>R2 REPLICA</small><strong>Analyze + Index again</strong><span>build its own Buffer / Translog</span></div><footer><b>网络载荷较小</b><span>每个 Replica 重复索引 CPU</span></footer></section><section class="replication-lane segment-lane"><header><span>SEGMENT REPLICATION</span><b>复制“文件”</b></header><div class="replication-role"><small>P2 PRIMARY · REFRESH</small><strong>Build immutable Segment _4</strong><span>publish replication checkpoint</span></div>' +
      arrow("Replica notices checkpoint") +
      '<div class="replication-role"><small>R2 REPLICA</small><strong>Fetch changed Segment files</strong><span>node-to-node or remote-backed store</span></div><footer><b>减少 Replica 建索引 CPU</b><span>Refresh 时网络/文件复制峰值</span></footer></section><div class="replication-boundary"><b>关键差异不在“有没有 Replica”</b><span>两者都有完整 Shard copies；变的是 Primary 与 Replica 之间传递的复制单元、搜索可见性与恢复成本。</span></div></div>';
  }

  function canMatchPhysical() {
    return '<div class="lesson-visual lv-canmatch-physical"><section class="range-query"><small>REWRITTEN RANGE QUERY</small><strong>timestamp ≥ 2026-08-01</strong><span>先问“能否证明不可能命中？”</span></section><section class="shard-minmax"><div class="skip"><small>P0 · metadata</small><b>max = 2025-12-31</b><span>range outside</span><strong>SKIP</strong></div><div><small>P1 · metadata</small><b>max = 2026-08-20</b><span>cannot exclude</span><strong>QUERY</strong></div><div class="focus"><small>P2 · metadata</small><b>max = 2026-08-25</b><span>may contain #D2048</span><strong>QUERY</strong></div></section><section class="canmatch-cost"><div><b>收益</b><span>P0 不创建完整 Query context</span></div><div><b>代价</b><span>先增加一次轻量预过滤往返</span></div><div><b>边界</b><span>true 只表示不能排除，不保证有 hit</span></div></section></div>';
  }

  function queryCompiler() {
    return '<div class="lesson-visual lv-query"><section class="query-source"><small>MATCH QUERY · name</small><strong>Wireless noise cancelling</strong></section>' +
      arrow("search_analyzer") +
      '<section class="query-tokens"><code>wireless</code><code>noise</code><code>cancelling</code></section>' +
      arrow("build + rewrite") +
      '<section class="query-tree"><header>EXECUTABLE LUCENE QUERY</header><div class="query-root">BooleanQuery · SHOULD</div><div><span>TermQuery(name:wireless)</span><span>TermQuery(name:noise)</span><span>TermQuery(name:cancelling)</span><span class="filter">FILTER in_stock:true</span></div></section>' +
      '<div class="lesson-principle"><b>用户输入先被编译成 Query Tree</b><span>Analyzer、operator、minimum_should_match 与 filter 决定候选集合和评分成本。</span></div></div>';
  }

  function ars() {
    return '<div class="lesson-visual lv-ars"><section class="shard-copy-group"><header><span>SHARD GROUP P2</span><b>每次请求只选一个 copy</b></header><div class="copy-card slow"><small>P2 · NODE-2</small><strong>queue 18</strong><meter min="0" max="20" value="18"></meter><span>EWMA 84ms</span><em>avoid</em></div><div class="copy-card selected"><small>R2 · NODE-1</small><strong>queue 1</strong><meter min="0" max="20" value="1"></meter><span>EWMA 12ms</span><em>selected</em></div></section><section class="ars-console"><small>ADAPTIVE REPLICA SELECTION</small><code>score = queue + service time + network</code><strong>R2 wins this request</strong><span>下一次会重新评估，不是固定轮询</span></section><div class="lesson-principle"><b>Replica 可以扩展读取</b><span>GET/Search 可选择 Primary 或 Replica；写入仍先由唯一 Primary 建立顺序。</span></div></div>';
  }

  function topK() {
    return '<div class="lesson-visual lv-topk"><section class="segment-candidates"><header>ONE SHARD SEARCHER</header><div><b>Segment _0</b><span>doc 7 · 4.1</span><span>doc 18 · 2.7</span></div><div><b>Segment _1</b><span>doc 42 · 6.8</span><span>doc 55 · 3.2</span></div><div><b>Segment _4</b><span>doc 81 · 5.9</span><span>doc 99 · 1.4</span></div></section>' +
      arrow("bounded priority queue") +
      '<section class="topk-heap"><header>LOCAL TOP K · K=3</header><ol><li><b>doc 42</b><span>6.8 · #D2048</span></li><li><b>doc 81</b><span>5.9</span></li><li><b>doc 7</b><span>4.1</span></li></ol><code>ScoreDoc(docID, score, sortValues)</code><small>此时没有完整 _source</small></section></div>';
  }

  function caches() {
    return '<div class="lesson-visual lv-caches"><section class="cache-stack">' +
      hot("OPENSEARCH · SHARD", "Request Cache", "缓存 Shard 级完整响应，常用于 size=0 聚合", "cache-request") +
      hot("LUCENE · SEGMENT", "Query Cache", "缓存符合条件的 filter/query 结果或 docID 集合", "cache-query") +
      hot("OPERATING SYSTEM", "Page Cache", "缓存 postings、Doc Values、_source 等 Lucene 文件页", "cache-page") +
      '<div class="cache-disk"><small>NVME / EBS</small><b>IMMUTABLE LUCENE FILES</b></div></section><section class="cache-question"><b>先问缓存的对象是什么</b><span>整段 Shard 响应？</span><span>Segment 上的匹配集合？</span><span>某个文件页？</span><strong>三层命中率不能互相替代</strong></section></div>';
  }

  function reduce() {
    return '<div class="lesson-visual lv-reduce"><section class="local-rankings"><div><small>P0</small><b>7.1 · A</b><b>5.2 · B</b><b>4.0 · C</b></div><div><small>P1</small><b>6.9 · D</b><b>5.5 · E</b><b>4.8 · F</b></div><div class="is-focus"><small>P2</small><b>6.8 · #D2048</b><b>6.0 · G</b><b>3.9 · H</b></div></section>' +
      arrow("coordinator k-way merge") +
      '<section class="global-ranking"><header>GLOBAL TOP 4</header><ol><li>7.1 · A</li><li>6.9 · D</li><li class="is-focus">6.8 · #D2048</li><li>6.0 · G</li></ol><small>只保留 winner 的 shard + docID + sort values</small></section><div class="lesson-principle"><b>Local Top K 不是最终答案</b><span>Coordinator 还要跨 Shards 归并；K、排序和聚合都会增加其 heap/CPU。</span></div></div>';
  }

  function fetch() {
    return '<div class="lesson-visual lv-fetch"><section class="winner-refs"><header>GLOBAL WINNER REFERENCES</header><code>P2 · docID 42 · score 6.8</code><code>P0 · docID 7 · score 7.1</code><small>没有完整 _source</small></section>' +
      arrow("group by shard") +
      '<section class="fetch-disk"><header>DATA NODE 2 · P2</header><div><b>docID 42</b><span>stored fields / _source</span><span>highlight / script_fields</span></div><pre>{ "_id":"sku-8821", "_source":{...} }</pre></section>' +
      arrow("assemble hits") +
      '<section class="response-envelope"><small>HTTP RESPONSE</small><strong>hits.hits[]</strong><span>_id · _score · _source · fields</span></section><div class="lesson-principle"><b>Query 选人，Fetch 取档案</b><span>大 _source、高亮与脚本字段会把瓶颈从评分转到磁盘、CPU 和网络。</span></div></div>';
  }

  function aggregation() {
    return '<div class="lesson-visual lv-aggregation"><section class="partial-buckets"><div><small>P0</small><b>Acme 12</b><b>Nova 8</b></div><div><small>P1</small><b>Acme 9</b><b>Orbit 7</b></div><div><small>P2</small><b>Nova 11</b><b>Acme 4</b></div></section>' +
      arrow("partial reduce → final reduce") +
      '<section class="bucket-tree"><header>COORDINATOR BUCKET TREE</header><div class="bucket-root"><b>brand</b><span>merge partial counts</span></div><div><strong>Acme 25</strong><strong>Nova 19</strong><strong>Orbit 7</strong></div><small>高基数 × 多层 buckets 可能触发 max_buckets / breaker</small></section><div class="lesson-principle"><b>Shard 先局部聚合</b><span>不是把全部原始文档拉回 Coordinator；但 partial bucket 数量仍可能耗尽 heap。</span></div></div>';
  }

  function pagination() {
    return '<div class="lesson-visual lv-pagination"><section class="pagination-method from-size"><header>FROM + SIZE · 10000 + 20</header><div><span>P0 keeps</span><b>10,020</b></div><div><span>P1 keeps</span><b>10,020</b></div><div><span>P2 keeps</span><b>10,020</b></div><strong>Coordinator 丢弃前 10,000</strong><small>成本随深度 × Shards 增长</small></section><section class="pagination-method after"><header>PIT + SEARCH_AFTER</header><div class="sort-cursor"><small>last sort values</small><code>[249.0,"sku-8821"]</code></div><div><b>P0</b><span>continue after cursor</span></div><div><b>P1</b><span>continue after cursor</span></div><div><b>P2</b><span>continue after cursor</span></div><strong>稳定 Segment 视图</strong><small>需要唯一 tiebreaker 与 PIT 生命周期</small></section></div>';
  }

  function partial() {
    return '<div class="lesson-visual lv-partial"><section class="shard-status"><header>ONE SEARCH · THREE SHARDS</header><div class="ok"><b>P0</b><span>31ms</span><strong>OK</strong></div><div class="ok"><b>P1</b><span>42ms</span><strong>OK</strong></div><div class="bad"><b>P2</b><span>timeout</span><strong>FAILED</strong></div></section><section class="partial-response"><header>HTTP 200 CAN BE INCOMPLETE</header><pre>{ "timed_out": true,\\n  "_shards": { "total":3, "successful":2, "failed":1 },\\n  "hits": { "...": "partial" } }</pre><div><span>宽松</span><b>返回 partial + failures</b></div><div><span>严格</span><b>业务拒绝不完整结果</b></div></section><div class="lesson-principle"><b>响应成功分两层</b><span>先看 HTTP，再看 timed_out、_shards.failed 与 failures。</span></div></div>';
  }

  function vectorMap() {
    return '<div class="lesson-visual lv-vector-map"><section class="vector-source"><small>ONE PRODUCT</small><strong>#D2048</strong><span>Wireless noise cancelling headphones</span></section><section class="dual-index-path"><div><header>LEXICAL PATH</header><b>Analyzer</b><i></i><b>Terms / Postings</b><span>精确词、稀有词、过滤</span></div><div><header>SEMANTIC PATH</header><b>Embedding</b><i></i><b>Vector / HNSW</b><span>语义距离、近邻候选</span></div></section><section class="hybrid-meet"><b>HYBRID SEARCH</b><span>两路分别召回</span><strong>Normalize / Rank Fusion → Fetch</strong></section><div class="lesson-principle"><b>向量不是替代关键词</b><span>同一 Document 同时拥有倒排与向量结构，两路证据在全局排序阶段才合并。</span></div></div>';
  }

  function embeddingPhysical() {
    return '<div class="lesson-visual lv-embedding-physical">' +
      '<section class="embedding-input"><small>01 · MODEL INPUT</small><strong>name + description</strong><pre>Wireless headphones\nfor long flights</pre><span>normalize · truncate · template</span></section>' +
      arrow("model boundary") +
      '<section class="embedding-model"><header>02 · EMBEDDING MODEL · v3</header><div><b>Tokenizer</b><span>model tokens</span></div><i></i><div><b>Inference</b><span>neural layers</span></div><i></i><div><b>Pooling / normalize</b><span>one fixed vector</span></div><em>模型 + 预处理共同定义坐标系</em></section>' +
      arrow("float[768]") +
      '<section class="embedding-output"><small>03 · VALIDATE + WRITE</small><div class="vector-ledger"><code>.12</code><code>-.07</code><code>.31</code><code>…</code><code>.04</code></div><b>length = mapping.dimension</b><span>description_vector</span><div class="write-choices"><em>APP / BATCH</em><em>INGEST / ML</em></div></section>' +
      '<div class="lesson-principle"><b>维度相同不代表坐标兼容</b><span>Query 与 Document 必须使用相同或明确兼容的模型版本、输入拼接、截断与归一化规则。</span></div>' +
    '</div>';
  }

  function vectorMappingPhysical() {
    return '<div class="lesson-visual lv-vector-mapping-physical">' +
      '<section class="vector-mapping-code"><header>01 · IMMUTABLE FIELD CONTRACT</header><pre>"description_vector": {\n  "type": "knn_vector",\n  "dimension": 768,\n  "space_type": "cosinesimil",\n  "mode": "in_memory",\n  "method": {\n    "name": "hnsw",\n    "engine": "lucene",\n    "parameters": { "m":16,\n      "ef_construction":100 }\n  }\n}</pre></section>' +
      '<section class="vector-contract-knobs"><header>02 · EACH KNOB CHANGES PHYSICS</header><div><b>dimension · 768</b><span>每条向量长度；容量与距离计算乘数</span></div><div><b>space · cosine</b><span>什么叫“近”；必须匹配模型假设</span></div><div><b>engine + method</b><span>Lucene/Faiss × HNSW/IVF；支持矩阵依版本</span></div><div><b>m / ef_construction</b><span>连边规模 / 建图候选宽度；不可在线随意改</span></div></section>' +
      '<section class="vector-physical-result"><header>03 · PER FIELD × PER SEGMENT</header><div class="vector-files"><b>vector values</b><span>doc 7 → float[768]</span><b>ANN graph</b><span>doc 7 ↔ neighbor IDs</span></div><div class="vector-mode-switch"><div><small>IN_MEMORY</small><strong>1x default</strong><span>热结构 / 低延迟</span></div><div><small>ON_DISK</small><strong>compressed</strong><span>低内存 / I/O + rescore</span></div></div><em>mode / compression / engine 组合需按部署版本验证</em></section>' +
      '<div class="lesson-principle"><b>Mapping 先锁定可搜索空间</b><span>写入之后才发现 dimension、distance 或 method 错误，通常意味着新建索引并重写全部向量。</span></div>' +
    '</div>';
  }

  function annQueryPhysical() {
    const segment = (name, focus) => '<div class="ann-segment ' + (focus ? 'focus' : '') + '"><small>' + name + '</small><span>enter</span><i></i><span>explore</span><i></i><b>' + (focus ? '#D2048 · .91' : 'local neighbors') + '</b></div>';
    return '<div class="lesson-visual lv-ann-query-physical">' +
      '<section class="ann-query-input"><small>01 · QUERY SIDE</small><strong>best headphones for flights</strong><span>embedding model v3</span><div class="vector-ledger"><code>.09</code><code>-.11</code><code>…</code></div><b>q · float[768]</b></section>' +
      arrow("fan out") +
      '<section class="ann-shards"><header>02 · ONE COPY OF EACH SHARD · EACH SEGMENT HAS ITS OWN GRAPH</header><div><article><b>P0</b>' + segment('_0', false) + segment('_3', false) + '</article><article><b>P1</b>' + segment('_1', false) + segment('_5', false) + '</article><article class="selected"><b>P2</b>' + segment('_2', false) + segment('_4', true) + '</article></div><footer><code>local Top K per shard</code><span>bounded graph traversal ≠ scan all vectors</span></footer></section>' +
      arrow("reduce") +
      '<section class="ann-global"><small>03 · COORDINATOR</small><b>merge shard candidates</b><ol><li>#D2048 · .91</li><li>doc A · .89</li><li>doc B · .86</li></ol><strong>global size=10 → Fetch</strong><span>k / ef_search 语义随 engine 与版本而异</span></section>' +
      '<div class="lesson-principle"><b>ANN 只是 Shard 内候选生成器</b><span>端到端还包含 query embedding、每 Segment 图遍历、Shard local Top K、全局 Reduce 与 Fetch。</span></div>' +
    '</div>';
  }

  function vectorLifecyclePhysical() {
    return '<div class="lesson-visual lv-vector-lifecycle-physical">' +
      '<section class="vector-life-old"><header>01 · OLD IMMUTABLE SEGMENT _4</header><div class="life-doc deleted"><b>docID 7 · #D2048</b><span>text v1 + vector v3</span><em>__soft_deletes = 1</em></div><div class="life-graph"><i></i><i></i><i class="dead"></i><i></i><i></i><span>旧图节点字节仍存在</span></div></section>' +
      '<section class="vector-life-new"><header>02 · UPDATE CREATES A NEW VERSION</header><div class="life-pipeline"><span>new text</span><i></i><span>embed v3</span><i></i><span>new float[768]</span></div><div class="life-doc live"><b>docID 42 · #D2048</b><span>full new Lucene doc + vector</span><em>visible after Refresh</em></div></section>' +
      '<section class="vector-life-merge"><header>03 · MERGE REBUILDS OUTPUT SEGMENT</header><div><b>copy retained live docs</b><span>drop old version only when retention permits</span></div><div><b>build new vector values + ANN graph</b><span>CPU / I/O / temporary disk</span></div><div><b>release old files later</b><span>wait for Searcher / PIT references</span></div></section>' +
      '<section class="vector-capacity-stack"><small>PEAK CAPACITY</small><b>old Segment</b><b>+ new Segment</b><b>+ merge output</b><b>× Replica copies</b><strong>不是 vectors × dim × 4 就够</strong></section>' +
      '<div class="lesson-principle"><b>向量 Update 不是原地改数组</b><span>它要重新推理、写完整新 Document、保留旧版本一段时间，并在 Merge 时重建 ANN 结构。</span></div>' +
    '</div>';
  }

  function hnsw() {
    return '<div class="lesson-visual lv-hnsw"><svg viewBox="0 0 1000 350" role="img" aria-label="HNSW 分层近邻图"><g class="hnsw-links upper"><path d="M150 68 L500 52 L845 82"/><path d="M150 68 L845 82"/></g><g class="hnsw-links middle"><path d="M110 170 L310 140 L505 178 L700 135 L890 178"/><path d="M110 170 L505 178 L890 178"/><path d="M310 140 L700 135"/></g><g class="hnsw-links lower"><path d="M88 290 L190 258 L285 305 L390 255 L500 298 L610 258 L710 306 L805 262 L915 292"/><path d="M88 290 L285 305 L500 298 L710 306 L915 292"/></g><g class="hnsw-points upper"><circle cx="150" cy="68" r="15"/><circle cx="500" cy="52" r="17"/><circle cx="845" cy="82" r="15"/></g><g class="hnsw-points middle"><circle cx="110" cy="170" r="12"/><circle cx="310" cy="140" r="12"/><circle cx="505" cy="178" r="14"/><circle cx="700" cy="135" r="12"/><circle cx="890" cy="178" r="12"/></g><g class="hnsw-points lower"><circle cx="88" cy="290" r="10"/><circle cx="190" cy="258" r="10"/><circle cx="285" cy="305" r="10"/><circle cx="390" cy="255" r="10"/><circle class="is-target" cx="500" cy="298" r="17"/><circle cx="610" cy="258" r="10"/><circle cx="710" cy="306" r="10"/><circle cx="805" cy="262" r="10"/><circle cx="915" cy="292" r="10"/></g><text x="20" y="62">L2 · sparse entry</text><text x="20" y="145">L1 · regional hops</text><text x="20" y="255">L0 · dense neighbors</text><text class="target-label" x="463" y="337">#D2048</text></svg><div class="hnsw-caption"><b>上层远跳 → 下层细搜</b><span>只探索有限候选所以快但近似；每个 Segment 的图仍需在 Shard 内合并。</span></div></div>';
  }

  function hybrid() {
    return '<div class="lesson-visual lv-hybrid"><section class="rank-list"><header>BM25 · SCALE A</header><ol><li>A · 12.4</li><li class="is-focus">#D2048 · 8.7</li><li>C · 5.1</li></ol><small>exact words / IDF</small></section><section class="rank-list"><header>ANN · SCALE B</header><ol><li class="is-focus">#D2048 · .91</li><li>D · .89</li><li>A · .72</li></ol><small>semantic similarity</small></section><section class="fusion-engine"><header>SEARCH PIPELINE</header><div><b>normalize scores</b><span>or reciprocal rank fusion</span></div><code>combined = α·lexical + β·semantic</code><strong>#D2048 → global rank 1</strong></section><div class="lesson-principle"><b>不能把 12.4 和 0.91 裸相加</b><span>候选规模、归一化、权重与重排都要用相关性集验证。</span></div></div>';
  }

  function vectorFilterPhysical() {
    const nodes = '<i></i><i></i><i class="allowed"></i><i></i><i class="allowed"></i><i></i><i class="allowed"></i><i></i><i class="allowed"></i><i></i>';
    return '<div class="lesson-visual lv-vector-filter-physical"><section class="vector-filter-method efficient"><header>EFFICIENT FILTER · DURING ANN</header><div class="mini-vector-graph">' + nodes + '<span>Traversal knows allowed IDs</span></div><div class="filter-count"><b>ANN keeps exploring</b><strong>10 / 10 hits</strong></div><small>如果总共有至少 k 条合格文档，目标是稳定返回 k</small></section><section class="vector-filter-method post"><header>POST FILTER · AFTER ANN</header><div class="candidate-strip"><b>10 ANN</b><i></i><strong>remove 7</strong></div><div class="filter-count"><b>no refill traversal</b><strong>3 / 10 hits</strong></div><small>先取近邻再删，严格过滤时显著少于 k</small></section><section class="vector-filter-method exact"><header>FILTER FIRST · EXACT DISTANCE</header><div class="exact-subset"><b>86 allowed docs</b><span>q ↔ every allowed vector</span></div><div class="filter-count"><b>brute-force small subset</b><strong>exact Top 10</strong></div><small>过滤后集合很小时，精确计算可能更便宜</small></section><div class="filter-security"><b>权限边界</b><span>tenant / ACL 过滤必须在检索边界执行；不要先把跨租户 _source 拉回应用再过滤。</span></div></div>';
  }

  function highAvailability() {
    return '<div class="lesson-visual lv-ha"><section class="ha-cluster"><div class="ha-node failed"><small>NODE-2</small><b>P2 PRIMARY</b><span>unavailable</span></div><div class="ha-node promoted"><small>NODE-1</small><b>R2 → P2</b><span>primary_term 7 → 8</span></div><div class="ha-node"><small>NODE-0</small><b>P0 / R1</b><span>healthy</span></div></section><section class="ha-actions"><div><b>1 · DETECT</b><span>node / shard missing</span></div><div><b>2 · QUORUM</b><span>publish one authoritative state</span></div><div><b>3 · PROMOTE</b><span>in-sync Replica takes over</span></div><div><b>4 · RECOVER</b><span>allocate a new Replica</span></div></section><div class="lesson-principle"><b>Replica 是可接管的完整 Shard copy</b><span>但可用性还取决于故障域、in-sync 状态、quorum 与恢复带宽。</span></div></div>';
  }

  function controlPlane() {
    return '<div class="lesson-visual lv-control"><section class="voting-box"><header>CLUSTER-MANAGER ELIGIBLE NODES</header><div><span class="yes">A · YES</span><span class="yes">B · YES</span><span class="down">C · DOWN</span></div><strong>2 / 3 QUORUM</strong><small>只允许一侧发布权威 Cluster State</small></section><section class="state-log"><div><b>term 19</b><span>Node-2 unavailable</span></div><div><b>version 929</b><span>promote in-sync R2</span></div><div><b>publish</b><span>all nodes install new routing table</span></div></section><section class="data-plane-box"><b>DATA PLANE</b><span>新 CRUD/Search 根据 v929 去新 P2 Primary</span><small>Quorum 保护决策，不保存业务 Document</small></section></div>';
  }

  function consistency() {
    return '<div class="lesson-visual lv-consistency"><section class="consistency-row"><div><small>IDENTITY</small><b>_id + routing</b><span>哪个 Shard / Document</span></div><div><small>ORDER</small><b>seq_no + primary_term</b><span>拒绝 stale CAS / old Primary</span></div><div><small>REPLICATION</small><b>Primary → copies</b><span>响应 _shards 成功几份</span></div><div><small>VISIBILITY</small><b>Refresh → Searcher</b><span>GET realtime · Search NRT</span></div></section><div class="consistency-clock"><span>WRITE ACK</span><i></i><span>GET sees latest</span><i></i><span>REFRESH</span><i></i><span>SEARCH sees it</span></div><div class="lesson-principle"><b>不要用一句“最终一致”盖住四个问题</b><span>身份、并发顺序、副本结果与搜索可见性都有不同的 token、响应和时间边界。</span></div></div>';
  }

  function performance() {
    return '<div class="lesson-visual lv-performance"><section class="latency-budget"><small>ONE HYBRID SEARCH</small><strong>latency budget · 120 ms</strong><span>瓶颈由最慢阶段与最热 Shard 决定</span></section><section class="budget-bar"><div style="--w:18%"><b>Embed</b><span>22ms</span></div><div style="--w:12%"><b>Queue</b><span>14ms</span></div><div style="--w:31%"><b>Lexical / ANN</b><span>37ms</span></div><div style="--w:22%"><b>Reduce</b><span>26ms</span></div><div style="--w:17%"><b>Fetch</b><span>21ms</span></div></section><section class="resource-gauges"><div><small>HEAP</small><meter min="0" max="100" value="72"></meter><b>72%</b></div><div><small>VECTOR MEMORY</small><meter min="0" max="100" value="84"></meter><b>84%</b></div><div><small>DISK I/O</small><meter min="0" max="100" value="63"></meter><b>63%</b></div><div><small>HOTTEST SHARD</small><meter min="0" max="100" value="92"></meter><b>92%</b></div></section><div class="lesson-principle"><b>吞吐不是单个参数</b><span>Refresh、Merge、Bulk、Shards、Caches 与 ANN 在 CPU、heap、native memory、磁盘和网络之间换成本。</span></div></div>';
  }

  function diagnosis() {
    return '<div class="lesson-visual lv-diagnosis"><section class="diagnosis-symptom"><small>SYMPTOM</small><strong>Search P99 = 4.0s</strong><span>先分阶段，不从参数表猜</span></section><section class="diagnostic-tree"><div class="root"><b>所有请求都慢？</b></div><div class="branches"><section><strong>入口 / 协调</strong><span>429 · queue · breaker</span></section><section><strong>某个 Shard</strong><span>hot routing · recovery</span></section><section><strong>Lucene / Vector</strong><span>segments · merge · ANN</span></section><section><strong>系统资源</strong><span>GC · disk · network</span></section></div></section><section class="evidence-chain"><b>同一时间轴</b><span>client wall</span><i></i><span>task / slow log</span><i></i><span>node stats</span><i></i><span>deploy / traffic</span></section><div class="lesson-principle"><b>一次 hot_threads 不是根因</b><span>需要用可证伪假设，把请求、指标、变更和重复采样串起来。</span></div></div>';
  }

  const renderers = new Map([
    ["CREATE 06 · ROUTING", routingPhysical],
    ["CREATE 07 · MAPPING", mappingPhysical],
    ["CREATE 08 · ANALYZER", analyzer],
    ["CREATE 09 · INVERTED INDEX", inverted],
    ["CREATE 10 · PHYSICAL STRUCTURES", physicalViews],
    ["CREATE 13 · REPLICA", replica],
    ["CREATE 14 · REFRESH", refresh],
    ["CREATE 15 · SEGMENT FILES", segmentFiles],
    ["CREATE 16 · FLUSH + RECOVERY", recoveryPhysical],
    ["CREATE 17 · REPLICATION OPTIONS", replicationOptions],
    ["CREATE 18 · BULK", bulk],
    ["SEARCH 02 · QUERY ANALYSIS", queryCompiler],
    ["SEARCH 03 · COPY SELECTION", ars],
    ["SEARCH 04 · CAN MATCH", canMatchPhysical],
    ["SEARCH 05 · LOCAL TOP K", topK],
    ["SEARCH 06 · BM25", bm25Physical],
    ["SEARCH 07 · CACHES", caches],
    ["SEARCH 08 · GLOBAL REDUCE", reduce],
    ["SEARCH 09 · FETCH", fetch],
    ["SEARCH 10 · AGGREGATIONS", aggregation],
    ["SEARCH 11 · PAGINATION", pagination],
    ["SEARCH 12 · PARTIAL RESULTS", partial],
    ["VECTOR 01 · MAP", vectorMap],
    ["VECTOR 02 · EMBEDDING", embeddingPhysical],
    ["VECTOR 03 · MAPPING", vectorMappingPhysical],
    ["VECTOR 04 · HNSW", hnsw],
    ["VECTOR 05 · ANN QUERY", annQueryPhysical],
    ["VECTOR 06 · FILTERING", vectorFilterPhysical],
    ["VECTOR 07 · HYBRID", hybrid],
    ["VECTOR 08 · LIFECYCLE", vectorLifecyclePhysical],
    ["PRINCIPLE 02 · HIGH AVAILABILITY", highAvailability],
    ["PRINCIPLE 03 · CONTROL PLANE", controlPlane],
    ["PRINCIPLE 04 · CONSISTENCY", consistency],
    ["PRINCIPLE 05 · PERFORMANCE", performance],
    ["PRINCIPLE 06 · DIAGNOSIS", diagnosis]
  ]);

  window.OPENSEARCH_LESSON_VISUAL = item => {
    const renderer = renderers.get(item.section);
    return renderer ? renderer(item) : "";
  };
})();

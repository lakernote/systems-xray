(() => {
  "use strict";
  const esc = value => String(value ?? "").replace(/[&<>\"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[ch]);
  const data = (item, fallback = []) => item.visual?.nodes?.length ? item.visual.nodes : fallback;
  const box = (node, hot = false) => `<button type="button" class="pg-box hotspot${hot ? " pg-hot" : ""}" data-component="${esc(node[0])}" data-detail="${esc(node[2] || node[1])}"><span>${esc(node[3] || "PHYSICAL COMPONENT")}</span><strong>${esc(node[0])}</strong><small>${esc(node[1])}</small></button>`;
  const arrow = label => `<div class="pg-arrow"><span>${esc(label || "")}</span></div>`;

  function cover() {
    return `<div class="physical-scene pg-scene pg-cover"><div class="pg-cover-copy"><span>POSTGRESQL · ROW JOURNEY</span><h2>一行 Row，<br>穿过事务与磁盘。</h2><p><code>INSERT INTO orders(id,user_id,total,status)<br>VALUES ('A1024',9527,99.80,'NEW');</code></p></div><div class="row-orbit"><div class="row-core"><small>HEAP TUPLE</small><strong>A1024</strong><em>xmin · xmax · ctid</em></div><span class="pg-orbit-label a">PLANNER</span><span class="pg-orbit-label b">B-TREE</span><span class="pg-orbit-label c">WAL</span><span class="pg-orbit-label d">MVCC</span></div></div>`;
  }
  function atlas() {
    return `<div class="physical-scene pg-scene pg-atlas"><section class="pg-rack client"><header>APPLICATION HOST</header><div class="slot">JDBC / pgx</div><div class="slot hot">Transaction #T501</div><div class="slot">PgBouncer</div></section>${arrow("PG PROTOCOL")}<section class="pg-rack server"><header>POSTGRESQL INSTANCE</header><div class="pg-server-grid"><div class="slot">Postmaster</div><div class="slot hot">Backend PID 18420</div><div class="slot">Planner / Executor</div><div class="slot shared">Shared Buffers · WAL Buffers · Lock Tables<small>shared memory</small></div></div></section>${arrow("WRITE")}<section class="pg-rack storage"><header>PGDATA · NVMe</header><div class="pg-storage-files"><code>base/…/orders</code><code>base/…/orders_pkey</code><code>pg_wal/0000…</code></div></section></div>`;
  }
  function flow(item) {
    const nodes = data(item, [["Client","send SQL"],["Backend","execute"],["Storage","persist"]]);
    return `<div class="physical-scene pg-scene pg-flow${nodes.length > 3 ? " five" : ""}">${nodes.map((node,i) => `${i ? arrow(item.visual?.arrows?.[i-1] || "") : ""}${box(node,i === (item.visual?.hot ?? Math.min(1,nodes.length-1)))}`).join("")}</div>`;
  }
  function processes(item) {
    const nodes = data(item, [["Backend 1","session A"],["Backend 2","T501"],["Backend 3","session C"]]);
    return `<div class="physical-scene pg-scene pg-processes"><button class="pg-box postmaster hotspot" data-component="Postmaster" data-detail="监听连接、派生 Backend；不执行这条 SQL。"><span>LISTENER · PID 1</span><strong>Postmaster</strong><small>listen :5432</small></button>${arrow("fork") }<section class="pg-rack backend-bank"><header>BACKEND PROCESSES · PRIVATE MEMORY</header>${nodes.map((n,i)=>`<button class="backend-proc hotspot${i===1?" hot":""}" data-component="${esc(n[0])}" data-detail="${esc(n[1])}"><b>${esc(n[0])}</b><small>${esc(n[1])}</small></button>`).join("")}</section><aside class="shared-bank"><button class="pg-box hotspot" data-component="Shared Memory" data-detail="所有 Backend 通过受控并发访问共享内存。"><span>SHARED</span><strong>Buffers</strong><small>WAL · locks · cache</small></button></aside></div>`;
  }
  function protocol(item) {
    const frames = data(item, [["Parse","SQL + $1 types"],["Bind","params → portal"],["Execute","run portal"],["Sync","transaction boundary"]]);
    return `<div class="physical-scene pg-scene pg-wire"><button class="pg-box wire-client hotspot" data-component="Frontend" data-detail="驱动 PostgreSQL wire protocol。"><span>JDBC CONNECTION</span><strong>Client</strong><small>TCP/TLS stream</small></button>${arrow("bytes")}<section class="wire-stream">${frames.map(f=>`<div class="wire-frame"><b>${esc(f[0])}</b><code>${esc(f[1])}</code></div>`).join("")}</section>${arrow("messages")}<button class="pg-box wire-server hotspot" data-component="Backend" data-detail="按消息边界解析并推进会话状态。"><span>PID 18420</span><strong>Backend</strong><small>ReadyForQuery</small></button></div>`;
  }
  function plan(item) {
    const n = data(item, [["Index Scan","orders_pkey"],["Heap Fetch","orders"],["Result","A1024"]]);
    return `<div class="physical-scene pg-scene pg-plan"><button class="pg-box sql-sheet hotspot" data-component="SQL" data-detail="SQL 只描述结果，不指定物理算法。"><span>QUERY</span><strong>${esc(item.visual?.sql || "SELECT …")}</strong><small>declarative request</small></button>${arrow("plan")}<div class="plan-tree"><svg viewBox="0 0 500 280" preserveAspectRatio="none"><path d="M250 40V105M250 105L90 205M250 105L410 205"/></svg><button class="plan-node root hotspot" data-component="${esc(n[0][0])}" data-detail="${esc(n[0][1])}">${esc(n[0][0])}</button><button class="plan-node mid hotspot" data-component="${esc(n[1]?.[0]||"Executor")}" data-detail="${esc(n[1]?.[1]||"")}">${esc(n[1]?.[0]||"Executor")}</button><button class="plan-node left">Seq / Index</button><button class="plan-node right">Join / Sort</button></div><aside class="stats-stack"><div>pg_statistic<br>histogram / MCV</div><div>cost model<br>random_page_cost</div><div>EXPLAIN<br>rows · cost · width</div></aside></div>`;
  }
  function buffer(item) {
    const hot = item.visual?.slot ?? 6;
    return `<div class="physical-scene pg-scene pg-buffer"><section class="buffer-table"><header>SHARED_BUFFERS · BUFFER DESCRIPTORS</header>${Array.from({length:10},(_,i)=>`<button class="buffer-slot hotspot${i===hot?" hot dirty":""}" data-component="Buffer ${i}" data-detail="tag=(database,relation,fork,block); pin/refcount/usage_count/dirty。">${i===hot?"orders blk 42":"slot "+i}</button>`).join("")}</section>${arrow("read / write")}<aside class="buffer-side"><button class="pg-box hotspot" data-component="Buffer Manager" data-detail="用 BufferTag 查哈希表，命中则 pin；未命中选择 victim 并读盘。"><span>LOOKUP</span><strong>Buffer Manager</strong><small>pin · lock · dirty</small></button><button class="pg-box hotspot" data-component="Relation File" data-detail="8 kB block 的持久化位置。"><span>PGDATA</span><strong>orders block 42</strong><small>OS page cache / NVMe</small></button></aside></div>`;
  }
  function page(item) {
    const n = data(item, [["PageHeaderData","24 bytes"],["ItemId #7","offset + length"],["Tuple A1024","xmin=501"],["Free Space","pd_lower ↔ pd_upper"]]);
    return `<div class="physical-scene pg-scene pg-page"><section class="page-card"><header class="page-head"><span>HEAP PAGE · BLOCK 42</span><span>8192 BYTES</span></header><div class="page-body"><div class="line-pointers"><span>LP1 → tuple</span><span class="pg-hot">LP7 → A1024</span><span>LP8 → tuple</span></div><div class="tuples"><div class="tuple-cell">tuple #1</div><button class="tuple-cell hot hotspot" data-component="Heap Tuple A1024" data-detail="真实列值与 MVCC 头位于页尾方向。">xmin 501<br>A1024</button><div class="tuple-cell">tuple #8</div><div class="page-free">FREE SPACE</div></div></div><div class="page-special">SPECIAL SPACE · heap 为空；B-Tree 保存 sibling links</div></section><aside class="page-notes">${n.map((x,i)=>box(x,i===2)).join("")}</aside></div>`;
  }
  function tuple(item) {
    const fields = data(item, [["xmin","501"],["xmax","0"],["cid","0"],["ctid","(42,7)"],["infomask","flags"],["null bitmap","bits"],["user data","A1024…"]]);
    return `<div class="physical-scene pg-scene pg-tuple"><div class="tuple-strip">${fields.map((f,i)=>`<button class="tuple-field hotspot${i===item.visual?.hot?" hot":""}" data-component="${esc(f[0])}" data-detail="${esc(f[1])}"><b>${esc(f[0])}</b><small>${esc(f[1])}</small></button>`).join("")}</div><div class="tuple-data"><div><strong>A1024</strong><br><code>columns aligned by pg_attribute</code></div></div></div>`;
  }
  function btree(item) {
    return `<div class="physical-scene pg-scene pg-btree"><div class="btree-tree"><svg viewBox="0 0 600 300" preserveAspectRatio="none"><path d="M300 40L160 125M300 40L455 125M160 125L70 245M160 125L275 245M455 125L530 245"/></svg><button class="bt-page root hotspot" data-component="B-Tree Root" data-detail="比较 separator key，选择 child page。">ROOT · A5000</button><button class="bt-page l1">INTERNAL · A0…</button><button class="bt-page l2">INTERNAL · B0…</button><button class="bt-page leaf1">LEAF · A0001</button><button class="bt-page leaf2 hot hotspot" data-component="Leaf Entry A1024" data-detail="index tuple 保存 key 与 TID=(heap block, line pointer)。">A1024 → (42,7)</button><button class="bt-page leaf3">LEAF · B1024</button></div><aside class="bt-side"><button class="pg-box hotspot" data-component="Metapage" data-detail="索引控制信息与 root 层级入口。"><span>BLOCK 0</span><strong>Metapage</strong><small>root / level</small></button><button class="pg-box hotspot" data-component="Heap TID" data-detail="普通 Index Scan 仍需通过 TID 回表检查 MVCC。"><span>POINTER</span><strong>(42,7)</strong><small>heap block · item</small></button></aside></div>`;
  }
  function wal(item) {
    return `<div class="physical-scene pg-scene pg-wal"><section class="wal-memory"><button class="pg-box hotspot" data-component="Dirty Heap Page" data-detail="数据页已在 Shared Buffers 中改变，但可稍后写盘。"><span>SHARED BUFFERS</span><strong>orders blk 42</strong><small>page LSN updated</small></button><button class="pg-box hotspot pg-hot" data-component="WAL Buffers" data-detail="记录重做该变化所需的信息。"><span>SHARED MEMORY</span><strong>WAL Buffers</strong><small>insert / commit records</small></button></section><div class="wal-lane"><div class="wal-line"></div></div><section class="wal-disk"><button class="wal-file hotspot hot" data-component="pg_wal" data-detail="WAL segment 先持久化，数据页可延迟。">pg_wal/000000…</button><button class="wal-file hotspot" data-component="Data File" data-detail="Checkpoint/bgwriter/backend 将 dirty page 写回 relation file。">base/…/orders</button></section></div>`;
  }
  function mvcc(item) {
    const versions = data(item, [["v1 · NEW","xmin=501 xmax=612"],["v2 · PAID","xmin=612 xmax=0"],["v3 · SHIPPED","future"]]);
    return `<div class="physical-scene pg-scene pg-mvcc"><button class="pg-box snapshot-card hotspot" data-component="Snapshot" data-detail="xmin/xmax/xip 决定哪些事务效果对当前语句可见。"><span>SNAPSHOT</span><strong>${esc(item.visual?.snapshot || "XID 620")}</strong><small>active: 612, 619</small></button>${arrow("visibility")}<div class="version-chain">${versions.map((v,i)=>`<button class="version hotspot${v[2]==="dead"?" dead":""}${i===(item.visual?.hot??1)?" hot":""}" data-component="${esc(v[0])}" data-detail="${esc(v[1])}"><b>${esc(v[0])}</b><code>${esc(v[1])}</code><small>ctid → next version</small></button>`).join(arrow("ctid"))}</div><div class="mvcc-result">VISIBLE<br>ROW</div></div>`;
  }
  function lock(item) {
    const sessions = data(item, [["PID 101","UPDATE A1024","GRANTED"],["PID 202","UPDATE A1024","WAIT"],["PID 303","SELECT","RUN"]]);
    return `<div class="physical-scene pg-scene pg-lock"><section class="lock-sessions">${sessions.map((s,i)=>`<button class="session-box hotspot${s[2]==="WAIT"?" wait":""}" data-component="${esc(s[0])}" data-detail="${esc(s[1])}"><b>${esc(s[0])}</b><code>${esc(s[1])}</code><small>${esc(s[2])}</small></button>`).join("")}</section><aside class="lock-table"><div><span>relation</span><b>RowExclusive</b></div><div><span>tuple</span><b>transactionid wait</b></div><div><span>inspect</span><b>pg_locks</b></div></aside></div>`;
  }
  function vacuum(item) {
    return `<div class="physical-scene pg-scene pg-vacuum"><section class="vac-page"><header>BEFORE · HEAP PAGE</header><div class="vac-tuple">LIVE</div><div class="vac-tuple dead">DEAD</div><div class="vac-tuple dead">DEAD</div><div class="vac-tuple">LIVE</div></section><div class="vac-tool">VACUUM</div><section class="vac-page"><header>AFTER · REUSABLE SPACE</header><div class="vac-tuple">LIVE</div><div class="vac-tuple free">FREE</div><div class="vac-tuple free">FREE</div><div class="vac-tuple">LIVE</div></section><aside class="vac-meta"><button class="pg-box hotspot" data-component="FSM" data-detail="记录页面可用空间，帮助后续 INSERT 找页。"><span>_fsm</span><strong>Free Space Map</strong></button><button class="pg-box hotspot" data-component="VM" data-detail="all-visible / all-frozen 两个保守 bit。"><span>_vm</span><strong>Visibility Map</strong></button></aside></div>`;
  }
  function files(item) {
    const files = data(item, [["main fork","16384"],["FSM","16384_fsm"],["VM","16384_vm"],["B-Tree","24576"],["TOAST","pg_toast/…"],["WAL","pg_wal/…"]]);
    return `<div class="physical-scene pg-scene pg-files"><button class="pg-box file-root hotspot" data-component="PGDATA" data-detail="数据库集群的数据目录；不要用文件名推断逻辑对象。"><span>NVMe VOLUME</span><strong>PGDATA</strong><small>base/ · global/ · pg_wal/</small></button>${arrow("relation files")}<div class="file-tree">${files.map((f,i)=>`<button class="file-module hotspot${i===0?" hot":""}" data-component="${esc(f[0])}" data-detail="${esc(f[1])}"><span>RELATION FORK</span><code>${esc(f[1])}</code><small>${esc(f[0])}</small></button>`).join("")}</div></div>`;
  }
  function replication(item) {
    const v = item.visual || {};
    return `<div class="physical-scene pg-scene pg-repl"><section class="repl-node primary"><header><span>PRIMARY</span><span>LSN ${esc(v.primaryLsn||"0/16B6A2C0")}</span></header><button class="proc hotspot" data-component="WAL Sender" data-detail="从 WAL/slot 位置读取字节并流式发送。">walsender</button><div class="disk">pg_wal · commit record</div></section><div class="repl-link"><span>${esc(v.link||"STREAM WAL")}</span><i></i></div><section class="repl-node"><header><span>STANDBY</span><span>replay ${esc(v.replayLsn||"0/16B69F10")}</span></header><button class="proc hotspot" data-component="WAL Receiver" data-detail="Standby 主动连接 Primary，接收并写入本地 WAL。">walreceiver</button><button class="proc hotspot" data-component="Startup Process" data-detail="按 WAL 顺序重放页面变化。">replay / recovery</button><div class="disk">pg_wal · read-only heap</div></section></div>`;
  }
  function diagnostic(item) {
    const n=data(item,[["Activity","pg_stat_activity"],["Wait","wait_event"],["Plan","EXPLAIN ANALYZE"],["I/O","pg_stat_io"],["Locks","pg_locks"],["Bloat","dead tuples"]]);
    return `<div class="physical-scene pg-scene pg-diagnostic"><button class="pg-box diag-query hotspot" data-component="Symptom" data-detail="先确定慢在连接、锁、CPU、I/O、WAL 还是复制。"><span>PRODUCTION</span><strong>${esc(item.visual?.symptom||"p95 latency ↑")}</strong><small>do not guess</small></button><section class="diag-path">${n.map(x=>`<div class="diag-item"><b>${esc(x[0])}</b><code>${esc(x[1])}</code><small>evidence before tuning</small></div>`).join("")}</section></div>`;
  }

  window.renderPgVisual = item => {
    const renderers={cover,atlas,flow,processes,protocol,plan,buffer,page,tuple,btree,wal,mvcc,lock,vacuum,files,replication,diagnostic};
    return (renderers[item.mode] || flow)(item);
  };
})();

(function () {
  'use strict';

  var scene = document.getElementById('world');
  var svg = document.getElementById('physical-topology');
  var viewport = document.getElementById('topology');
  var gsapApi = window.gsap;
  if (gsapApi && window.MotionPathPlugin) gsapApi.registerPlugin(window.MotionPathPlugin);

  function attrs(id, step, extra, label) {
    return 'class="component ' + (extra || '') + '" data-component="' + id + '" data-step="' + step +
      '" role="button" tabindex="0" aria-label="' + label + '"';
  }

  function rack(id, step, x, y, w, h, kicker, name, meta, extra) {
    return '<g ' + attrs(id, step, 'rack ' + (extra || ''), name) + '>' +
      '<rect class="rack-body" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="22"></rect>' +
      '<path class="rack-highlight" d="M' + (x + 22) + ' ' + (y + 1) + 'H' + (x + w - 22) + '"></path>' +
      '<circle class="screw" cx="' + (x + 22) + '" cy="' + (y + 24) + '" r="6"></circle>' +
      '<circle class="screw" cx="' + (x + w - 22) + '" cy="' + (y + 24) + '" r="6"></circle>' +
      '<circle class="screw" cx="' + (x + 22) + '" cy="' + (y + h - 24) + '" r="6"></circle>' +
      '<circle class="screw" cx="' + (x + w - 22) + '" cy="' + (y + h - 24) + '" r="6"></circle>' +
      '<g class="rack-label"><text x="' + (x + 43) + '" y="' + (y + 30) + '">' + kicker + '</text>' +
      '<text class="rack-name" x="' + (x + 43) + '" y="' + (y + 58) + '">' + name + '</text>' +
      '<text class="rack-meta" x="' + (x + w - 42) + '" y="' + (y + 30) + '" text-anchor="end">' + meta + '</text></g></g>';
  }

  function bay(id, step, x, y, w, h, label, meta, extra) {
    return '<g ' + attrs(id, step, 'bay ' + (extra || ''), label) + '>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="15"></rect>' +
      '<text class="bay-label" x="' + (x + 18) + '" y="' + (y + 26) + '">' + label + '</text>' +
      (meta ? '<text class="bay-meta" x="' + (x + w - 18) + '" y="' + (y + 26) + '" text-anchor="end">' + meta + '</text>' : '') +
      '</g>';
  }

  function moduleNode(id, step, x, y, w, h, index, name, meta, extra) {
    var nameClass = name.length > 15 ? 'micro' : name.length > 12 ? 'tiny' : name.length > 8 ? 'small' : '';
    return '<g id="node-' + id + '" ' + attrs(id, step, 'module ' + (extra || ''), name) + '>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="10"></rect>' +
      (index !== '' ? '<text class="module-step" x="' + (x + 16) + '" y="' + (y + 22) + '">' + index + '</text>' : '') +
      '<text class="module-name ' + nameClass + '" x="' + (x + (index !== '' ? 47 : 16)) + '" y="' + (y + 23) + '">' + name + '</text>' +
      '<text class="module-meta" x="' + (x + 16) + '" y="' + (y + h - 14) + '">' + meta + '</text></g>';
  }

  function diskRow(id, step, x, y, w, name, meta, extra) {
    return '<g id="node-' + id + '" ' + attrs(id, step, 'disk-row ' + (extra || ''), name) + '>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="39" rx="7"></rect>' +
      '<circle cx="' + (x + 22) + '" cy="' + (y + 20) + '" r="7"></circle>' +
      '<text class="disk-name" x="' + (x + 43) + '" y="' + (y + 25) + '">' + name + '</text>' +
      '<text class="disk-meta" x="' + (x + w - 18) + '" y="' + (y + 25) + '" text-anchor="end">' + meta + '</text></g>';
  }

  var motionPaths =
    '<g class="motion-paths" aria-hidden="true">' +
      '<path id="motion-1" d="M216 217C216 245 176 260 137 289"></path>' +
      '<path id="motion-2" d="M137 289H303"></path>' +
      '<path id="motion-3" d="M303 289V322H137V369"></path>' +
      '<path id="motion-4" d="M137 369H303"></path>' +
      '<path id="motion-5" d="M303 369V415H137V469"></path>' +
      '<path id="motion-6" d="M137 469H303"></path>' +
      '<path id="motion-7" d="M303 469V520H137V584H303C350 584 390 500 435 460"></path>' +
      '<path id="motion-8" d="M435 460C462 350 465 203 494 203H711"></path>' +
      '<path id="motion-9" d="M711 203H878"></path>' +
      '<path id="motion-10" d="M878 203V316"></path>' +
      '<path id="motion-11" d="M878 316H717"></path>' +
      '<path id="motion-12" d="M717 322V707"></path>' +
      '<path id="motion-13" d="M717 707V494C942 494 968 205 1129 270"></path>' +
      '<path id="motion-14" d="M1129 270C1200 330 1260 420 1418 460"></path>' +
      '<path id="motion-15" d="M1418 460V386"></path>' +
      '<path id="motion-16" d="M1418 386V216"></path>' +
      '<path id="motion-17" d="M1418 216C1530 216 1540 500 1418 681"></path>' +
    '</g>';

  var routes =
    '<g class="flow-lines" aria-hidden="true">' +
      '<path id="flow-0" data-order="0" class="flow-line" d="M216 246V258H137"></path>' +
      '<path id="flow-1" data-order="1" class="flow-line" d="M210 289H230"></path>' +
      '<path id="flow-2" data-order="2" class="flow-line" d="M303 318V327H137V340"></path>' +
      '<path id="flow-3" data-order="3" class="flow-line" d="M210 369H230"></path>' +
      '<path id="flow-4" data-order="4" class="flow-line" d="M303 398V417H137V440"></path>' +
      '<path id="flow-5" data-order="5" class="flow-line" d="M210 469H230"></path>' +
      '<path id="flow-6" data-order="6" class="flow-line" d="M303 498V530H137V555"></path>' +
      '<path id="flow-7a" data-order="7" class="flow-line" d="M210 584H230"></path>' +
      '<path id="flow-7b" data-order="7" class="flow-line network-cable" d="M376 584C423 584 445 203 494 203"></path>' +
      '<path id="flow-8" data-order="8" class="flow-line" d="M623 203H646"></path>' +
      '<path id="flow-9" data-order="9" class="flow-line" d="M776 203H800"></path>' +
      '<path id="flow-10" data-order="10" class="flow-line" d="M878 232V279"></path>' +
      '<path id="flow-11" data-order="11" class="flow-line" d="M800 316H788"></path>' +
      '<path id="flow-12a" data-order="12" class="flow-line" d="M717 343V467"></path>' +
      '<path id="flow-12b" data-order="12" class="flow-line" d="M717 521V598"></path>' +
      '<path id="flow-12c" data-order="12" class="flow-line" d="M717 677V691"></path>' +
      '<path id="flow-13a" data-order="13" class="flow-line replication-line" d="M788 494C942 494 968 205 1053 205"></path>' +
      '<path id="flow-13b" data-order="13" class="flow-line replication-line" d="M788 494C945 494 970 439 1053 439"></path>' +
      '<path id="flow-14a" data-order="14" class="flow-line fetch-request" d="M1299 572C1188 572 1120 232 953 232"></path>' +
      '<path id="flow-14b" data-order="14" class="flow-line" d="M788 494C1012 494 1130 572 1299 572"></path>' +
      '<path id="flow-15" data-order="15" class="flow-line" d="M1418 546V413"></path>' +
      '<path id="flow-16a" data-order="16" class="flow-line" d="M1418 357V329"></path>' +
      '<path id="flow-16b" data-order="16" class="flow-line" d="M1418 271V246"></path>' +
      '<path id="flow-17a" data-order="17" class="flow-line" d="M1487 216C1555 216 1554 678 1536 678"></path>' +
      '<path id="flow-17b" data-order="17" class="flow-line commit-line" d="M1294 678C1122 678 1062 322 623 322"></path>' +
    '</g>';

  var producer =
    rack('producer-host', 0, 20, 72, 400, 670, 'PHYSICAL HOST', 'Producer · order-service', '10.20.4.17', 'producer-rack') +
    '<g class="vent" aria-hidden="true"><path d="M335 131h8m6 0h8m6 0h8M335 138h8m6 0h8m6 0h8"></path></g>' +
    bay('producer-jvm', 1, 54, 148, 332, 350, 'JVM PROCESS · PID 18420', '-Xmx2g', 'process-bay') +
    moduleNode('business', 0, 64, 188, 312, 58, '00', 'Business Code', 'new ProducerRecord(topic, key, value, headers)', 'wide') +
    moduleNode('interceptor', 1, 64, 260, 146, 58, '01', 'Interceptor', 'onSend(record)', '') +
    moduleNode('serializer', 2, 230, 260, 146, 58, '02', 'Serializer', 'K,V → byte[]', '') +
    moduleNode('partitioner', 3, 64, 340, 146, 58, '03', 'Partitioner', 'key hash → P1', '') +
    moduleNode('accumulator', 4, 230, 340, 146, 58, '04', 'RecordAccumulator', 'P1 · ProducerBatch', '') +
    '<g class="thread-divider" aria-hidden="true"><text x="72" y="426">NETWORK THREAD · kafka-producer-network-thread</text><path d="M72 434H368"></path></g>' +
    moduleNode('sender', 5, 64, 440, 146, 58, '05', 'Sender', 'drain + retry', '') +
    moduleNode('network-client', 6, 230, 440, 146, 58, '06', 'NetworkClient', 'Kafka Protocol', '') +
    bay('producer-kernel', 7, 54, 528, 332, 120, 'OS KERNEL · LINUX', '', 'kernel-bay') +
    moduleNode('producer-tcp', 7, 64, 555, 146, 58, '', 'TLS / TCP', 'socket send buffer', 'kernel-module') +
    moduleNode('producer-nic', 7, 230, 555, 146, 58, '', 'NIC · eth0', 'TCP :49152', 'kernel-module') +
    '<g class="physical-footer" aria-hidden="true"><rect x="64" y="674" width="312" height="34" rx="7"></rect><circle cx="82" cy="691" r="4"></circle><circle cx="96" cy="691" r="4"></circle><path d="M122 691h72M306 684v14m10-14v14m10-14v14m10-14v14"></path><text x="212" y="696">2 vCPU · 4 GiB RAM</text></g>';

  var broker =
    rack('broker-host', 8, 450, 42, 560, 730, 'PHYSICAL HOST · RACK 04 / U18', 'Kafka Broker 2', '10.20.8.22:9093', 'broker-rack') +
    '<g class="leader-badge" aria-hidden="true"><rect x="858" y="87" width="100" height="24" rx="12"></rect><text x="908" y="104" text-anchor="middle">P1 LEADER</text></g>' +
    bay('broker-jvm', 8, 484, 126, 492, 278, 'KAFKA JVM · PID 7421', 'Heap 6 / 8 GiB', 'broker-process') +
    moduleNode('broker-nic', 8, 494, 174, 129, 58, '08', 'NIC + Socket', 'receive bytes', 'broker-io') +
    moduleNode('socket-server', 8, 646, 174, 130, 58, '08', 'SocketServer', 'Processor', '') +
    moduleNode('request-channel', 9, 800, 174, 155, 58, '09', 'RequestChannel', 'request queue', '') +
    moduleNode('kafka-apis', 10, 800, 242, 155, 34, '10', 'KafkaApis', 'handle Produce API', '') +
    moduleNode('group-coordinator', 17, 494, 295, 129, 54, '17', 'GroupCoordinator', 'commit offset 43', 'coordinator') +
    moduleNode('unified-log', 11, 646, 295, 142, 54, '11', 'UnifiedLog', 'LocalLog.append()', '') +
    moduleNode('replica-manager', 10, 800, 279, 155, 74, '10', 'ReplicaManager', 'P1 leader · assign 42', '') +
    '<g class="thread-divider broker-thread" aria-hidden="true"><text x="502" y="382">NETWORK THREADS · REQUEST HANDLERS · REPLICA FETCHERS</text><path d="M502 391H956"></path></g>' +
    bay('broker-kernel', 12, 484, 430, 492, 110, 'OS KERNEL · VFS / PAGE CACHE', '', 'broker-kernel') +
    moduleNode('broker-kernel-nic', 8, 494, 467, 129, 54, '', 'Socket Buffers', 'TCP / TLS', 'kernel-module') +
    moduleNode('page-cache', 12, 646, 467, 142, 54, '12', 'Page Cache', 'dirty → writeback', 'kernel-module cache-module') +
    '<g class="cache-stats" aria-hidden="true"><text x="822" y="484">cached 18.2 GiB</text><text x="822" y="503">dirty 12.4 MiB</text><rect x="822" y="511" width="130" height="5" rx="2.5"></rect><rect x="822" y="511" width="102" height="5" rx="2.5"></rect></g>' +
    bay('storage-volume', 12, 484, 560, 492, 180, 'NVME VOLUME · /var/lib/kafka/data', 'xfs · 1.8 TB free', 'storage-bay') +
    diskRow('topic-dir', 12, 500, 598, 458, 'topic · orders.created', '6 partitions', '') +
    diskRow('partition-dir', 12, 500, 645, 458, 'P1 · orders.created-1 · leader replica', 'LEO 43 · HW 43', 'selected') +
    '<g id="node-segment" ' + attrs('segment', 12, 'segment-tray', 'Active Log Segment 及索引文件') + '><rect x="500" y="692" width="458" height="32" rx="6"></rect><rect class="file-led" x="514" y="704" width="7" height="7" rx="2"></rect><text class="segment-name" x="532" y="713">00000000000000000000.log</text><text class="segment-file" x="735" y="713">.index</text><text class="segment-file" x="797" y="713">.timeindex</text><text class="segment-file" x="879" y="713">.txnindex</text></g>';

  function miniFollower(id, brokerNo, y) {
    return '<g ' + attrs(id, 13, 'mini-rack', 'Broker ' + brokerNo + ' Follower Replica') + '>' +
      '<rect class="rack-body" x="1034" y="' + y + '" width="190" height="206" rx="18"></rect>' +
      '<circle class="screw" cx="1052" cy="' + (y + 20) + '" r="5"></circle><circle class="screw" cx="1206" cy="' + (y + 20) + '" r="5"></circle>' +
      '<text class="mini-kicker" x="1068" y="' + (y + 26) + '">PHYSICAL HOST</text>' +
      '<text class="mini-name" x="1058" y="' + (y + 54) + '">Broker ' + brokerNo + '</text>' +
      '<text class="mini-meta" x="1058" y="' + (y + 75) + '">P1 · FOLLOWER</text>' +
      '<rect class="mini-bay" x="1054" y="' + (y + 91) + '" width="150" height="42" rx="8"></rect><text class="mini-module" x="1068" y="' + (y + 116) + '">Page Cache</text>' +
      '<rect class="mini-disk" x="1054" y="' + (y + 142) + '" width="150" height="42" rx="8"></rect><text class="mini-module" x="1068" y="' + (y + 167) + '">Segment · LEO 43</text><circle class="status-led" cx="1188" cy="' + (y + 162) + '" r="5"></circle></g>';
  }

  var followers = miniFollower('follower-1', 1, 108) + miniFollower('follower-3', 3, 342) +
    '<g class="replica-caption" aria-hidden="true"><path d="M1062 586h136"></path><text x="1130" y="608" text-anchor="middle">RF=3 · ISR=[1,2,3]</text></g>';

  var consumer =
    rack('consumer-host', 14, 1260, 72, 320, 670, 'PHYSICAL HOST', 'Consumer · risk-service', '10.20.5.31', 'consumer-rack') +
    bay('consumer-jvm', 14, 1294, 148, 252, 340, 'JVM PROCESS · PID 9921', '', 'consumer-process') +
    moduleNode('handler', 16, 1304, 188, 232, 58, '16', 'Business Handler', 'riskService.evaluate(event)', 'consumer-module') +
    moduleNode('deserializer', 16, 1304, 271, 232, 58, '16', 'Deserializer', 'byte[] → OrderCreated', 'consumer-module') +
    moduleNode('record-parser', 15, 1304, 357, 232, 58, '15', 'Record Parser', 'decompress · CRC · iterate', 'consumer-module') +
    moduleNode('fetcher', 14, 1304, 431, 232, 58, '14', 'Fetcher · P1@42', 'FetchRequest / Response', 'consumer-module') +
    bay('consumer-kernel', 14, 1294, 520, 252, 105, 'OS KERNEL · LINUX', '', 'consumer-kernel') +
    moduleNode('consumer-nic', 14, 1304, 546, 232, 54, '', 'NIC + TLS / TCP', 'broker-2:9093 · fetch bytes', 'kernel-module consumer-nic') +
    '<g id="node-offset-commit" ' + attrs('offset-commit', 17, 'commit-tray', 'Offset Commit') + '><rect x="1294" y="646" width="252" height="70" rx="12"></rect><text class="module-step" x="1312" y="670">17</text><text class="commit-name" x="1344" y="671">OFFSET COMMIT</text><text class="commit-meta" x="1312" y="693">orders.created · P1 · next=43</text><text class="commit-meta" x="1312" y="708">group · order-risk-service</text></g>';

  var token = '<g id="event-token" class="event-token" aria-hidden="true"><circle class="token-halo" r="23"></circle><circle class="token-core" r="16"></circle><path d="M-8-5h16v11H-8zM-8-5 0 1 8-5"></path><text x="0" y="-27" text-anchor="middle">#A1024</text></g>';
  scene.innerHTML = motionPaths + routes + producer + broker + followers + consumer + token;

  /*
   * V2 world model: the first viewport is the deployment, not a giant process
   * flowchart.  The lower half contains three physical cutaways.  Kafka's
   * logical address is deliberately separated from the OS/device address and
   * connected by mapping lines.
   */
  function pAttrs(id, step, label, extra) {
    return 'class="component ' + (extra || '') + '" data-component="' + id + '" data-step="' + step +
      '" role="button" tabindex="0" aria-label="' + label + '"';
  }

  function ventSlots(x, y, count) {
    var result = '';
    for (var i = 0; i < count; i++) result += '<rect class="vent-hole" x="' + (x + i * 12) + '" y="' + y + '" width="7" height="3" rx="1"></rect>';
    return result;
  }

  function producerUnit(id, step, x, y, name, ip, hot) {
    return '<g ' + pAttrs(id, step, name, 'server-unit producer-unit ' + (hot ? 'tracked-machine' : '')) + '>' +
      '<rect class="server-shell" x="' + x + '" y="' + y + '" width="310" height="82" rx="7"></rect>' +
      '<rect class="rack-ear" x="' + (x - 12) + '" y="' + (y + 7) + '" width="12" height="68"></rect>' +
      '<rect class="rack-ear" x="' + (x + 310) + '" y="' + (y + 7) + '" width="12" height="68"></rect>' +
      '<circle class="power-led" cx="' + (x + 24) + '" cy="' + (y + 24) + '" r="5"></circle>' +
      '<text class="hardware-name" x="' + (x + 45) + '" y="' + (y + 27) + '">' + name + '</text>' +
      '<text class="hardware-meta" x="' + (x + 45) + '" y="' + (y + 49) + '">' + ip + ' · JVM</text>' +
      ventSlots(x + 181, y + 21, 8) + ventSlots(x + 181, y + 34, 8) +
      '<rect class="nic-port" x="' + (x + 258) + '" y="' + (y + 53) + '" width="34" height="17"></rect>' +
      (hot ? '<g class="event-seed"><path d="M' + (x + 55) + ' ' + (y + 61) + 'h89"></path><text x="' + (x + 55) + '" y="' + (y + 75) + '">send(record) · #A1024</text></g>' : '') + '</g>';
  }

  function brokerUnit(id, step, x, y, brokerNo, ip, leaders) {
    var slots = '';
    for (var i = 0; i < 6; i++) {
      var sx = x + 30 + (i % 3) * 82;
      var sy = y + 92 + Math.floor(i / 3) * 48;
      var leader = leaders.indexOf(i) !== -1;
      var tracked = brokerNo === 2 && i === 1;
      var cid = tracked ? 'partition-dir' : 'partition-p' + i + '-b' + brokerNo;
      slots += '<g ' + pAttrs(cid, tracked ? 10 : 0, 'Broker ' + brokerNo + ' 上 P' + i + (leader ? ' Leader' : ' Follower'), 'partition-slot ' + (leader ? 'leader-slot ' : '') + (tracked ? 'tracked-partition' : '')) + '>' +
        '<rect x="' + sx + '" y="' + sy + '" width="72" height="36"></rect><text x="' + (sx + 9) + '" y="' + (sy + 16) + '">P' + i + '</text>' +
        '<text class="replica-role" x="' + (sx + 9) + '" y="' + (sy + 29) + '">' + (leader ? 'LEADER' : 'FOLLOWER') + '</text></g>';
    }
    return '<g ' + pAttrs(id, step, 'Kafka Broker ' + brokerNo, 'server-unit broker-unit') + '>' +
      '<rect class="server-shell" x="' + x + '" y="' + y + '" width="290" height="230" rx="8"></rect>' +
      '<rect class="rack-ear" x="' + (x - 13) + '" y="' + (y + 12) + '" width="13" height="206"></rect>' +
      '<rect class="rack-ear" x="' + (x + 290) + '" y="' + (y + 12) + '" width="13" height="206"></rect>' +
      '<circle class="power-led" cx="' + (x + 24) + '" cy="' + (y + 26) + '" r="5"></circle>' +
      '<text class="hardware-name" x="' + (x + 44) + '" y="' + (y + 30) + '">Kafka Broker ' + brokerNo + '</text>' +
      '<text class="hardware-meta" x="' + (x + 30) + '" y="' + (y + 58) + '">' + ip + ':9093 · 2U</text>' +
      '<text class="hardware-kicker" x="' + (x + 30) + '" y="' + (y + 79) + '">ORDERS.CREATED · RF=3</text>' + slots +
      '<g class="drive-bank"><rect x="' + (x + 30) + '" y="' + (y + 194) + '" width="230" height="22"></rect>' +
      '<path d="M' + (x + 42) + ' ' + (y + 205) + 'h120"></path><circle cx="' + (x + 244) + '" cy="' + (y + 205) + '" r="4"></circle>' +
      '<text x="' + (x + 44) + '" y="' + (y + 210) + '">NVMe 3.84 TB · XFS</text></g></g>';
  }

  function consumerUnit(id, step, x, y, name, assignment, hot) {
    return '<g ' + pAttrs(id, step, name + ' assigned ' + assignment, 'consumer-unit ' + (hot ? 'tracked-machine' : '')) + '>' +
      '<rect class="consumer-shell" x="' + x + '" y="' + y + '" width="230" height="72" rx="6"></rect>' +
      '<circle class="power-led" cx="' + (x + 21) + '" cy="' + (y + 22) + '" r="4"></circle>' +
      '<text class="hardware-name" x="' + (x + 38) + '" y="' + (y + 25) + '">' + name + '</text>' +
      '<text class="assignment" x="' + (x + 20) + '" y="' + (y + 51) + '">' + assignment + '</text>' +
      '<rect class="nic-port" x="' + (x + 185) + '" y="' + (y + 43) + '" width="29" height="15"></rect></g>';
  }

  function logicNode(id, step, x, y, w, label, meta, extra) {
    return '<g ' + pAttrs(id, step, label, 'logic-node ' + (extra || '')) + '><path class="logic-bracket" d="M' + x + ' ' + y + 'v42m0-42h' + w + 'm-' + w + ' 42h' + w + '"></path>' +
      '<text class="logic-name" x="' + (x + 14) + '" y="' + (y + 18) + '">' + label + '</text><text class="logic-meta" x="' + (x + 14) + '" y="' + (y + 36) + '">' + meta + '</text></g>';
  }

  function softwareChip(id, step, x, y, w, label, meta, extra) {
    return '<g ' + pAttrs(id, step, label, 'software-chip ' + (extra || '')) + '><rect x="' + x + '" y="' + y + '" width="' + w + '" height="62" rx="4"></rect>' +
      '<text class="chip-title" x="' + (x + 14) + '" y="' + (y + 25) + '">' + label + '</text><text class="chip-meta" x="' + (x + 14) + '" y="' + (y + 47) + '">' + meta + '</text></g>';
  }

  var globalLinks = '<g class="global-links" aria-hidden="true">' +
    '<path class="physical-cable" d="M390 216C465 216 448 332 506 332"></path><path class="physical-cable tracked-wire" id="flow-0" data-order="0" d="M390 311C460 311 456 350 506 350"></path><path class="physical-cable" d="M390 406C462 406 448 368 506 368"></path>' +
    '<path class="physical-cable" d="M714 332C770 332 770 286 822 286"></path><path class="physical-cable tracked-wire" id="flow-7b" data-order="7" d="M714 350C835 350 900 286 1102 286"></path><path class="physical-cable" d="M714 368C810 368 1040 286 1382 286"></path>' +
    '<path class="physical-cable tracked-wire" id="flow-14a" data-order="14" d="M1392 322C1580 322 1680 338 1840 338"></path><path class="physical-cable second-group" d="M1392 338C1640 500 1910 410 2118 410"></path></g>';

  var globalScene = '<g id="scene-deployment" class="scene-zone">' +
    '<text class="scene-eyebrow" x="56" y="62">DEPLOYMENT VIEW · THREE FAILURE DOMAINS</text><text class="scene-title" x="56" y="99">一条 Event 所在的真实 Kafka 集群</text>' +
    '<text class="scene-caption" x="56" y="127">先看全局：3 Producers → ToR Switch → 3 Brokers / 6 Partitions → 2 independent Consumer Groups</text>' + globalLinks +
    '<g class="zone-label"><path d="M56 154h334"></path><text x="56" y="170">PRODUCER FLEET · 3 JVMs</text></g>' +
    producerUnit('producer-peer-1', 0, 68, 184, 'payment-service', '10.20.4.16', false) +
    producerUnit('producer-host', 0, 68, 279, 'order-service', '10.20.4.17', true) +
    producerUnit('producer-peer-3', 0, 68, 374, 'inventory-service', '10.20.4.18', false) +
    '<g ' + pAttrs('tor-switch', 7, 'Top of Rack Network Switch', 'tor-switch') + '><rect class="switch-shell" x="500" y="278" width="220" height="138" rx="6"></rect><text class="hardware-name" x="523" y="306">ToR Switch · rack-04</text><text class="hardware-meta" x="523" y="326">L2 / L3 · 25 GbE</text><g class="switch-ports">' +
      Array.from({ length: 12 }, function (_, i) { return '<rect x="' + (523 + (i % 6) * 29) + '" y="' + (344 + Math.floor(i / 6) * 27) + '" width="21" height="15"></rect>'; }).join('') +
    '</g></g>' +
    '<g class="zone-label"><path d="M812 154h862"></path><text x="812" y="170">KAFKA CLUSTER · 3 BROKERS · 6 PARTITIONS · RF=3</text></g>' +
    brokerUnit('follower-1', 13, 822, 184, 1, '10.20.8.21', [0, 3]) + brokerUnit('broker-host', 8, 1102, 184, 2, '10.20.8.22', [1, 2]) + brokerUnit('follower-3', 13, 1382, 184, 3, '10.20.8.23', [4, 5]) +
    '<g class="cluster-note"><path d="M822 440h850"></path><text x="822" y="464">每个 Partition 只有 1 个 Leader；副本跨 Broker。橙色：#A1024 → P1 Leader@Broker 2</text></g>' +
    '<g class="zone-label"><path d="M1828 154h510"></path><text x="1828" y="170">CONSUMERS · 2 INDEPENDENT GROUPS</text></g>' +
    '<text class="group-title" x="1840" y="200">GROUP A · order-risk-service</text>' +
    consumerUnit('consumer-peer-a1', 14, 1840, 218, 'consumer-a1', 'P0 · P3', false) + consumerUnit('consumer-host', 14, 1840, 302, 'consumer-a2', 'P1 · P4', true) + consumerUnit('consumer-peer-a3', 14, 1840, 386, 'consumer-a3', 'P2 · P5', false) +
    '<text class="group-title" x="2118" y="242">GROUP B · analytics-etl</text>' + consumerUnit('consumer-peer-b1', 14, 2118, 260, 'consumer-b1', 'P0 · P2 · P4', false) + consumerUnit('consumer-peer-b2', 14, 2118, 344, 'consumer-b2', 'P1 · P3 · P5', false) +
    '<g class="partition-legend"><text x="60" y="585">LOGICAL ASSIGNMENT</text><path d="M60 599h2275"></path>' +
      '<text x="60" y="626">orders.created</text><text x="230" y="626">P0</text><text x="310" y="626">P1</text><text x="390" y="626">P2</text><text x="470" y="626">P3</text><text x="550" y="626">P4</text><text x="630" y="626">P5</text>' +
      '<text class="legend-explain" x="780" y="626">Group A: each Partition → exactly one Consumer</text><text class="legend-explain" x="1310" y="626">Group B gets its own full copy of all six Partition streams</text></g>' +
    '<g class="global-event" aria-hidden="true"><path d="M376 322C590 322 880 322 1136 322"></path><text x="742" y="310">TRACKED EVENT #A1024 · key=user-9527 · P1</text></g></g>';

  var producerCutaway = '<g id="scene-producer-cutaway" class="scene-zone cutaway-zone">' +
    '<text class="scene-eyebrow" x="55" y="840">CUTAWAY 01 · PRODUCER HOST 10.20.4.17</text><text class="scene-title" x="55" y="877">order-service：对象如何变成网络字节</text>' +
    '<g ' + pAttrs('producer-jvm', 1, 'Producer JVM process', 'cutaway-chassis') + '><path class="chassis-outline" d="M50 900h590v585H50z"></path><path class="chassis-top" d="M50 900h590v54H50z"></path><text class="chassis-name" x="76" y="934">1U SERVER CUTAWAY · JVM PID 18420</text></g>' +
    '<rect class="motherboard" x="78" y="970" width="534" height="475" rx="7"></rect><path class="pcb-trace" d="M115 1300H570M185 1022v294M360 1022v294M520 1022v294"></path>' +
    softwareChip('business', 0, 104, 998, 210, 'Business Code', 'new Event + ProducerRecord', 'hot-chip') + softwareChip('interceptor', 1, 338, 998, 236, 'Interceptor.onSend', 'headers / tracing', '') +
    softwareChip('serializer', 2, 104, 1082, 210, 'Serializer', 'K / V → byte[]', '') + softwareChip('partitioner', 3, 338, 1082, 236, 'Partitioner', 'murmur2(key) → P1 / 6', '') +
    softwareChip('accumulator', 4, 104, 1166, 470, 'RecordAccumulator · P1 deque', 'ProducerBatch · zstd · batch.size=16 KiB', 'memory-chip') +
    softwareChip('sender', 5, 104, 1250, 210, 'Sender Thread', 'drain + retry + in-flight', '') + softwareChip('network-client', 6, 338, 1250, 236, 'NetworkClient', 'ProduceRequest · correlation=1842', '') +
    '<g class="physical-layer-label"><text x="104" y="1352">PHYSICAL EXECUTION</text><path d="M104 1362h470"></path></g>' +
    '<g class="cpu-package"><rect x="108" y="1380" width="115" height="48"></rect><rect x="121" y="1390" width="89" height="27"></rect><text x="165" y="1408" text-anchor="middle">CPU CORE</text></g>' +
    '<g class="dimm"><rect x="248" y="1380" width="174" height="48"></rect><path d="M270 1389v28m28-28v28m28-28v28m28-28v28m28-28v28"></path><text x="335" y="1408" text-anchor="middle">RAM · HEAP / BUFFER</text></g>' +
    '<g ' + pAttrs('producer-kernel', 7, 'Producer Linux Kernel', 'kernel-callout') + '><path d="M436 1378h142v52H436z"></path><text x="451" y="1399">LINUX KERNEL</text><text x="451" y="1417">socket send buffer</text></g>' +
    '<g ' + pAttrs('producer-nic', 7, 'Producer NIC eth0', 'nic-card') + '><path d="M548 1368h50v70h-50v-10h-18v-46h18z"></path><rect x="560" y="1384" width="25" height="20"></rect><text x="573" y="1421" text-anchor="middle">NIC</text></g>' +
    '<g ' + pAttrs('producer-tcp', 7, 'TLS and TCP socket', 'mapping-callout') + '><path d="M470 1335v35"></path><text x="432" y="1326">TLS → TCP</text></g>' +
    '<path id="flow-1" data-order="1" class="flow-line cutaway-flow" d="M314 1029H338"></path><path id="flow-2" data-order="2" class="flow-line cutaway-flow" d="M456 1060v22H209"></path><path id="flow-3" data-order="3" class="flow-line cutaway-flow" d="M314 1113h24"></path><path id="flow-4" data-order="4" class="flow-line cutaway-flow" d="M456 1144v22H339"></path><path id="flow-5" data-order="5" class="flow-line cutaway-flow" d="M339 1197H314v84"></path><path id="flow-6" data-order="6" class="flow-line cutaway-flow" d="M314 1281h24"></path><path id="flow-7a" data-order="7" class="flow-line cutaway-flow" d="M456 1312v42h100v18"></path>' +
    '<path class="hardware-map" d="M209 1060v300m247-216v216m-16-48v48"></path></g>';

  var brokerCutaway = '<g id="scene-broker-cutaway" class="scene-zone cutaway-zone">' +
    '<text class="scene-eyebrow" x="710" y="780">CUTAWAY 02 · BROKER 2 · P1 LEADER REPLICA</text><text class="scene-title" x="710" y="817">Kafka 逻辑地址，如何落到 RAM 与 NVMe</text>' +
    '<g ' + pAttrs('broker-jvm', 8, 'Kafka Broker JVM', 'cutaway-chassis') + '><path class="chassis-outline" d="M700 840h1040v690H700z"></path><path class="chassis-top" d="M700 840h1040v54H700z"></path><text class="chassis-name" x="728" y="874">2U SERVER CUTAWAY · 2×CPU · 128 GiB RAM · U.2 NVMe</text></g>' +
    '<rect class="motherboard broker-board" x="728" y="916" width="984" height="590" rx="7"></rect>' +
    '<g class="broker-physical-rail"><text x="750" y="944">NIC / PCIe</text><text x="946" y="944">CPU · KAFKA JVM</text><text x="1454" y="944">RAM DIMMs</text></g>' +
    '<g ' + pAttrs('broker-nic', 8, 'Broker NIC and socket buffer', 'nic-card broker-nic-card') + '><path d="M750 966h138v91H750v-12h-25v-61h25z"></path><rect x="774" y="988" width="42" height="28"></rect><rect x="826" y="988" width="42" height="28"></rect><text x="819" y="1042" text-anchor="middle">NIC · 25 GbE</text></g>' +
    softwareChip('socket-server', 8, 930, 966, 190, 'SocketServer', 'Processor threads', '') + softwareChip('request-channel', 9, 1140, 966, 190, 'RequestChannel', 'bounded request queue', '') +
    softwareChip('kafka-apis', 10, 930, 1048, 190, 'KafkaApis', 'Produce API handler', '') + softwareChip('replica-manager', 10, 1140, 1048, 190, 'ReplicaManager', 'P1 Leader · LEO 42→43', 'hot-chip') +
    softwareChip('unified-log', 11, 1350, 1048, 190, 'UnifiedLog', 'appendAsLeader()', '') +
    '<g class="dimm-bank"><rect x="1450" y="966" width="230" height="62"></rect><path d="M1470 978v36m30-36v36m30-36v36m30-36v36m30-36v36m30-36v36m30-36v36"></path><text x="1565" y="1002" text-anchor="middle">RAM · 128 GiB</text></g>' +
    '<path id="flow-8" data-order="8" class="flow-line cutaway-flow" d="M888 1010h42"></path><path id="flow-9" data-order="9" class="flow-line cutaway-flow" d="M1120 997h20"></path><path id="flow-10" data-order="10" class="flow-line cutaway-flow" d="M1235 1028v20"></path><path id="flow-11" data-order="11" class="flow-line cutaway-flow" d="M1330 1080h20"></path>' +
    '<g class="address-separator"><text x="750" y="1153">LOGICAL KAFKA ADDRESS</text><path d="M750 1164h930"></path></g>' +
    logicNode('topic-dir', 12, 750, 1180, 170, 'Topic', 'orders.created', '') + logicNode('partition-dir', 12, 940, 1180, 190, 'Partition Replica', 'P1 · Leader@B2', 'hot-logic') + logicNode('segment', 12, 1150, 1180, 255, 'Active Segment', '000...000.log · offset 42', '') + logicNode('record-batch', 12, 1425, 1180, 255, 'RecordBatch', 'file position 8192 · 146 B', '') +
    '<path class="logical-rail" d="M920 1202h20m190 0h20m255 0h20"></path>' +
    '<g class="address-separator physical-address-label"><text x="750" y="1261">PHYSICAL MEMORY / FILESYSTEM / DEVICE ADDRESS</text><path d="M750 1272h930"></path></g>' +
    '<g ' + pAttrs('page-cache', 12, 'Linux Page Cache pages', 'page-cache-physical') + '><text x="750" y="1305">RAM PAGE CACHE</text><g class="memory-pages"><rect x="750" y="1320" width="48" height="54"></rect><rect x="802" y="1320" width="48" height="54"></rect><rect class="dirty-page" x="854" y="1320" width="48" height="54"></rect><rect x="906" y="1320" width="48" height="54"></rect></g><text x="750" y="1393">page index 2 · dirty · 4 KiB</text></g>' +
    '<g ' + pAttrs('broker-kernel', 12, 'Linux VFS and XFS', 'filesystem-physical') + '><text x="1010" y="1305">VFS → XFS</text><path d="M1010 1320h228v75H1010z"></path><text x="1026" y="1346">inode 812944</text><text x="1026" y="1367">extent: file 8192 → LBA 884736</text><text x="1026" y="1385">writeback later / fsync on flush</text></g>' +
    '<g ' + pAttrs('storage-volume', 12, 'NVMe physical device', 'nvme-device') + '><path d="M1288 1308h380v132h-380v-14h-24v-100h24z"></path><circle cx="1312" cy="1331" r="8"></circle><rect class="nvme-controller" x="1340" y="1326" width="74" height="82"></rect><text x="1377" y="1354" text-anchor="middle">NVMe</text><text x="1377" y="1371" text-anchor="middle">CTRL</text><g class="nand-bank"><rect x="1432" y="1326" width="67" height="35"></rect><rect x="1508" y="1326" width="67" height="35"></rect><rect class="hot-nand" x="1432" y="1373" width="67" height="35"></rect><rect x="1508" y="1373" width="67" height="35"></rect></g><text x="1608" y="1347">SQ 7</text><text x="1608" y="1366">LBA</text><text x="1608" y="1385">884736</text></g>' +
    '<g class="mapping-lines" aria-hidden="true"><path d="M1548 1224v51C1548 1294 1458 1298 1458 1320"></path><path d="M1278 1224v55C1278 1300 1128 1300 1128 1320"></path><path d="M1030 1224v53C1030 1300 878 1300 878 1320"></path><text x="1460" y="1288">bytes → page</text><text x="1178" y="1289">file → inode</text><text x="899" y="1289">offset → page index</text></g>' +
    '<path id="flow-12a" data-order="12" class="flow-line cutaway-flow" d="M1445 1110v70"></path><path id="flow-12b" data-order="12" class="flow-line cutaway-flow" d="M1548 1224v78"></path><path id="flow-12c" data-order="12" class="flow-line cutaway-flow" d="M954 1347h56m228 0h50"></path>' +
    '<g ' + pAttrs('group-coordinator', 17, 'Group Coordinator', 'coordinator-chip') + '><rect x="750" y="1436" width="220" height="48"></rect><text x="766" y="1457">GROUP COORDINATOR</text><text x="766" y="1475">__consumer_offsets · P1=43</text></g></g>';

  var consumerCutaway = '<g id="scene-consumer-cutaway" class="scene-zone cutaway-zone">' +
    '<text class="scene-eyebrow" x="1805" y="840">CUTAWAY 03 · CONSUMER A2 · GROUP A</text><text class="scene-title" x="1805" y="877">P1 只分配给组内一个 Consumer</text>' +
    '<g ' + pAttrs('consumer-jvm', 14, 'Consumer JVM', 'cutaway-chassis') + '><path class="chassis-outline" d="M1800 900h540v585H1800z"></path><path class="chassis-top" d="M1800 900h540v54H1800z"></path><text class="chassis-name" x="1826" y="934">1U SERVER CUTAWAY · risk-service</text></g>' +
    '<rect class="motherboard" x="1828" y="970" width="484" height="475" rx="7"></rect>' +
    '<g ' + pAttrs('consumer-nic', 14, 'Consumer NIC and TCP', 'nic-card consumer-nic-card') + '><path d="M1855 1000h105v75h-105v-10h-20v-50h20z"></path><rect x="1877" y="1018" width="39" height="27"></rect><text x="1907" y="1061" text-anchor="middle">NIC · TCP</text></g>' +
    softwareChip('fetcher', 14, 1990, 995, 284, 'Fetcher · assigned P1 / P4', 'FetchRequest P1@42 · pull model', 'hot-chip') + softwareChip('record-parser', 15, 1855, 1100, 419, 'RecordBatch Parser', 'decompress → CRC → iterate records', '') +
    softwareChip('deserializer', 16, 1855, 1190, 200, 'Deserializer', 'byte[] → OrderCreated', '') + softwareChip('handler', 16, 2074, 1190, 200, 'Business Handler', 'riskService.evaluate()', '') +
    '<g id="node-offset-commit" ' + pAttrs('offset-commit', 17, 'Commit next offset 43', 'commit-physical') + '><path d="M1855 1290h419v82H1855z"></path><text x="1875" y="1321">COMMIT BOUNDARY</text><text x="1875" y="1347">group=order-risk-service · P1 → next offset 43</text></g>' +
    '<g class="consumer-assignment"><text x="1855" y="1408">GROUP A ASSIGNMENT</text><path d="M1855 1420h419"></path><text x="1855" y="1441">A1: P0,P3</text><text x="1995" y="1441">A2: P1,P4</text><text x="2135" y="1441">A3: P2,P5</text></g>' +
    '<path id="flow-14b" data-order="14" class="flow-line cutaway-flow" d="M1960 1036h30"></path><path id="flow-15" data-order="15" class="flow-line cutaway-flow" d="M2132 1057v43"></path><path id="flow-16a" data-order="16" class="flow-line cutaway-flow" d="M2065 1162v28"></path><path id="flow-16b" data-order="16" class="flow-line cutaway-flow" d="M2055 1221h19"></path><path id="flow-17a" data-order="17" class="flow-line cutaway-flow" d="M2174 1252v38"></path><path id="flow-17b" data-order="17" class="flow-line commit-line" d="M1855 1330C1720 1330 1740 1460 970 1460"></path></g>';

  var v2Token = '<g id="event-token" class="event-token" aria-hidden="true"><circle class="token-halo" r="23"></circle><circle class="token-core" r="16"></circle><path d="M-8-5h16v11H-8zM-8-5 0 1 8-5"></path><text x="0" y="-27" text-anchor="middle">#A1024</text></g>';
  scene.innerHTML = globalScene + producerCutaway + brokerCutaway + consumerCutaway + v2Token;

  var kafkaCommit = '80a74f3b84525563ef060b6e0e1b70bc127ec064';
  function source(path, start, end) {
    return 'https://github.com/apache/kafka/blob/' + kafkaCommit + '/' + path + '#L' + start + '-L' + (end || start);
  }
  function d(step, kicker, title, summary, location, input, output, configs, gain, cost, code, url) {
    return { step: step, kicker: kicker, title: title, summary: summary, location: location, input: input, output: output, configs: configs, gain: gain, cost: cost, code: code, source: url };
  }
  function hostDetail(step, title, role, ip, process) {
    return d(step, 'PHYSICAL HOST', title, role + '。外层边界表示一台真实或虚拟 Linux 主机；内部的 JVM、内核缓存、网卡和磁盘属于不同资源域。',
      [title, 'Linux host', ip], 'network / memory / disk resources', process,
      [['cpu / memory', 'independent quota', 'CPU 抢占和内存压力会同时影响客户端线程与网络延迟。'], ['failure domain', 'one host', '主机宕机时其中的所有进程、Page Cache 与本地文件一起消失。']],
      '把进程与硬件资源边界画清，便于理解一次调用为什么会跨越多次复制和调度。', '容器或虚拟机可能隐藏真实 NUMA、磁盘和网卡拓扑，图中是教学抽象。', 'host → process → kernel → device', null);
  }
  function processDetail(step, title, location, role) {
    return d(step, 'JVM PROCESS', title, role, location, 'Java objects / protocol bytes', 'heap objects + native buffers',
      [['-Xmx', 'process heap', 'Kafka Client 的部分对象在堆中，但网络 ByteBuffer 和 Page Cache 不等于 JVM Heap。'], ['threads', 'role separated', '业务、网络和 Handler 线程分工决定阻塞传播方式。']],
      '进程隔离了对象和线程，组件之间通过队列、Buffer 或 Socket 交接。', '只看 JVM Heap 会漏掉直接内存、内核 Socket Buffer 与文件 Page Cache。', 'JVM process boundary', null);
  }
  function kernelDetail(step, title, location) {
    return d(step, 'OS KERNEL', title, '应用代码不能直接驱动网卡或磁盘；系统调用把数据交给内核，内核再负责 Socket Buffer、Page Cache 和设备调度。',
      location, 'userspace bytes', 'kernel buffers / device I/O',
      [['socket buffers', 'kernel managed', '吸收短暂突发，但积压也会增加端到端延迟。'], ['page cache', 'host memory', '文件写入和读取优先经过页缓存，不属于 JVM Heap。']],
      '内核统一提供缓存、调度、预读和回写，让 Kafka 保持简单的顺序文件模型。', '性能依赖整台主机状态，邻居噪声和内存回收会改变尾延迟。', 'write(2) / read(2) / send(2)', null);
  }

  var details = {
    'producer-host': hostDetail(0, 'Producer Host', '运行 order-service，并承担序列化、批处理与网络发送', '10.20.4.17', 'order-service JVM'),
    'producer-jvm': processDetail(1, 'Producer JVM', ['Producer Host', 'JVM', 'PID 18420'], 'Producer API 与后台网络线程生活在同一个 JVM，但属于不同线程边界。'),
    'producer-kernel': kernelDetail(7, 'Producer Linux Kernel', ['Producer Host', 'Linux kernel']),
    'broker-host': hostDetail(8, 'Kafka Broker 2', '承载 orders.created-P1 Leader、Page Cache 与本地 Segment', '10.20.8.22', 'Kafka JVM'),
    'broker-jvm': processDetail(8, 'Kafka Broker JVM', ['Broker 2', 'Kafka JVM', 'PID 7421'], '网络线程把请求交给 Handler；ReplicaManager 与日志层再完成追加。'),
    'broker-kernel': kernelDetail(12, 'Broker Linux Kernel', ['Broker 2', 'Linux kernel', 'VFS / Page Cache']),
    'consumer-host': hostDetail(14, 'Consumer Host', '运行 risk-service，主动 Fetch、反序列化并处理 Event', '10.20.5.31', 'risk-service JVM'),
    'consumer-jvm': processDetail(14, 'Consumer JVM', ['Consumer Host', 'JVM', 'PID 9921'], 'ConsumerNetworkClient、Fetcher 与业务 poll 线程在此协作。'),
    'consumer-kernel': kernelDetail(14, 'Consumer Linux Kernel', ['Consumer Host', 'Linux kernel']),

    'business': d(0, 'APPLICATION · JVM HEAP', 'Business Code',
      '业务代码创建 OrderCreated，并把 topic、key、value、headers 封装成 ProducerRecord。此时没有 Partition，也没有 Offset。',
      ['Producer Host', 'JVM', 'application thread', 'heap'], 'OrderCreated object', 'ProducerRecord<String, OrderCreated>',
      [['partition', 'null', '让 Producer 稍后根据 Key 和集群元数据选分区。'], ['headers', 'traceparent · tenant-id', '跨服务传递追踪和租户上下文，但每条消息都会增加字节。']],
      '业务意图与 Kafka 传输细节通过统一信封解耦。', '字段自由意味着团队必须自己约束 Key、Header 与 Schema。',
      '// Key 决定 Partition，也决定同一用户的局部顺序\nString key = "user-9527";\n\n// Header 传递追踪/租户信息；value 仍是 JVM 对象\nProducerRecord<String, OrderCreated> record =\n    new ProducerRecord<>("orders.created", null, key, event, headers);\n\n// 异步：返回 Future 不等于 Broker 已确认\nproducer.send(record, callback);',
      source('clients/src/main/java/org/apache/kafka/clients/producer/ProducerRecord.java', 49, 156)),

    'interceptor': d(1, 'PRODUCER · APPLICATION THREAD', 'Producer Interceptor',
      'send(record) 首先经过 onSend。它可以补充 Header、埋点或修改记录；send 返回 Future 并不代表 Broker 已经写入。',
      ['Producer Host', 'JVM', 'application thread', 'KafkaProducer.send'], 'ProducerRecord', 'intercepted ProducerRecord',
      [['interceptor.classes', 'TraceInterceptor', '慢逻辑会直接阻塞业务线程。'], ['max.block.ms', '60000', '元数据或 BufferPool 不可用时，调用线程最多等待多久。']],
      '统一处理追踪、审计和客户端指标。', '第三方 Interceptor 异常或耗时会污染所有发送调用。',
      'ProducerRecord<K, V> interceptedRecord =\n    interceptors.onSend(record);\nreturn doSend(interceptedRecord, callback);',
      source('clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java', 1141, 1235)),

    'serializer': d(2, 'PRODUCER · APPLICATION THREAD', 'Serializer',
      'Producer 分别序列化 Key 和 Value。Java 对象不会被发上网，真正跨进程传播的是 byte[]；Header value 从 API 层开始就是 byte[]。',
      ['Producer Host', 'JVM', 'application thread', 'Serializer'], 'String + OrderCreated', 'keyBytes + valueBytes + headers',
      [['key.serializer', 'StringSerializer', '它产生的真实字节会参与分区哈希。'], ['value.serializer', 'JSON / Avro / Protobuf', '决定体积、CPU、Schema 演进和跨语言兼容。'], ['request.max.bytes', '1 MiB', '需要与 Broker、Topic、Consumer 上限协调。']],
      '语言对象被转换成稳定的跨进程协议。', 'Schema 不兼容会在 Consumer 端形成毒消息。',
      'byte[] serializedKey = keySerializer.serialize(...);\nbyte[] serializedValue = valueSerializer.serialize(...);',
      source('clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java', 1188, 1229)),

    'partitioner': d(3, 'PRODUCER · APPLICATION THREAD', 'Partitioner',
      'partition 未显式指定时，内置策略对序列化后的 keyBytes 做 Murmur2，再对分区数取模；#A1024 被路由到 P1。',
      ['Producer Host', 'JVM', 'application thread', 'BuiltInPartitioner'], 'keyBytes + partitions [P0,P1,P2]', 'TopicPartition orders.created-1',
      [['partition', 'null', '显式指定最确定，但会耦合当前分区布局。'], ['partitioner.ignore.keys', 'false', '保留 Key 亲和与 Partition 内局部顺序。']],
      '相同 Key 稳定进入同一 Partition，可获得局部顺序。', '热门 Key 会形成热点；增加分区后取模结果会改变。',
      'return Utils.toPositive(Utils.murmur2(serializedKey))\n    % numPartitions;',
      source('clients/src/main/java/org/apache/kafka/clients/producer/internals/BuiltInPartitioner.java', 404, 416)),

    'accumulator': d(4, 'PRODUCER · JVM BUFFER', 'RecordAccumulator',
      '客户端按 TopicPartition 维护 deque。Event 被编码进 P1 当前 ProducerBatch，并与邻近记录共享内存、压缩和一次请求。',
      ['Producer Host', 'JVM', 'RecordAccumulator', 'P1 deque'], 'serialized record · P1', 'ProducerBatch · zstd',
      [['batch.size', '16384', '更大 Batch 提升吞吐和压缩率，但低流量分区更难填满。'], ['linger.ms', '5 ms', '主动等待更多记录，用少量延迟换批量效率。'], ['buffer.memory', '32 MiB', '共享内存耗尽时业务线程会等待 BufferPool。'], ['compression.type', 'zstd', '节省网络与磁盘，增加两端 CPU。']],
      '多条记录共享系统调用、协议头和压缩上下文。', '引入排队延迟、直接内存压力与突发 Flush。',
      'Deque<ProducerBatch> deque = getOrCreateDeque(tp);\ntryAppend(timestamp, key, value, headers, callback, deque);',
      source('clients/src/main/java/org/apache/kafka/clients/producer/internals/RecordAccumulator.java', 285, 390)),

    'sender': d(5, 'PRODUCER · NETWORK THREAD', 'Sender',
      '后台 Sender 找到 ready 的 Broker，按节点 Drain Batch，构造 ProduceRequest，并管理 InFlight、超时和重试。',
      ['Producer Host', 'JVM', 'kafka-producer-network-thread', 'Sender'], 'ready ProducerBatch', 'ProduceRequest · correlationId 1842',
      [['max.in.flight.requests.per.connection', '5', '覆盖 RTT、提高利用率；重试顺序更复杂。'], ['retries', 'MAX', '由 delivery.timeout.ms 控制最终边界。'], ['enable.idempotence', 'true', '使用序列号消除协议重试导致的重复追加。']],
      '业务线程与 Socket I/O 解耦，吞吐不再被单次 RTT 限制。', '错误异步返回，排查需要同时理解队列、InFlight 与 Callback。',
      'Map<Integer, List<ProducerBatch>> batches =\n    accumulator.drain(metadata, readyNodes, maxRequestSize, now);',
      source('clients/src/main/java/org/apache/kafka/clients/producer/internals/Sender.java', 380, 455)),

    'network-client': d(6, 'PRODUCER · NETWORK THREAD', 'NetworkClient',
      'ProduceRequest 被编码为 Kafka Protocol Frame：长度前缀、API Key、版本、correlationId、clientId 和 RecordBatch Body。',
      ['Producer Host', 'JVM', 'network thread', 'NetworkClient'], 'ProduceRequest object', 'Kafka Protocol bytes',
      [['request.timeout.ms', '30000', '控制单次请求等待，不等于整体 delivery timeout。'], ['client.id', 'order-service', '进入请求头和指标维度，便于 Broker 侧定位来源。']],
      '版本化协议允许客户端和 Broker 滚动演进。', '同一能力存在多版 wire schema，升级与抓包分析更复杂。',
      'Send send = request.toSend(header);\nselector.send(new NetworkSend(destination, send));',
      source('clients/src/main/java/org/apache/kafka/clients/NetworkClient.java', 616, 682)),

    'producer-tcp': d(7, 'PRODUCER · OS KERNEL', 'TLS / TCP Socket',
      'Kafka Frame 通过系统调用进入内核 Socket Send Buffer；启用 SASL_SSL 时，应用数据先被 TLS 封装为加密记录。',
      ['Producer Host', 'Linux kernel', 'TCP socket', 'send buffer'], 'Kafka Protocol bytes', 'encrypted TCP byte stream',
      [['security.protocol', 'SASL_SSL', '同时提供认证与加密。'], ['socket.send.buffer.bytes', '128 KiB', '影响突发写入，最终仍受内核 autotuning 影响。']],
      '长期 TCP 连接提供可靠有序的字节流与连接复用。', 'TLS 加解密和额外复制消耗 CPU；超时不能证明 Broker 未写入。',
      'process → write() → socket buffer → TCP/IP', null),

    'producer-nic': d(7, 'PRODUCER · PHYSICAL DEVICE', 'NIC · eth0',
      '网卡把 TCP Segment 送到网络。它只认识帧和包，不理解 Event、Partition 或 Offset。',
      ['Producer Host', 'PCIe / virtual NIC', 'eth0'], 'TCP segments', 'Ethernet frames on wire',
      [['link speed', '10 Gbps', '上限还受虚拟化、队列和中断分配影响。'], ['MTU', '1500 / 9000', '更大 MTU 减少包数，但需要全路径一致。']],
      '硬件卸载和多队列可以提升吞吐。', '丢包、重传与队列拥塞会被上层感知为延迟抖动。', 'NIC TX queue → wire', null),

    'broker-nic': d(8, 'BROKER · NETWORK EDGE', 'Broker NIC + Socket',
      'Broker 2 收到 TCP 字节。Acceptor/Processor 管理连接并读取完整 Kafka 请求，再交给 RequestChannel。',
      ['Broker 2', 'NIC', 'kernel socket', 'Kafka JVM'], 'TCP byte stream', 'NetworkReceive / Request',
      [['num.network.threads', '3', '过少会在网络解析处排队。'], ['socket.receive.buffer.bytes', '100 KiB', '影响高带宽高 RTT 连接的接收窗口。']],
      '少量网络线程复用大量连接。', '某个 Processor 饱和会让它管理的连接共同出现长尾。',
      'SocketChannel.read() → NetworkReceive', source('core/src/main/scala/kafka/network/SocketServer.scala', 719, 820)),

    'broker-kernel-nic': kernelDetail(8, 'Broker Socket Buffers', ['Broker 2', 'Linux kernel', 'TCP receive/send buffers']),
    'socket-server': d(8, 'BROKER · NETWORK THREAD', 'SocketServer / Processor',
      'Processor 只做连接、协议帧收发与队列交接，不在网络线程里执行完整 Produce 逻辑。',
      ['Broker 2', 'Kafka JVM', 'network thread', 'Processor'], 'NetworkReceive', 'RequestChannel.Request',
      [['num.network.threads', '3', '与连接数和请求速率一起调节。'], ['queued.max.requests', '500', '队列可吸收突发，也会隐藏下游拥塞。']],
      '慢磁盘或 API 不会直接阻塞同一 Processor 的所有 Socket。', '网络层与业务层分离后，延迟会积累在队列里，更需要分段指标。',
      'requestChannel.sendRequest(request)\nselector.poll(timeout)', source('core/src/main/scala/kafka/network/SocketServer.scala', 719, 820)),

    'request-channel': d(9, 'BROKER · HANDOFF QUEUE', 'RequestChannel',
      '网络线程把 Produce 请求放入队列，Kafka Request Handler 再取出并调用 KafkaApis。它是网络 I/O 与业务处理的隔离带。',
      ['Broker 2', 'Kafka JVM', 'RequestChannel', 'request queue'], 'RequestChannel.Request', 'KafkaApis.handleProduceRequest',
      [['num.io.threads', '8', '决定 Handler 并行度；太高会把竞争推向锁和磁盘。'], ['queued.max.requests', '500', '越大越能吸收突发，也越容易形成排队长尾。']],
      '职责解耦并吸收短时突发。', '队列增长时，吞吐可能暂时正常而端到端延迟已经恶化。',
      'val req = requestChannel.receiveRequest()\nkafkaApis.handle(request, requestLocal)', source('core/src/main/scala/kafka/server/KafkaRequestHandler.scala', 90, 165)),

    'kafka-apis': d(10, 'BROKER · REQUEST HANDLER', 'KafkaApis',
      'KafkaApis 按 API Key 把请求分派到 Produce 处理路径，并执行授权、配额、Topic/Partition 合法性与错误映射。',
      ['Broker 2', 'Kafka JVM', 'request handler thread', 'KafkaApis'], 'RequestChannel.Request · Produce', 'ReplicaManager.appendRecords',
      [['request quota', 'client / user', '超过配额时 Broker 会节流，而不是无限吞吐。'], ['authorization', 'WRITE on topic', '未授权请求在日志追加前失败。']],
      '协议分派、授权和错误处理集中在一个明确入口。', '请求处理路径较长，必须用分段指标区分排队、授权与日志追加耗时。',
      'case ApiKeys.PRODUCE =>\n  handleProduceRequest(request, requestLocal)\n// then replicaManager.appendRecords(...)', source('core/src/main/scala/kafka/server/KafkaApis.scala', 720, 840)),

    'replica-manager': d(10, 'BROKER · PARTITION LEADER', 'ReplicaManager · P1 Leader',
      'Leader 校验写入条件，为 Batch 分配 base offset 42，并维护 LEO、HW 与 ISR。P1 的所有写入顺序在这里串成一条日志。',
      ['Broker 2', 'Kafka JVM', 'ReplicaManager', 'orders.created-1 leader'], 'ProduceRequest · P1 batch', 'MemoryRecords · baseOffset 42',
      [['acks', 'all', '等待 ISR 条件满足后再确认。'], ['min.insync.replicas', '2', '同步副本少于 2 时拒绝关键写入。'], ['message.max.bytes', '1 MiB', '必须与 Producer 和 Consumer 上限一致。']],
      '单 Leader 分配 Offset，让 Partition 内顺序和冲突处理保持简单。', '单 Partition 吞吐受单日志顺序约束；故障时需要选举。',
      'appendRecords(\n  timeout = request.timeout,\n  requiredAcks = request.acks,\n  internalTopicsAllowed = false,\n  entriesPerPartition = authorizedRequestInfo)', source('core/src/main/scala/kafka/server/ReplicaManager.scala', 646, 760)),

    'unified-log': d(11, 'BROKER · LOG ABSTRACTION', 'UnifiedLog / LocalLog',
      'UnifiedLog 把逻辑 Offset、事务索引、Leader Epoch 与底层 Segment 文件组织起来，再调用 LocalLog 追加记录。',
      ['Broker 2', 'Kafka JVM', 'UnifiedLog', 'LocalLog'], 'MemoryRecords · baseOffset 42', 'FileRecords append',
      [['log.segment.bytes', '1 GiB', '决定滚动 Segment 的大小。'], ['log.index.interval.bytes', '4096', '控制稀疏 Offset 索引密度。']],
      '上层按逻辑 Offset 操作，下层保持简单的顺序文件追加。', '日志滚动、Retention、索引和恢复需要共同维护一致性。',
      'localLog.append(appendInfo.lastOffset, validRecords)\nupdateHighWatermarkWithLogEndOffset()', source('storage/src/main/java/org/apache/kafka/storage/internals/log/UnifiedLog.java', 1200, 1310)),

    'page-cache': d(12, 'BROKER · HOST MEMORY', 'OS Page Cache',
      'FileChannel 写入首先让对应文件页进入 Page Cache 并标记 dirty；内核稍后 writeback 到 NVMe。Consumer Fetch 也优先从这些缓存页读取。',
      ['Broker 2', 'Linux kernel', 'Page Cache', 'orders.created-1 pages'], 'FileChannel append bytes', 'cached file pages · dirty',
      [['log.flush.interval.messages', 'unset', 'Kafka 通常依赖副本而不是每条消息强制 fsync。'], ['vm.dirty_*', 'kernel policy', '决定脏页何时批量回写。'], ['host memory', 'page cache budget', 'JVM Heap 过大可能挤压最有价值的文件缓存。']],
      '写入与读取共享同一份文件页，顺序 I/O 和预读效率很高。', 'ACK 通常不等于每条记录已物理落盘；性能受整机内存压力影响。',
      'FileChannel.write(records)\n// kernel: page cache page becomes dirty', null),

    'storage-volume': d(12, 'BROKER · BLOCK DEVICE', 'NVMe Volume',
      'Page Cache 的脏页最终被文件系统与块层写入 NVMe。磁盘保存的是 TopicPartition 的 Segment 与索引文件，不是 Java 对象。',
      ['Broker 2', 'NVMe', 'XFS', '/var/lib/kafka/data'], 'dirty pages', 'persistent blocks',
      [['log.dirs', '/var/lib/kafka/data', '可配置多个数据目录；每个 Replica 只位于其中一个目录。'], ['filesystem', 'XFS / ext4', '挂载参数、队列深度和磁盘隔离会改变延迟。']],
      '顺序追加充分利用块设备吞吐，恢复时文件仍然存在。', '磁盘容量、磨损、I/O 抖动和故障恢复流量需要持续治理。',
      '/var/lib/kafka/data/orders.created-1/', null),

    'topic-dir': d(12, 'KAFKA · LOGICAL ADDRESS', 'Topic · orders.created',
      'Topic 是跨 Broker 的逻辑命名空间，不是一块磁盘目录。它包含 P0–P5 六个独立日志；每个 Partition 的 Replica 才会映射到某台 Broker 的本地文件。',
      ['Kafka metadata', 'orders.created', 'P0–P5'], 'Topic + Partition assignment', 'six ordered partition logs',
      [['num.partitions', '6', '决定并行度、Key 路由取模和顺序边界数量。'], ['retention.ms', '7 days', '作用于 Topic 配置，但实际删除以各 Partition 的 Segment 为单位。']],
      'Partition 可以独立分布、扩展、复制和消费。', '分区太多会增加文件、索引、线程调度与元数据成本。',
      'orders.created\n  ├─ P0  ├─ P1  ├─ P2\n  └─ P3  └─ P4  └─ P5', null),

    'partition-dir': d(12, 'KAFKA · LOGICAL REPLICA', 'Partition 1 · Leader Replica',
      'P1 是真正的有序日志与复制单元。Leader End Offset 已从 42 推进到 43，High Watermark 在 ISR 同步后推进到 43。',
      ['orders.created', 'P1', 'Leader Replica @ Broker 2'], 'record batch', 'LEO 43 · HW 43',
      [['replication.factor', '3', '同一 Partition 有三份 Replica。'], ['min.insync.replicas', '2', '与 acks=all 一起定义可写门槛。']],
      '局部有序、复制和 Consumer 位点都以 Partition 为单位。', '跨 Partition 不提供全局顺序；热点 Key 会压在单个 Leader 上。',
      'TopicPartition("orders.created", 1)\nbaseOffset = 42\nlogEndOffset = 43', null),

    'segment': d(12, 'BROKER · PHYSICAL FILES', 'Active Log Segment',
      '真正保存 RecordBatch 的是 .log；.index 把相对 Offset 稀疏映射到字节位置，.timeindex 保存时间戳索引，.txnindex 服务事务读取。',
      ['Broker 2', 'orders.created-1', 'active segment', 'base offset 0'], 'RecordBatch · offset 42', '.log bytes + sparse indexes',
      [['log.segment.bytes', '1 GiB', '达到上限后滚动新 Segment。'], ['log.index.interval.bytes', '4096', '越小查找更快，但索引更大。'], ['log.segment.ms', '7 days', '低流量 Topic 也可按时间滚动。']],
      '顺序 .log 写入很快；稀疏索引以很小空间快速定位。', '查找不是一次哈希命中：先定位 Segment、索引近似位置，再扫描 Batch。',
      '00000000000000000000.log\n00000000000000000000.index\n00000000000000000000.timeindex\n00000000000000000000.txnindex', null),

    'follower-1': d(13, 'BROKER 1 · FOLLOWER REPLICA', 'Broker 1 · P1 Follower',
      'Follower 通过 ReplicaFetcher 主动向 Leader 拉取 P1 新 Batch，追加到自己的 Page Cache 与 Segment，随后推进自己的 LEO。',
      ['Broker 1', 'ReplicaFetcher', 'Page Cache', 'orders.created-1 segment'], 'FetchResponse · batch 42', 'Follower LEO 43',
      [['replica.fetch.max.bytes', '1 MiB', '必须能容纳最大 Batch。'], ['replica.lag.time.max.ms', '30000', '长时间未追上会被移出 ISR。'], ['broker.rack', 'az-a', '让副本跨故障域分布。']],
      'Leader 主机损坏时仍有同步副本可被选举。', '每条记录产生额外网络、内存与磁盘写入。',
      'ReplicaFetcherThread → FetchRequest → append', null),
    'follower-3': d(13, 'BROKER 3 · FOLLOWER REPLICA', 'Broker 3 · P1 Follower',
      '第二个 Follower 位于另一个故障域，与 Broker 1 一样拉取并追加 Batch。三份 Replica 共同组成 RF=3。',
      ['Broker 3', 'ReplicaFetcher', 'Page Cache', 'orders.created-1 segment'], 'FetchResponse · batch 42', 'Follower LEO 43',
      [['replication.factor', '3', '容忍节点故障，但容量和流量约为三倍。'], ['broker.rack', 'az-c', '跨机架减少同域故障风险。']],
      '提供额外故障容忍并支撑 acks=all。', '跨可用区复制可能增加成本和确认延迟。',
      'ISR = [1, 2, 3]\nHighWatermark = min(LEO of ISR)', null),

    'consumer-nic': d(14, 'CONSUMER · NETWORK EDGE', 'Consumer NIC + TLS / TCP',
      'Consumer 主动发送 FetchRequest(P1, offset=42)，Broker 返回包含 RecordBatch 的字节。连接通常长期复用。',
      ['Consumer Host', 'Linux kernel', 'TLS socket', 'Broker 2'], 'FetchRequest · P1@42', 'FetchResponse bytes',
      [['receive.buffer.bytes', '64 KiB', '影响客户端 Socket 接收缓冲。'], ['security.protocol', 'SASL_SSL', 'Fetch Response 也要经过 TLS 解密。']],
      'Consumer 用自己的节奏拉取，不会被 Broker 推送压垮。', '网络与 TLS 开销会影响 Fetch 长尾和 CPU。',
      'consumer → FetchRequest\nbroker → FetchResponse(records)', null),

    'fetcher': d(14, 'CONSUMER · NETWORK CLIENT', 'Fetcher',
      'Fetcher 依据当前 position=42 构造 FetchRequest。Broker 会从 Page Cache 命中或读取文件页，然后批量返回 RecordBatch。',
      ['Consumer Host', 'JVM', 'ConsumerNetworkClient', 'Fetcher'], 'position P1@42', 'CompletedFetch · RecordBatch',
      [['fetch.min.bytes', '1', '增大能提高批量效率，也会增加低流量等待。'], ['fetch.max.wait.ms', '500', '达到 min.bytes 前的最长等待。'], ['max.partition.fetch.bytes', '1 MiB', '单 Partition 响应上限必须容纳最大 Batch。']],
      '拉模式把背压控制权交给 Consumer，并天然支持批量。', '参数不合适会产生空轮询、长尾等待或内存峰值。',
      'FetchRequest.Builder.forConsumer(...)\nfetchBuffer.add(completedFetch)', source('clients/src/main/java/org/apache/kafka/clients/consumer/internals/AbstractFetch.java', 300, 430)),

    'record-parser': d(15, 'CONSUMER · FETCH BUFFER', 'CompletedFetch · Record Parser',
      'Consumer 解压 RecordBatch、验证 CRC、按 Offset 迭代记录，并取出 key/value ByteBuffer、timestamp 与 Headers。',
      ['Consumer Host', 'JVM', 'CompletedFetch', 'fetch buffer'], 'compressed RecordBatch', 'raw Consumer record fields',
      [['check.crcs', 'true', '检测网络或存储损坏，代价是少量 CPU。'], ['max.poll.records', '500', '限制一次 poll 交给业务的记录数。']],
      'Broker 不必理解业务 Schema；批量字节在客户端才拆成记录。', '损坏或超大 Batch 会在 Consumer 端成为读取故障边界。',
      'Record record = records.next();\nparseRecord(partition, leaderEpoch, timestampType, record);', source('clients/src/main/java/org/apache/kafka/clients/consumer/internals/CompletedFetch.java', 300, 345)),

    'deserializer': d(16, 'CONSUMER · APPLICATION THREAD', 'Deserializer',
      'Key byte[] 恢复为 String，Value byte[] 恢复为 OrderCreated；随后构造带 topic、partition、offset=42、headers 的 ConsumerRecord。',
      ['Consumer Host', 'JVM', 'poll thread', 'Deserializer'], 'key/value ByteBuffer', 'ConsumerRecord<String, OrderCreated>',
      [['key.deserializer', 'StringDeserializer', '必须与 Producer Key 字节格式对称。'], ['value.deserializer', 'schema aware', 'Schema 不兼容会产生 poison-pill。']],
      '业务代码重新获得类型化对象与完整 Kafka 上下文。', '一条无法解析的记录可能阻塞整个 Partition，需要 DLT 策略。',
      'K key = keyDeserializer.deserialize(...);\nV value = valueDeserializer.deserialize(...);\nreturn new ConsumerRecord<>(..., offset, key, value, headers);', source('clients/src/main/java/org/apache/kafka/clients/consumer/internals/CompletedFetch.java', 300, 345)),

    'handler': d(16, 'CONSUMER · BUSINESS CODE', 'Business Handler',
      'poll() 把 ConsumerRecord 交给风控逻辑。处理成功、Offset 提交和消息拉取是三个不同边界。',
      ['Consumer Host', 'JVM', 'application thread', 'riskService'], 'ConsumerRecord · offset 42', 'business side effect',
      [['max.poll.interval.ms', '300000', '业务必须在窗口内再次 poll，否则可能失去分区。'], ['idempotency key', 'A1024', '屏蔽处理成功但 Commit 前崩溃导致的重复副作用。'], ['retry / DLT', 'bounded', '无限原地重试会阻塞 P1。']],
      '业务可用自己的事务、幂等表和重试策略处理副作用。', 'At-least-once 下，处理成功到 Commit 之间存在重复窗口。',
      'for (ConsumerRecord<String, OrderCreated> record : records) {\n  riskService.evaluate(record.value());\n}', source('clients/src/main/java/org/apache/kafka/clients/consumer/ConsumerRecord.java', 50, 130)),

    'group-coordinator': d(17, 'BROKER · GROUP STATE', 'Group Coordinator',
      'Coordinator 校验 Consumer Group 的 generation/member 状态，并把 P1 的下一读取位置 43 写入 __consumer_offsets。',
      ['Broker 2', 'Kafka JVM', 'GroupCoordinator', '__consumer_offsets'], 'OffsetCommitRequest · P1→43', 'group offset record',
      [['offsets.topic.num.partitions', '50', '决定 Group 状态在内部 Topic 的分布。'], ['offsets.retention.minutes', '10080', '无活跃订阅时 Offset 的保留窗口。']],
      '每个 Consumer Group 都能独立保存位置并回放同一 Topic。', '业务副作用与 Offset Commit 不是跨系统原子操作。',
      'groupMetadataManager.storeOffsets(...)\n// key = group + topic + partition', null),

    'offset-commit': d(17, 'CONSUMER · COMMIT BOUNDARY', 'Offset Commit · next=43',
      '处理 offset 42 成功后提交的是下一读取位置 43。恢复时从 43 开始，而不是重新从 42 开始。',
      ['Consumer Host', 'JVM', 'commitSync', 'Group Coordinator'], 'processed offset 42', 'committed next offset 43',
      [['enable.auto.commit', 'false', '把提交边界放到业务成功之后。'], ['commitSync / commitAsync', 'sync', 'Sync 结果明确但阻塞；Async 需要处理回调与乱序。'], ['group.id', 'order-risk-service', '决定保存哪一套独立消费位置。']],
      '消费位置与日志解耦，同一 Topic 可被多个 Group 独立读取。', '先处理后提交可能重复；先提交后处理可能丢业务。',
      'consumer.commitSync(Map.of(\n  new TopicPartition("orders.created", 1),\n  new OffsetAndMetadata(43L)));', source('clients/src/main/java/org/apache/kafka/clients/consumer/internals/AsyncKafkaConsumer.java', 1790, 1835))
  };

  details['producer-peer-1'] = hostDetail(0, 'Producer · payment-service', '与其他 Producer 共享 Topic，但维护自己独立的 Batch、连接和重试状态', '10.20.4.16', 'payment-service JVM');
  details['producer-peer-3'] = hostDetail(0, 'Producer · inventory-service', '第三个独立 Producer；它的消息可能按 Key 落到 P0–P5 中任意 Partition', '10.20.4.18', 'inventory-service JVM');
  details['tor-switch'] = d(7, 'PHYSICAL NETWORK', 'Top-of-Rack Switch · rack-04',
    '交换机只转发以太网帧/IP Packet；它不知道 Topic、Partition 或 Offset。Producer 根据元数据先选定 Broker 2，再建立到 10.20.8.22:9093 的 TCP 连接。',
    ['rack-04', 'ToR switch', 'port 08 → port 10'], 'Ethernet frame from Producer NIC', 'Ethernet frame to Broker 2 NIC',
    [['link speed', '25 GbE', '带宽是所有连接共享的物理上限。'], ['TCP connection', 'producer → broker', 'Kafka 的请求复用长连接，避免每条消息重新握手。']],
    '标准网络让 Producer 与 Broker 可以独立扩容和跨主机部署。', '网络拥塞、丢包和重传会直接放大端到端尾延迟。', 'Ethernet → IP → TCP → TLS → Kafka Protocol', null);
  details['consumer-peer-a1'] = d(14, 'CONSUMER GROUP A', 'consumer-a1 · P0 / P3', '同一个 Group 内，每个 Partition 同时只分配给一个 Consumer。A1 不会读取 P1，因此不会处理 #A1024。', ['Group A', 'consumer-a1'], 'P0 + P3', 'business events', [['group.id', 'order-risk-service', '与 A2、A3 共享一套分区分配和提交位置。']], '组内横向扩容可并行处理多个 Partition。', 'Consumer 数量超过 Partition 数后，多出的实例会空闲。', 'assignment = [P0, P3]', null);
  details['consumer-peer-a3'] = d(14, 'CONSUMER GROUP A', 'consumer-a3 · P2 / P5', 'A3 与 A1、A2 属于同一 Group，负责另外两个 Partition。', ['Group A', 'consumer-a3'], 'P2 + P5', 'business events', [['assignor', 'cooperative-sticky', '尽量减少 Rebalance 时不必要的 Partition 移动。']], '在组内并行消费。', 'Rebalance 期间分配会发生迁移。', 'assignment = [P2, P5]', null);
  details['consumer-peer-b1'] = d(14, 'CONSUMER GROUP B', 'consumer-b1 · P0 / P2 / P4', 'analytics-etl 使用不同 group.id，因此会独立读取 Topic 的完整数据，而不是与 Group A 抢消息。', ['Group B', 'consumer-b1'], 'P0 + P2 + P4', 'analytics rows', [['group.id', 'analytics-etl', '拥有独立的 committed offsets。']], '一份日志可服务多个互不影响的业务。', '每个 Group 都会产生自己的读取流量和下游副作用。', 'assignment = [P0, P2, P4]', null);
  details['consumer-peer-b2'] = d(14, 'CONSUMER GROUP B', 'consumer-b2 · P1 / P3 / P5', '#A1024 位于 P1，因此除了 Group A 的 A2，Group B 的 B2 也会独立收到它。', ['Group B', 'consumer-b2', 'P1'], 'Fetch P1@group-B-offset', 'independent analytics event', [['group.id', 'analytics-etl', '提交位置完全独立于 order-risk-service。']], '支持同一事件的多种用途。', '新增 Group 会增加 Broker Fetch 带宽。', 'assignment = [P1, P3, P5]', null);
  details['record-batch'] = d(12, 'KAFKA LOGICAL FORMAT', 'RecordBatch · offset 42', 'Event 不会作为独立文件保存；它与相邻记录编码在 RecordBatch 中，包含 baseOffset、时间戳、压缩与 CRC。', ['orders.created', 'P1', 'active segment', 'file position 8192'], 'serialized record', 'RecordBatch bytes', [['compression.type', 'zstd', '整个 Batch 共同压缩。'], ['magic', 'v2', '定义当前 RecordBatch 格式。']], '批量编码提高网络、Page Cache 与磁盘效率。', '读取一条记录通常也需要解析所在 Batch。', 'RecordBatch(baseOffset=42, records=[#A1024, ...])', null);

  var steps = [
    { zone: 'APPLICATION', title: '业务代码创建 Event', summary: '我现在只是 Producer JVM 堆内存中的对象，Kafka 还不知道我存在。', form: 'ProducerRecord<String, OrderCreated>', facts: ['topic · orders.created', 'key · user-9527', 'offset · ∅'], component: 'business', nodes: ['business'], pos: [216, 217], view: [28, 145, 370, 315], edges: [] },
    { zone: 'PRODUCER', title: 'send() 进入 Interceptor', summary: 'Future 已返回并不代表写入成功；真正的确认边界还很远。', form: 'ProducerRecord · intercepted', facts: ['thread · application', 'future · pending', 'partition · ∅'], component: 'interceptor', nodes: ['interceptor'], pos: [137, 289], view: [28, 145, 370, 315], edges: ['flow-0'] },
    { zone: 'SERIALIZE', title: 'Key 与 Value 变成 byte[]', summary: 'Java 对象边界在这里结束；跨语言系统只共享字节和 Schema。', form: 'Serialized Record', facts: ['key · 9 bytes', 'value · 86 bytes', 'headers · 3'], component: 'serializer', nodes: ['serializer'], pos: [303, 289], view: [28, 145, 370, 315], edges: ['flow-1'] },
    { zone: 'PARTITION', title: 'Key 把 Event 路由到 P1', summary: 'Kafka 只保证 Partition 内顺序；user-9527 稳定进入 P1。', form: 'TopicPartition · orders.created-1', facts: ['hash · murmur2', 'partitions · 6', 'selected · P1'], component: 'partitioner', nodes: ['partitioner'], pos: [137, 369], view: [28, 145, 370, 315], edges: ['flow-2'] },
    { zone: 'BUFFER', title: '进入 P1 的 ProducerBatch', summary: '我与邻近记录共享 ByteBuffer、压缩和一次网络请求。', form: 'ProducerBatch · zstd', facts: ['batch · P1', 'records · 3', 'ready · true'], component: 'accumulator', nodes: ['accumulator'], pos: [303, 369], view: [28, 230, 370, 300], edges: ['flow-3'] },
    { zone: 'SENDER', title: '网络线程 Drain Batch', summary: '业务线程已经放手；Sender 接管重试、InFlight 和请求构造。', form: 'ProduceRequest', facts: ['broker · 2', 'correlation · 1842', 'acks · all'], component: 'sender', nodes: ['sender'], pos: [137, 469], view: [28, 325, 370, 300], edges: ['flow-4'] },
    { zone: 'PROTOCOL', title: '编码 Kafka Protocol Frame', summary: 'Request Header 与 RecordBatch Body 被编码为可以写入连接的字节。', form: 'Kafka Protocol Frame', facts: ['API · Produce', 'version · negotiated', 'id · 1842'], component: 'network-client', nodes: ['network-client'], pos: [303, 469], view: [28, 325, 370, 300], edges: ['flow-5'] },
    { zone: 'NETWORK', title: '离开 Producer，穿过 TCP/TLS', summary: '我现在只是加密字节流，依次经过进程、内核 Socket Buffer、NIC 与网络。', form: 'Encrypted TCP Bytes', facts: ['src · :49152', 'dst · broker-2:9093', 'state · in flight'], component: 'producer-tcp', nodes: ['producer-tcp', 'producer-nic', 'broker-nic'], pos: [435, 460], view: [185, 120, 500, 520], edges: ['flow-6', 'flow-7a', 'flow-7b'] },
    { zone: 'BROKER I/O', title: 'Broker Processor 接收请求', summary: '网络线程读完整帧并交给 RequestChannel，不执行完整磁盘追加。', form: 'RequestChannel.Request', facts: ['API · Produce', 'client · order-service', 'queue · ready'], component: 'socket-server', nodes: ['broker-nic', 'socket-server'], pos: [711, 203], view: [470, 110, 510, 300], edges: ['flow-8'] },
    { zone: 'REQUEST QUEUE', title: '请求跨线程进入 Handler', summary: 'RequestChannel 隔离网络 I/O 和 Kafka API 处理，也暴露了拥塞排队点。', form: 'KafkaApis.handleProduceRequest', facts: ['handler · io-thread', 'queue · request', 'wait · 1.4 ms'], component: 'request-channel', nodes: ['request-channel'], pos: [878, 203], view: [470, 110, 510, 300], edges: ['flow-9'] },
    { zone: 'LEADER', title: 'KafkaApis 进入 P1 Leader', summary: '请求完成授权和配额检查；ReplicaManager 校验 minISR，并让 P1 的单 Leader 确定写入顺序。', form: 'MemoryRecords · baseOffset 42', facts: ['partition · P1', 'LEO · 42→43', 'ISR · 3'], component: 'replica-manager', nodes: ['kafka-apis', 'replica-manager'], pos: [878, 316], view: [470, 130, 510, 310], edges: ['flow-10'] },
    { zone: 'LOG', title: 'UnifiedLog 追加顺序日志', summary: '逻辑 Offset 被映射到底层 LocalLog 和 Active Segment。', form: 'FileRecords Append', facts: ['base offset · 42', 'segment base · 0', 'bytes · batch'], component: 'unified-log', nodes: ['unified-log'], pos: [717, 322], view: [470, 220, 510, 350], edges: ['flow-11'] },
    { zone: 'STORAGE', title: 'Page Cache 与 Segment 同时变化', summary: '文件页先进入 OS Page Cache；.log 保存 Batch，索引文件帮助定位。', form: 'Segment Files · offset 42', facts: ['page · dirty', 'LEO · 43', 'file position · 8192'], component: 'segment', nodes: ['page-cache', 'storage-volume', 'topic-dir', 'partition-dir', 'segment'], pos: [717, 707], view: [470, 405, 525, 350], edges: ['flow-12a', 'flow-12b', 'flow-12c'] },
    { zone: 'REPLICATION', title: 'Follower 拉取并推进 ISR', summary: 'Broker 1 和 3 各自写入 Page Cache 与 Segment；Leader 等待同步条件。', form: 'Replicated RecordBatch', facts: ['RF · 3', 'ISR · [1,2,3]', 'HW · 43'], component: 'follower-1', nodes: ['follower-1', 'follower-3'], pos: [1129, 270], view: [810, 70, 440, 540], edges: ['flow-13a', 'flow-13b'] },
    { zone: 'FETCH', title: 'Consumer 主动 Fetch P1@42', summary: '拉模式让 Consumer 决定节奏；Broker 优先从 Page Cache 读取文件页。', form: 'FetchResponse · RecordBatch', facts: ['position · 42', 'source · page cache', 'bytes · batch'], component: 'fetcher', nodes: ['page-cache', 'consumer-nic', 'fetcher'], pos: [1418, 460], view: [640, 350, 920, 310], edges: ['flow-14a', 'flow-14b'] },
    { zone: 'PARSE', title: '解压 Batch、校验 CRC', summary: 'CompletedFetch 迭代记录，恢复 offset、timestamp、headers 与原始字节。', form: 'Raw Consumer Record Fields', facts: ['offset · 42', 'CRC · valid', 'headers · 3'], component: 'record-parser', nodes: ['record-parser'], pos: [1418, 386], view: [1250, 130, 330, 440], edges: ['flow-15'] },
    { zone: 'BUSINESS', title: '反序列化并执行业务处理', summary: '我重新成为 OrderCreated；处理成功仍不等于消费位置已经提交。', form: 'ConsumerRecord<String, OrderCreated>', facts: ['offset · 42', 'value · OrderCreated', 'processed · yes'], component: 'handler', nodes: ['deserializer', 'handler'], pos: [1418, 216], view: [1250, 130, 330, 400], edges: ['flow-16a', 'flow-16b'] },
    { zone: 'COMMIT', title: '提交下一位置 43', summary: 'Group Coordinator 把 P1→43 记入 __consumer_offsets；我的主旅程到此结束。', form: 'Committed Offset · 43', facts: ['group · order-risk-service', 'P1 · next 43', 'semantics · at-least-once'], component: 'offset-commit', nodes: ['offset-commit', 'group-coordinator'], pos: [1418, 681], view: [430, 250, 1160, 500], edges: ['flow-17a', 'flow-17b'] }
  ];

  steps = [
    { zone: 'CLUSTER MAP', title: '先定位我所在的完整集群', summary: '3 个 Producer、3 个 Broker、6 个 Partition、2 个 Consumer Group 同时存在；橙色只追踪 #A1024。', form: 'ProducerRecord · not sent', facts: ['producers · 3', 'partitions · 6', 'consumer groups · 2'], component: 'producer-host', nodes: ['producer-host', 'partition-dir', 'consumer-host'], pos: [330, 322], view: [0, 0, 2400, 700], edges: ['flow-0'] },
    { zone: 'PRODUCER', title: 'order-service 创建并 send(record)', summary: '我诞生在 Producer 2 的 JVM Heap；topic、key、value、headers 都在这一行代码中组装。', form: 'ProducerRecord<String, OrderCreated>', facts: ['topic · orders.created', 'key · user-9527', 'headers · 3'], component: 'business', nodes: ['business'], pos: [209, 1029], view: [28, 900, 620, 560], edges: ['flow-1'] },
    { zone: 'SERIALIZE', title: 'Key / Value / Headers 成为协议字节', summary: '对象不会直接进入 Kafka；Serializer 决定跨语言格式、体积和 Schema 演进。', form: 'Serialized Record', facts: ['key · 9 B', 'value · 86 B', 'headers · 3'], component: 'serializer', nodes: ['serializer'], pos: [209, 1113], view: [28, 900, 620, 560], edges: ['flow-2'] },
    { zone: 'PARTITION', title: '在 6 个 Partition 中选中 P1', summary: 'Murmur2(keyBytes) 对分区数取模；相同 key 获得 P1 内的局部顺序，而不是全 Topic 顺序。', form: 'TopicPartition · orders.created-1', facts: ['partition count · 6', 'selected · P1', 'leader · Broker 2'], component: 'partitioner', nodes: ['partitioner', 'partition-dir'], pos: [456, 1113], view: [28, 900, 620, 560], edges: ['flow-3'] },
    { zone: 'BUFFER', title: '进入 P1 专属 ProducerBatch', summary: 'RecordAccumulator 按 TopicPartition 分 deque；我与邻近记录共享压缩和一次 ProduceRequest。', form: 'ProducerBatch · P1', facts: ['batch.size · 16 KiB', 'compression · zstd', 'linger · 5 ms'], component: 'accumulator', nodes: ['accumulator'], pos: [339, 1197], view: [28, 930, 620, 530], edges: ['flow-4'] },
    { zone: 'SENDER', title: 'Sender 网络线程接管', summary: '业务线程已返回 Future；后台线程 drain P1 Batch、维护重试与 in-flight 请求。', form: 'ProduceRequest', facts: ['acks · all', 'broker · 2', 'correlation · 1842'], component: 'sender', nodes: ['sender'], pos: [209, 1281], view: [28, 1000, 620, 460], edges: ['flow-5'] },
    { zone: 'PROTOCOL', title: 'NetworkClient 写入内核与 NIC', summary: 'Kafka Protocol Frame 经过 TLS/TCP、Socket Send Buffer 和网卡，物理上离开 Producer 主机。', form: 'Encrypted TCP bytes', facts: ['src · 10.20.4.17', 'dst · 10.20.8.22:9093', 'wire · Ethernet'], component: 'producer-nic', nodes: ['network-client', 'producer-tcp', 'producer-nic'], pos: [573, 1404], view: [130, 1110, 500, 350], edges: ['flow-6', 'flow-7a'] },
    { zone: 'PHYSICAL NETWORK', title: '穿过交换机，定向到 Broker 2', summary: '并非广播给所有 Broker；元数据已告诉 Producer：P1 Leader 当前位于 Broker 2。', form: 'TCP stream · in flight', facts: ['ToR · rack-04', 'destination · Broker 2', 'other brokers · not target'], component: 'tor-switch', nodes: ['producer-host', 'tor-switch', 'broker-host', 'partition-dir'], pos: [650, 350], view: [0, 70, 1760, 520], edges: ['flow-7b'] },
    { zone: 'BROKER I/O', title: 'Broker NIC 与 SocketServer 收帧', summary: '网卡 DMA、内核 Socket Buffer、Kafka Processor 依次交接；网络线程不负责完整日志追加。', form: 'RequestChannel.Request', facts: ['broker · 2', 'processor · network thread', 'request queue · ready'], component: 'socket-server', nodes: ['broker-nic', 'socket-server'], pos: [1025, 997], view: [700, 900, 680, 330], edges: ['flow-8'] },
    { zone: 'REQUEST QUEUE', title: '请求跨线程进入 KafkaApis', summary: 'RequestChannel 是真实排队边界；Handler 执行授权、配额与 Produce API 逻辑。', form: 'KafkaApis.handleProduceRequest', facts: ['queue time · 1.4 ms', 'handler · api-7', 'quota · passed'], component: 'request-channel', nodes: ['request-channel', 'kafka-apis'], pos: [1235, 997], view: [880, 900, 650, 330], edges: ['flow-9'] },
    { zone: 'PARTITION LEADER', title: 'P1 Leader 决定 offset 42', summary: '6 个 Partition 并行拥有各自日志；这条消息只进入 Broker 2 上的 P1 Leader Replica。', form: 'MemoryRecords · baseOffset 42', facts: ['P1 LEO · 42→43', 'ISR · B1/B2/B3', 'ordering · P1 only'], component: 'replica-manager', nodes: ['replica-manager', 'partition-dir'], pos: [1235, 1080], view: [900, 920, 690, 380], edges: ['flow-10'] },
    { zone: 'LOGICAL LOG', title: 'Topic → P1 → Segment → RecordBatch', summary: '这些是 Kafka 的逻辑地址，不是硬盘里的四层盒子；offset 42 被映射为 Segment 文件位置 8192。', form: 'FileRecords append', facts: ['segment base · 0', 'offset · 42', 'file position · 8192'], component: 'segment', nodes: ['unified-log', 'topic-dir', 'partition-dir', 'segment', 'record-batch'], pos: [1548, 1202], view: [700, 1020, 1040, 360], edges: ['flow-11', 'flow-12a'] },
    { zone: 'PHYSICAL STORAGE', title: '从文件位置映射到 Page、Extent 与 LBA', summary: '写入先命中 RAM Page Cache；XFS 用 inode/extent 映射文件位置，回写时 NVMe Controller 才把 LBA 送往 NAND。', form: 'dirty page · later writeback', facts: ['page · 4 KiB', 'inode · 812944', 'LBA · 884736'], component: 'page-cache', nodes: ['page-cache', 'broker-kernel', 'storage-volume', 'segment'], pos: [1458, 1388], view: [700, 1160, 1040, 370], edges: ['flow-12b', 'flow-12c'] },
    { zone: 'REPLICATION', title: 'Broker 1 与 3 拉取 P1 副本', summary: 'Follower Broker 各自把 Batch 写进自己的 Page Cache 与 Segment；RF=3 意味着三个独立故障域。', form: 'Replicated RecordBatch', facts: ['leader · B2', 'followers · B1/B3', 'HW · 43'], component: 'follower-1', nodes: ['follower-1', 'broker-host', 'follower-3', 'partition-dir'], pos: [1245, 322], view: [760, 130, 990, 420], edges: [] },
    { zone: 'CONSUMER GROUPS', title: '同一条 Event 被两个 Group 独立读取', summary: 'Group A 的 A2 负责 P1/P4；Group B 的 B2 也负责 P1/P3/P5。组内不重复，组间互不影响。', form: 'FetchRequest · P1@42', facts: ['Group A · consumer-a2', 'Group B · consumer-b2', 'assignor · cooperative'], component: 'consumer-host', nodes: ['consumer-host', 'consumer-peer-b2', 'partition-dir'], pos: [1960, 338], view: [1060, 110, 1320, 480], edges: ['flow-14a'] },
    { zone: 'FETCH PATH', title: 'Consumer 拉取时优先读 Page Cache', summary: 'Broker 按文件位置读取；热页直接从 RAM 送入 Socket，缺页才触发 XFS/NVMe 读取。', form: 'FetchResponse · RecordBatch', facts: ['hot path · Page Cache', 'cold path · NVMe', 'zero-copy · platform dependent'], component: 'fetcher', nodes: ['page-cache', 'fetcher', 'consumer-nic'], pos: [2132, 1036], view: [1760, 920, 600, 420], edges: ['flow-14b', 'flow-15'] },
    { zone: 'DESERIALIZE', title: '解析 Batch，恢复 Event', summary: 'Consumer 校验 CRC、解压并迭代记录；Deserializer 用相同 Schema 把 value bytes 恢复成 OrderCreated。', form: 'ConsumerRecord<String, OrderCreated>', facts: ['offset · 42', 'headers · restored', 'CRC · valid'], component: 'handler', nodes: ['record-parser', 'deserializer', 'handler'], pos: [2174, 1221], view: [1800, 1030, 540, 430], edges: ['flow-16a', 'flow-16b'] },
    { zone: 'COMMIT', title: 'Group A 提交下一位置 43', summary: '处理 offset 42 后提交 next=43；Group B 保存另一套位置，Producer 和其他 Partition 也完全不受影响。', form: 'Committed Offset · 43', facts: ['group · order-risk-service', 'P1 · next 43', 'semantic · at-least-once'], component: 'offset-commit', nodes: ['offset-commit', 'group-coordinator'], pos: [2065, 1332], view: [720, 1260, 1620, 280], edges: ['flow-17a', 'flow-17b'] }
  ];

  var el = {
    stepKicker: document.getElementById('step-kicker'),
    stepTitle: document.getElementById('step-title'),
    stepSummary: document.getElementById('step-summary'),
    eventForm: document.getElementById('event-form'),
    eventFacts: document.getElementById('event-facts'),
    timeline: document.getElementById('timeline'),
    marks: document.getElementById('timeline-marks'),
    timelineStep: document.getElementById('timeline-step'),
    timelineZone: document.getElementById('timeline-zone'),
    prev: document.getElementById('prev-step'),
    next: document.getElementById('next-step'),
    play: document.getElementById('play-trace'),
    speed: document.getElementById('speed'),
    camera: document.getElementById('camera-mode'),
    reset: document.getElementById('reset-view'),
    openCurrent: document.getElementById('open-current'),
    zoom: document.getElementById('zoom-readout'),
    inspector: document.getElementById('component-inspector'),
    backdrop: document.getElementById('inspector-backdrop'),
    close: document.getElementById('close-inspector'),
    jump: document.getElementById('jump-component'),
    inspectorKicker: document.getElementById('inspector-kicker'),
    inspectorTitle: document.getElementById('inspector-title'),
    inspectorSummary: document.getElementById('inspector-summary'),
    inspectorLocation: document.getElementById('inspector-location'),
    inspectorInput: document.getElementById('inspector-input'),
    inspectorOutput: document.getElementById('inspector-output'),
    inspectorConfig: document.getElementById('inspector-config'),
    inspectorGain: document.getElementById('inspector-gain'),
    inspectorCost: document.getElementById('inspector-cost'),
    inspectorCode: document.getElementById('inspector-code'),
    inspectorSource: document.getElementById('inspector-source')
  };

  var state = { step: 0, playing: false, timer: 0, camera: true, selected: null, inspectorId: null };
  var view = { x: 0, y: 0, w: 2400, h: 700 };
  var fullView = [0, 0, 2400, 700];
  var tokenEl = document.getElementById('event-token');
  var nodeEls = Array.prototype.slice.call(scene.querySelectorAll('.component'));
  var routeEls = Array.prototype.slice.call(scene.querySelectorAll('.flow-line'));

  for (var i = 0; i < steps.length; i++) el.marks.insertAdjacentHTML('beforeend', '<i></i>');

  function setView(box, animate) {
    var target = { x: box[0], y: box[1], w: box[2], h: box[3] };
    function apply() {
      svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h);
      el.zoom.textContent = Math.round(2400 / view.w * 100) + '%';
    }
    if (gsapApi && animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsapApi.killTweensOf(view);
      gsapApi.to(view, { x: target.x, y: target.y, w: target.w, h: target.h, duration: 0.72, ease: 'power3.inOut', onUpdate: apply });
    } else {
      view.x = target.x; view.y = target.y; view.w = target.w; view.h = target.h; apply();
    }
  }

  function setCamera(enabled) {
    state.camera = enabled;
    el.camera.classList.toggle('active', enabled);
    el.camera.setAttribute('aria-pressed', String(enabled));
  }

  function moveToken(position, animate, stepIndex, followPath) {
    if (gsapApi) {
      gsapApi.killTweensOf(tokenEl);
      var path = stepIndex > 0 && followPath ? document.getElementById('motion-' + stepIndex) : null;
      if (animate && path && window.MotionPathPlugin) {
        gsapApi.to(tokenEl, { duration: 0.88, ease: 'power2.inOut', motionPath: { path: path, align: path, alignOrigin: [0.5, 0.5], autoRotate: false } });
      } else {
        gsapApi.to(tokenEl, { x: position[0], y: position[1], duration: animate ? 0.68 : 0, ease: 'power3.inOut' });
      }
    } else {
      tokenEl.setAttribute('transform', 'translate(' + position[0] + ' ' + position[1] + ')');
    }
  }

  function activeChapter(stepIndex) {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-jump]'));
    var current = buttons[0];
    buttons.forEach(function (button) {
      if (Number(button.dataset.jump) <= stepIndex) current = button;
      button.removeAttribute('aria-current');
    });
    current.setAttribute('aria-current', 'step');
  }

  function renderStep(nextIndex, options) {
    options = options || {};
    var index = Math.max(0, Math.min(steps.length - 1, nextIndex));
    var step = steps[index];
    var previousStep = state.step;
    state.step = index;
    el.stepKicker.textContent = 'STEP ' + String(index + 1).padStart(2, '0') + ' · ' + step.zone;
    el.stepTitle.textContent = step.title;
    el.stepSummary.textContent = step.summary;
    el.eventForm.textContent = step.form;
    el.eventFacts.innerHTML = step.facts.map(function (fact) { return '<code>' + fact + '</code>'; }).join('');
    el.timeline.value = index;
    el.timeline.style.setProperty('--progress', (index / (steps.length - 1) * 100) + '%');
    el.timelineStep.textContent = String(index + 1).padStart(2, '0') + ' / ' + steps.length;
    el.timelineZone.textContent = step.zone;
    Array.prototype.forEach.call(el.marks.children, function (mark, markIndex) { mark.classList.toggle('passed', markIndex <= index); });
    activeChapter(index);

    nodeEls.forEach(function (node) { node.classList.toggle('active', step.nodes.indexOf(node.dataset.component) !== -1); });
    routeEls.forEach(function (route) {
      var order = Number(route.dataset.order);
      route.classList.toggle('active', step.edges.indexOf(route.id) !== -1);
      route.classList.toggle('passed', order < index);
    });

    moveToken(step.pos, options.animate !== false, index, index === previousStep + 1);
    if (state.camera && options.camera !== false) setView(step.view, options.animate !== false);
    if (gsapApi && options.animate !== false) {
      step.nodes.forEach(function (id) {
        var target = scene.querySelector('[data-component="' + id + '"]');
        if (target) gsapApi.fromTo(target, { scale: 0.985, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.42, ease: 'back.out(2)' });
      });
    }
  }

  function stopPlay() {
    state.playing = false;
    window.clearTimeout(state.timer);
    el.play.setAttribute('aria-pressed', 'false');
    el.play.setAttribute('aria-label', '播放旅程');
  }

  function schedulePlay() {
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(function () {
      if (!state.playing) return;
      if (state.step >= steps.length - 1) {
        stopPlay();
        return;
      }
      renderStep(state.step + 1, { animate: true });
      schedulePlay();
    }, Number(el.speed.value));
  }

  function togglePlay() {
    if (state.playing) {
      stopPlay();
      return;
    }
    if (state.step >= steps.length - 1) renderStep(0, { animate: false, camera: false });
    closeInspector();
    state.playing = true;
    el.play.setAttribute('aria-pressed', 'true');
    el.play.setAttribute('aria-label', '暂停旅程');
    schedulePlay();
  }

  function fallbackDetail(id) {
    var node = scene.querySelector('[data-component="' + id + '"]');
    var title = node ? node.getAttribute('aria-label') : id;
    var replica = /^partition-p(\d)-b(\d)$/.exec(id);
    if (replica) {
      var partitionNo = Number(replica[1]);
      var brokerNo = Number(replica[2]);
      var leaderByPartition = [1, 2, 2, 1, 3, 3];
      var role = leaderByPartition[partitionNo] === brokerNo ? 'Leader' : 'Follower';
      return d(10, 'PARTITION REPLICA', 'P' + partitionNo + ' · ' + role + ' @ Broker ' + brokerNo,
        '这是 orders.created 的一个 Partition Replica。六个 Partition 各自拥有独立 offset 空间；Leader 处理读写，Follower 通过 Fetch 复制。',
        ['Kafka cluster', 'Broker ' + brokerNo, 'orders.created-P' + partitionNo, role], 'RecordBatch stream', 'ordered append log',
        [['replication.factor', '3', '每个 Partition 在三个 Broker 上各有一个副本。'], ['leader', 'Broker ' + leaderByPartition[partitionNo], '客户端只把 Produce 请求发给当前 Leader。']],
        'Partition 提供并行度、局部顺序和故障隔离。', '分区越多，文件、复制、选主和 Consumer 协调成本越高。',
        'TopicPartition("orders.created", ' + partitionNo + ')', null);
    }
    return d(Number(node && node.dataset.step || 0), 'PHYSICAL COMPONENT', title,
      '这是物理拓扑中的一个可交互边界。沿着上级机箱、进程与内核边界，可以判断它占用哪类资源，以及故障会传播到哪里。',
      ['Kafka topology', title], 'upstream data', 'downstream data',
      [['scope', 'component boundary', '点击相邻组件可继续沿数据路径钻取。']], '明确责任和资源边界。', '教学图省略了实现中的部分辅助线程与平台差异。', title, null);
  }

  function openInspector(id) {
    stopPlay();
    var info = details[id] || fallbackDetail(id);
    state.inspectorId = id;
    var physicalMappings = {
      'topic-dir': ['topic-dir', 'partition-dir'],
      'partition-dir': ['topic-dir', 'partition-dir', 'segment'],
      'segment': ['partition-dir', 'segment', 'record-batch', 'page-cache', 'broker-kernel', 'storage-volume'],
      'record-batch': ['segment', 'record-batch', 'page-cache'],
      'page-cache': ['record-batch', 'page-cache', 'broker-kernel'],
      'broker-kernel': ['segment', 'page-cache', 'broker-kernel', 'storage-volume'],
      'storage-volume': ['segment', 'broker-kernel', 'storage-volume'],
      'producer-nic': ['network-client', 'producer-tcp', 'producer-nic', 'tor-switch'],
      'tor-switch': ['producer-nic', 'tor-switch', 'broker-nic'],
      'broker-nic': ['tor-switch', 'broker-nic', 'socket-server'],
      'consumer-host': ['partition-dir', 'consumer-host', 'fetcher']
    };
    var selectedIds = physicalMappings[id] || [id];
    nodeEls.forEach(function (node) { node.classList.toggle('is-selected', selectedIds.indexOf(node.dataset.component) !== -1); });
    el.inspectorKicker.textContent = info.kicker;
    el.inspectorTitle.textContent = info.title;
    el.inspectorSummary.textContent = info.summary;
    el.inspectorLocation.innerHTML = '';
    info.location.forEach(function (part) {
      var span = document.createElement('span'); span.textContent = part; el.inspectorLocation.appendChild(span);
    });
    el.inspectorInput.textContent = info.input;
    el.inspectorOutput.textContent = info.output;
    el.inspectorConfig.innerHTML = '';
    info.configs.forEach(function (config) {
      var row = document.createElement('div'); row.className = 'config-row';
      var key = document.createElement('code'); key.textContent = config[0];
      var value = document.createElement('div');
      var strong = document.createElement('strong'); strong.textContent = config[1];
      var small = document.createElement('small'); small.textContent = config[2];
      value.appendChild(strong); value.appendChild(small); row.appendChild(key); row.appendChild(value); el.inspectorConfig.appendChild(row);
    });
    el.inspectorGain.textContent = info.gain;
    el.inspectorCost.textContent = info.cost;
    el.inspectorCode.textContent = info.code || 'No source snippet for this physical boundary.';
    if (info.source) {
      el.inspectorSource.href = info.source;
      el.inspectorSource.hidden = false;
    } else {
      el.inspectorSource.hidden = true;
    }
    el.backdrop.hidden = false;
    window.requestAnimationFrame(function () {
      el.backdrop.classList.add('visible');
      el.inspector.classList.add('open');
      el.inspector.setAttribute('aria-hidden', 'false');
      el.close.focus();
    });
  }

  function closeInspector() {
    if (!el.inspector.classList.contains('open')) return;
    el.inspector.classList.remove('open');
    el.inspector.setAttribute('aria-hidden', 'true');
    el.backdrop.classList.remove('visible');
    nodeEls.forEach(function (node) { node.classList.remove('is-selected'); });
    window.setTimeout(function () { el.backdrop.hidden = true; }, 230);
  }

  nodeEls.forEach(function (node) {
    node.addEventListener('click', function (event) {
      event.stopPropagation();
      openInspector(node.dataset.component);
    });
    node.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openInspector(node.dataset.component);
      }
    });
  });

  document.querySelectorAll('[data-jump]').forEach(function (button) {
    button.addEventListener('click', function () { stopPlay(); renderStep(Number(button.dataset.jump), { animate: true }); });
  });
  el.timeline.addEventListener('input', function () { stopPlay(); renderStep(Number(el.timeline.value), { animate: true }); });
  el.prev.addEventListener('click', function () { stopPlay(); renderStep(state.step - 1, { animate: true }); });
  el.next.addEventListener('click', function () { stopPlay(); renderStep(state.step + 1, { animate: true }); });
  el.play.addEventListener('click', togglePlay);
  el.speed.addEventListener('change', function () { if (state.playing) schedulePlay(); });
  el.camera.addEventListener('click', function () {
    setCamera(!state.camera);
    if (state.camera) setView(steps[state.step].view, true);
  });
  el.reset.addEventListener('click', function () { stopPlay(); setCamera(false); setView(fullView, true); });
  el.openCurrent.addEventListener('click', function () { openInspector(steps[state.step].component); });
  el.close.addEventListener('click', closeInspector);
  el.backdrop.addEventListener('click', closeInspector);
  el.jump.addEventListener('click', function () {
    var info = details[state.inspectorId] || fallbackDetail(state.inspectorId);
    closeInspector();
    renderStep(info.step, { animate: true });
  });

  var drag = null;
  viewport.addEventListener('pointerdown', function (event) {
    if (event.button !== 0 || event.target.closest('.component')) return;
    viewport.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
    viewport.classList.add('dragging');
    setCamera(false);
  });
  viewport.addEventListener('pointermove', function (event) {
    if (!drag || drag.id !== event.pointerId) return;
    var rect = viewport.getBoundingClientRect();
    view.x = drag.vx - (event.clientX - drag.x) * view.w / rect.width;
    view.y = drag.vy - (event.clientY - drag.y) * view.h / rect.height;
    svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h);
  });
  function endDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null; viewport.classList.remove('dragging');
  }
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
  viewport.addEventListener('wheel', function (event) {
    event.preventDefault();
    setCamera(false);
    var rect = viewport.getBoundingClientRect();
    var pointerX = view.x + (event.clientX - rect.left) / rect.width * view.w;
    var pointerY = view.y + (event.clientY - rect.top) / rect.height * view.h;
    var factor = event.deltaY > 0 ? 1.12 : 0.89;
    var nextW = Math.max(320, Math.min(2800, view.w * factor));
    var ratio = nextW / view.w;
    var nextH = view.h * ratio;
    view.x = pointerX - (pointerX - view.x) * ratio;
    view.y = pointerY - (pointerY - view.y) * ratio;
    view.w = nextW; view.h = nextH;
    svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h);
    el.zoom.textContent = Math.round(2400 / view.w * 100) + '%';
  }, { passive: false });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeInspector();
    if (el.inspector.classList.contains('open')) return;
    if (event.target.matches('input, select, button, a')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); stopPlay(); renderStep(state.step + 1, { animate: true }); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); stopPlay(); renderStep(state.step - 1, { animate: true }); }
    if (event.key === ' ') { event.preventDefault(); togglePlay(); }
  });

  moveToken(steps[0].pos, false, 0, false);
  renderStep(0, { animate: false, camera: false });
  setView(fullView, false);
})();

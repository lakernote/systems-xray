# Kafka 外部课程学习与本项目改造记录

## 调研范围

- Bilibili「码上加薪」[公开系列《动画讲解 Kafka 运行原理》](https://www.bilibili.com/video/BV1ds4y1h7zn/)：检查了 60 个公开视频的完整标题与主题分布。
- Bilibili 公开可见的[付费课程目录《码上加薪用动画+文档讲解 Kafka 原理和面试题》](https://www.bilibili.com/cheese/play/ep626070)：检查了 179 节目录与 7 个章节结构；未绕过付费内容。
- FreeGeekTime [《Kafka 核心技术与实战》](https://freegeektime.com/posts/100029201/)：检查课程目录，并重点对照分区、可靠性、Offset、Rebalance、副本、Controller 与调优主题。
- FreeGeekTime [《消息队列高手课》](https://freegeektime.com/posts/100032301/)：检查课程目录，并重点对照不丢、去重、积压、高性能 I/O、Page Cache、Consumer 和副本实现主题。
- 技术事实最终回到 Apache Kafka 4.1 官方设计、配置、Javadoc 与 Apache Kafka 源码核对。

## 借鉴的是讲法，不是页面外观

这些课程更容易理解，主要不是因为“图更多”，而是因为它们反复使用下面的教学节奏：

1. 先抛生产问题：丢了怎么办、重复怎么办、积压怎么办、为什么很快。
2. 用一个具体数字或故障建立冲突，例如 ISR 从 3 变 1、处理速率低于到达速率。
3. 只引入解决当前冲突所需的一个机制，不同时堆满所有名词。
4. 展示前状态、触发条件、后状态和失败分支。
5. 最后才落配置，并说清“调大以后得到什么、失去什么”。
6. 用一个可验证的问题收尾，而不是用定义收尾。

## 本项目采用的页面语法

每页优先回答一个问题，并至少包含以下四项中的三项：

- 数据或所有权状态从什么变成什么。
- 哪个组件做出决定，哪个组件只执行或保存。
- 成功、超时和崩溃分别落在哪个状态。
- 一个核心配置改变哪条边界，以及对应代价。

图形按语义选择：

- 路径：横向箭头和移动的 `#A1024`。
- 生命周期：Before → Trigger → After 时间线。
- 控制面：蓝色元数据路径；数据面继续用橙色。
- 速率/延迟：阶段化方程，不使用无意义组件卡片。
- 设计总览：蓝图页只保留机制、伪代码和取舍。

## 对照后发现的旧课程问题

- 开场直接进入 Event，没有先回答“为什么需要 Kafka”。
- Retention、Compaction、Tombstone 挤在一页，无法看出更新与删除的时间差。
- `acks=all` 只讲等待结果，没有解释 Broker 怎样等待而不阻塞 Handler。
- Leader Failover 只讲结果，没有说明 KRaft 控制面怎样提交和传播新元数据。
- 事务只讲 LSO，缺少 Coordinator、Marker 与 Offset 原子提交。
- Lag 只有差值，没有输入速率、处理速率与安全 Commit 速率。
- pause/resume 有了，但缺少并发 Worker 的连续完成水位。
- 高性能总结有组件，没有统一端到端延迟预算。

## 本轮取舍

课程继续聚焦“一条消息从产生到消费和恢复”，不会把 179 节目录全塞进主线。Connect、Streams、完整 Raft、跨集群和完整运维体系将作为独立课程；本轮只把直接解释当前数据路径的 KRaft 控制面、Purgatory、Compaction CRUD、事务和积压并发补进来。

## 技术事实来源

- [Apache Kafka 4.1 Design](https://kafka.apache.org/41/design/design/)
- [Apache Kafka 4.1 Topic Configs](https://kafka.apache.org/41/configuration/topic-configs/)
- [Apache Kafka 4.1 Consumer Javadoc](https://kafka.apache.org/41/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html)
- [Apache Kafka KRaft 与 ZooKeeper 差异](https://kafka.apache.org/41/getting-started/zk2kraft/)
- [Apache Kafka ReplicaManager / DelayedOperationPurgatory 调用路径](https://github.com/apache/kafka/blob/trunk/core/src/main/scala/kafka/server/ReplicaManager.scala)

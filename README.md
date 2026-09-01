# Systems X-Ray

> See how software works from the inside. 进入系统内部，看见一条数据为什么这样流动。

Systems X-Ray 是一组面向生产开发者的交互式 Web 课件。每门课只追踪一个具体对象，把逻辑 API 一路落到进程、线程、内存、协议、文件、副本、可见性与故障恢复。

**在线学习：<https://lakernote.github.io/systems-xray/>**

## 课程

| 课程 | 追踪对象 | 主线 | 页数 |
|---|---|---|---:|
| [Kafka](./kafka/) | `Event #A1024` | Producer → Broker → Segment → Consumer | 66 |
| [OpenSearch](./opensearch/) | `Document #D2048` | CRUD → Lucene → Search → Vector | 55 |
| [Redis](./redis/) | `Key session:user:9527` | RESP → Dict → AOF → Cluster | 55 |
| [PostgreSQL](./postgresql/) | `Row orders.id=A1024` | Planner → Heap → MVCC → WAL | 65 |

四门课都是纯静态 HTML/CSS/JavaScript：没有框架、没有构建步骤，打开即可学习，也可以直接发布到 GitHub Pages。

## 教学方法

每门课遵守同一套课程契约：

1. **先给全景地图**：说明系统边界、物理节点和本课程的唯一主角。
2. **一页只回答一个问题**：先讲发生了什么，再解释为什么这样设计。
3. **显示状态变化**：能动态表达时，展示 `Before → Current → After`，而不是堆静态文字。
4. **逻辑 API 必须落到物理实现**：代码最终要对应线程、Buffer、Socket、Page、Segment、WAL 等真实结构。
5. **把收益和代价放在一起**：性能、高可用、一致性、容量与故障不能拆开讲。
6. **一页讲不清就拆页**：不缩字、不塞满、不在主课件里制造滚动条。

完整规范见 [课程编写规范](./docs/course-authoring.md)。

## 目录结构

```text
systems-xray/
├── index.html                 # 单屏课程目录
├── assets/                    # 首页与品牌公共资产
├── kafka/                     # 每门课程自包含：HTML / CSS / 数据 / 交互
├── opensearch/
├── redis/
├── postgresql/
├── docs/                      # 编写规范、审查记录与原理图
└── archive/                   # 不参与当前课程入口的历史实验
```

详细约定见 [仓库结构说明](./docs/repository-structure.md)。Kafka 的逐页技术审查记录见 [Kafka 内容审查](./docs/kafka-content-review.md)。

## 本地预览

```bash
python3 -m http.server 8080
```

打开 <http://localhost:8080/>。课程支持：

- `←` / `→`：上一页、下一页
- `N`：展开当前页补充讲义
- `O`：打开课程目录
- `Esc`：关闭讲义或目录
- Hash 深链接：例如 `kafka/#slide-32`

## 新增课程

新课程使用独立目录，最小结构如下：

```text
new-topic/
├── index.html
├── styles.css
├── course.js       # 页面内容和课程顺序
├── app.js          # 翻页、Hash、目录和交互
└── visuals.js      # 可选：复杂原理图与状态动画
```

新增前请先阅读 [课程编写规范](./docs/course-authoring.md)，并从“追踪什么具体对象”和“最终要回答哪些生产问题”开始，而不是先堆知识点。

## 发布

仓库根目录包含 `.nojekyll`，可以直接使用 GitHub Pages 的 `main / (root)` 发布方式。所有链接均为相对路径，支持项目站点路径 `/systems-xray/`。

## License

[MIT](./LICENSE)

# Systems X-Ray

> See how software works from the inside. 进入系统内部，看见一条数据为什么这样流动。

Systems X-Ray 是一组面向生产开发者的交互式 Web 课件。每门课只追踪一个具体对象，把 CRUD / 读写请求沿真实数据路径展开，解释关键状态、存储、复制、可见性与故障恢复。

**在线学习：<https://lakernote.github.io/systems-xray/>**

## 课程

| 课程 | 追踪对象 | 主线 | 页数 |
|---|---|---|---:|
| [Kafka](./kafka/) | `Event #A1024` | Produce → Append → Fetch → Commit | 77 |
| [OpenSearch](./opensearch/) | `Document #D2048` | CRUD → Lucene → Search → Vector | 55 |
| [Redis](./redis/) | `Key session:user:9527` | CRUD → Dict → Persistence → Cluster | 55 |
| [PostgreSQL](./postgresql/) | `Row orders.id=A1024` | CRUD → Planner → MVCC → WAL | 65 |

四门课都是纯静态 HTML/CSS/JavaScript：没有框架、没有构建步骤，打开即可学习，也可以直接发布到 GitHub Pages。

## 教学方法

每门课遵守同一套课程契约：

1. **先给全景地图**：说明 CRUD / 读写主线、关键系统边界和本课程的唯一主角。
2. **一页只回答一个问题**：先讲发生了什么，再解释为什么这样设计。
3. **显示状态变化**：能动态表达时，展示 `Before → Current → After`，而不是堆静态文字。
4. **CRUD 必须落到真实机制**：讲清路由、状态变化、ACK、可见性与清理；线程、Buffer、Segment、WAL 等结构按解释需要展开。
5. **把收益和代价放在一起**：性能、高可用、一致性、容量与故障不能拆开讲。
6. **一页讲不清就拆页**：不缩字、不塞满、不在主课件里制造滚动条。
7. **统一用生产问题收尾**：CRUD、性能、高可用、一致性、配置取舍与跨系统比较。

完整规范见 [课程编写规范](./docs/course-authoring.md)。

仓库内还提供项目级 Codex Skill：[`systems-xray-course-builder`](./.agents/skills/systems-xray-course-builder/SKILL.md)。后续新增课程、重排讲解、画原理图或做逐页审查时，可显式使用 `$systems-xray-course-builder`，让教学结构、图形语法、桌面 UI 与技术审查遵守同一套标准。

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
├── .agents/skills/            # 本项目的课件设计与审查 Skill
└── archive/                   # 不参与当前课程入口的历史实验
```

详细约定见 [仓库结构说明](./docs/repository-structure.md)。Kafka 的技术审查见 [Kafka 内容审查](./docs/kafka-content-review.md)，外部课程对照与本轮教学改造见 [Kafka 学习与改造记录](./docs/kafka-learning-review.md)。

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

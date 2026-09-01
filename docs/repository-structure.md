# 仓库结构说明

## 发布层

| 路径 | 作用 |
|---|---|
| `/index.html` | GitHub Pages 单屏课程目录 |
| `/assets/` | 首页样式、交互和 Systems X-Ray 品牌图标 |
| `/.nojekyll` | 告诉 GitHub Pages 按原始静态文件发布 |

根目录只保留发布入口和仓库级文件，不放某一门课程的实现资产。

## 课程层

每门课程使用一级稳定路径：

```text
/kafka/
/opensearch/
/redis/
/postgresql/
```

课程目录应尽量自包含：

| 文件 | 职责 |
|---|---|
| `index.html` | 课程壳、顶栏、主画布、补充面板和翻页区 |
| `styles.css` | 课程布局和公共视觉语言 |
| `course.js` | 页面顺序、讲义、配置、取舍与伪代码 |
| `app.js` | 渲染、翻页、Hash、目录和键盘交互 |
| `visuals.js` | 可选；复杂物理图或独立状态动画 |
| `*-visuals.css/js` | 可选；仅在视觉实现过大时拆分 |

课程可以复用 `/assets/course-shell.css` 中的通用课件框架，但不能跨目录引用另一门课程的课程数据、样式或运行脚本。每门课的配色与专用图形仍留在自己的目录中。

## 文档层

`/docs/` 保存不会直接出现在课件主线中的维护资料：

- `course-authoring.md`：所有课程共同遵守的编写规范。
- `repository-structure.md`：目录和文件职责。
- `kafka-content-review.md`：Kafka 逐页技术审查。
- `diagrams/`：可编辑的原理图源文件。

## 历史层

`/archive/` 保存探索期原型，只用于回看设计过程：

- 不进入课程首页。
- 不作为新增课程模板。
- 可以运行，但不要求跟随当前课程框架持续维护。

## URL 约定

- 首页：`/systems-xray/`
- 课程：`/systems-xray/kafka/`
- 页面深链接：`/systems-xray/kafka/#slide-32`
- 所有站内链接必须使用相对路径，确保本地预览与 GitHub Pages 项目站点同时可用。

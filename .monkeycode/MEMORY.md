# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目
用户指令条目应遵循以下格式：

[用户指令摘要]
- Date: [YYYY-MM-DD]
- Context: [提及的场景或时间]
- Instructions:
  - [用户教导或指示的内容，逐行描述]

### 项目知识条目
Agent 在任务执行过程中发现的条目应遵循以下格式：

[项目知识摘要]
- Date: [YYYY-MM-DD]
- Context: Agent 在执行 [具体任务描述] 时发现
- Category: [代码结构|代码模式|代码生成|构建方法|测试方法|依赖关系|环境配置]
- Instructions:
  - [具体的知识点，逐行描述]

## 去重策略
- 添加新条目前，检查是否存在相似或相同的指令
- 若发现重复，跳过新条目或与已有条目合并
- 合并时，更新上下文或日期信息
- 这有助于避免冗余条目，保持记忆文件整洁

## 条目

[红楼梦图谱项目核心规范]
- Date: 2026-04-29
- Context: Agent 阅读 `.github/copilot-instructions.md` 后记录
- Category: 代码结构
- Instructions:
  - 项目是知识图谱系统（Knowledge Graph）+ 人物驱动网络（Person-Centric Network）+ 可探索型产品（Explorable Product）。
  - 纯前端零构建项目：HTML5 + CSS3 + 原生 JavaScript + D3.js v7，部署于 Cloudflare Pages。
  - 技术约束：不引入 React/Vue/Svelte 等框架；所有 JS 通过 `<script>` 标签直接加载；CSS 只有 `style.css`。
  - FacetStore 是唯一跨视图状态源；视图切换时不得将上一视图的隐式筛选条件带入新视图。
  - 数据修改必须保持双向一致性：新增人物须同步添加核心关系到 `relationships.json`；source/target id 必须在 `characters.json` 中存在；新增知识条目时 `relatedCharacters` 中的 id 必须存在。
  - JSON 数据修改后必须用 `python3 -m json.tool data/<file>.json > /dev/null` 验证合法性。
  - 交付前必须检查四个视图（图谱、家族谱系、人物名录、知识库）是否均正常。
  - 涉及红楼梦原著内容时必须以原著文本为唯一依据，不确定时标注"待校验"而非猜测；区分前80回与后40回差异，明确标注出处。
  - 禁止编造不存在的人物、关系或情节；禁止将续书内容混入前80回不做标注；禁止引入影视改编内容。
  - 本地开发：`python3 -m http.server 8080` 或 `npx serve .`，必须通过 HTTP 服务器访问。
  - 测试验证：修改 JS 后在 DevTools Console 确认无运行时错误；数据修改后验证 JSON 合法性。

[红楼梦图谱数据模型]
- Date: 2026-04-29
- Context: Agent 在执行数据冗余、完整性与准确性检查时发现
- Category: 代码结构
- Instructions:
  - 项目核心数据位于 `data/characters.json`、`data/relationships.json`、`data/knowledge.json`，分别保存人物、关系边和知识库条目。
  - `characters.json` 使用 `id` 作为主键，并通过 `parentIds`、`childrenIds`、`spouseIds` 表示族谱关系。
  - `relationships.json` 的 `source`、`target` 必须引用人物 `id`，关系类型包括 `blood`、`marriage`、`master_servant`、`romance`、`social`、`rivalry`。
  - `knowledge.json` 的 `relatedCharacters` 必须引用人物 `id`，空的 `relatedEvents` 在当前前端实现中可作为空数组处理，不应简单视为 JSON 完整性错误。

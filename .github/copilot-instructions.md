# Copilot Instructions — 红楼梦 · 知识探索工具

## 项目概述

这是一个《红楼梦》交互式知识探索工具，包含四个视图：关系图谱（D3.js 力导向图）、家族谱系、人物名录、知识库（诗词/判词/典故等）。纯前端项目：HTML5 + CSS3 + 原生 JavaScript + D3.js v7，部署于 Cloudflare Pages。


该项目不是普通前端项目，而是：

👉 知识图谱系统（Knowledge Graph System）
👉 人物驱动的信息网络（Person-Centric Network）
👉 可探索型产品（Explorable Product）

所有设计必须服务于：
- 信息结构清晰
- 关系可追溯
- 知识可连接
- 用户可探索



## ⚡ 核心工作原则（MUST 遵守）

### 原则 1：原著准确性优先，拒绝猜测

**强制规则**：涉及红楼梦人物、关系、诗词、情节等内容时，MUST 以原著文本为唯一依据。

- ❌ MUST NOT 凭记忆填写诗词原文、人物关系或章回情节
- ❌ MUST NOT 将影视改编、民间传说混入数据
- ✅ 不确定时标注"待校验"，宁可留空不可填错
- ✅ 涉及前 80 回与后 40 回差异时，MUST 明确标注出处

**原因**：这是知识图谱系统，一处错误数据会通过关系网络传播，误导所有关联的探索路径。

### 原则 2：先读代码，再动手

**强制规则**：修改任何文件前，MUST 先阅读该文件及其关联文件的现有实现。

- ✅ MUST 理解目标类/函数的现有模式（构造函数、`render()`、事件绑定方式）再编写代码
- ✅ MUST 检查 `app.js` 中对该视图的调用方式和生命周期
- ✅ 涉及 D3.js 时，MUST 查阅 `graph.js` 中现有的 D3 用法，保持一致
- ❌ MUST NOT 引入现有代码中未使用的模式（如 ES modules、async/await 模式不匹配等）

**原因**：零框架项目没有脚手架约束，全靠约定保持一致。不读代码就改，极易破坏现有模式。

### 原则 3：数据文件双向一致性

**强制规则**：修改 `data/` 目录下任何 JSON 文件时，MUST 确保跨文件引用完整。

检查清单：
- ✅ 新增人物 → 同步添加其核心关系到 `relationships.json`
- ✅ 新增关系 → 确认 `source` 和 `target` 的 id 在 `characters.json` 中存在
- ✅ 新增知识条目 → 确认 `relatedCharacters` 中的 id 在 `characters.json` 中存在
- ✅ 修改人物 id → 全局搜索该 id，同步更新 `relationships.json`、`knowledge.json`、`app.js` 中的引用
- ✅ 修改完成后执行 `python3 -m json.tool data/<file>.json > /dev/null` 验证 JSON 合法性

### 原则 4：跨视图影响分析

**强制规则**：本项目有四个视图共享数据和 `FacetStore` 状态，任何修改都 MUST 评估对所有视图的影响。

逐项确认（交付前）：
- [ ] **图谱视图**：节点/连线渲染、聚焦模式、拖拽交互是否正常
- [ ] **家族谱系**：树形层级、家族切换、辈分展示是否正确
- [ ] **人物名录**：卡片/紧凑视图、排序筛选是否正常
- [ ] **知识库**：分类检索、关联人物高亮是否正确
- [ ] **FacetStore**：状态变更是否遵守跨视图隔离规则（不带入隐式筛选条件）
- [ ] **侧边栏/搜索**：全局搜索、专题入口、阅读阶段是否受影响
- [ ] **人物卡片弹窗**：点击人物后的详情展示是否正常

**MUST NOT**：
- ❌ 只验证当前修改的视图就交付
- ❌ 假设"其他视图不受影响"而不做检查

### 原则 5：交付前验证

**强制规则**：返回用户之前 MUST 执行以下验证，发现问题 MUST 修正后再交付。

验证清单：
- ✅ **JSON 合法性**：修改数据文件后执行 `python3 -m json.tool data/<file>.json > /dev/null`
- ✅ **JS 语法**：确认无明显语法错误（未闭合括号、缺少逗号、变量未定义等）
- ✅ **`<script>` 加载顺序**：新增 JS 文件时，确认在 `index.html` 中按依赖顺序添加
- ✅ **CSS 类名一致性**：新增 HTML 元素使用的 class 在 `style.css` 中存在对应样式
- ✅ **全局变量/类名冲突**：零构建项目所有 JS 共享全局作用域，确认不引入命名冲突
- ✅ **浏览器兼容性**：不使用过新的 Web API（项目目标为现代浏览器，但不依赖最前沿特性）


## 架构与代码约定

### 文件职责

| 文件 | 职责 |
|---|---|
| `app.js` | 主应用入口，路由/视图切换、侧边栏、搜索、专题/阶段、人物对比 |
| `graph.js` | `RelationshipGraph` 类 — D3 力导向图、聚焦模式、缩放拖拽 |
| `tree-view.js` | `TreeView` — 家族谱系树形视图 |
| `list-view.js` | `ListView` — 人物名录卡片/紧凑列表 |
| `knowledge-view.js` | `KnowledgeView` — 知识库分类检索 |
| `facet-store.js` | `FacetStore` — 跨视图全局状态管理（发布/订阅模式） |
| `style.css` | 全局样式，中国古典美学（红木色调、水墨元素、Noto Serif SC） |

### 跨视图状态（FacetStore）

- `FacetStore` 是唯一的跨视图状态源，所有视图通过 `subscribe` / `update` 与之通信。
- 顶层视图切换时 **不得** 将上一视图的隐式筛选条件（如 `currentFamily`、`selectedChapter`）带入新视图。
- `selectedCharacterIds` 仅用于高亮提示，**不得** 用于覆盖列表/树/知识库的过滤状态。
- 隐式阅读动作（打开人物卡片）应保持本地；显式筛选条件必须在当前视图 UI 中可见。

### 数据结构

- `characters.json` — 人物数据（id/name/pinyin/alias/family/group/identity/importance/personality/keyEvents/quotes/chapters/description）
- `relationships.json` — 关系数据（source/target/type/label/description）；type 枚举：`blood | marriage | master_servant | romance | social | rivalry`
- `knowledge.json` — 知识条目（id/type/title/content/chapter/relatedCharacters/relatedEvents/tags/analysis/category）

## 红楼梦领域知识准则

> **数据准确性比数据广度更重要。不能出现错误。**

### MUST — 必须遵守

- 人物姓名、别名、辈分、家族归属必须与原著一致；拿不准时标注"待校验"而非猜测。
- 判词、曲词、诗词原文必须逐字核对原著，不得凭记忆补全。
- 人物关系 `type` 和 `label` 必须准确反映原著关系，例如：贾政与宝玉是 `blood`/父子，不是 `social`。
- 章回编号必须使用通行 120 回本的标准编号。
- 新增/修改 `characters.json` 或 `relationships.json` 时必须保持双向一致性：若添加人物，需同步添加其核心关系；若添加关系，source 和 target 必须在 characters 中存在。

### MUST NOT — 绝对禁止

- 禁止编造原著中不存在的人物、关系或情节。
- 禁止将续书（后 40 回）独有内容混入前 80 回场景描述而不做标注。
- 禁止将影视剧改编内容当作原著内容。
- 禁止在不确定时给出"大概""好像"的数据——宁可留空，不可填错。

### 常见易错点

- 贾家"玉"字辈：宝玉、贾琏、贾珠、贾环、贾琮——注意区分嫡出/庶出。
- 贾敏是贾母之女、林黛玉之母，属贾家人，嫁入林家。
- 薛宝琴与薛宝钗是堂姐妹，非亲姐妹。
- 平儿是王熙凤的陪嫁丫鬟兼通房，不是正妻。
- 秦可卿身份存疑（养生堂弃婴 / 废太子之女），描述时应注明争议。

## 设计与交互原则

> **好的设计不需要引导，用户自己会操作。**

### MUST — 必须遵守

- 所有交互元素必须有明确的视觉可供性（affordance）：可点击的看起来可点击，可拖拽的看起来可拖拽。
- 操作结果必须有即时的视觉反馈（hover 态、active 态、选中高亮、过渡动画）。
- 不得添加新手引导弹窗、tooltip 教程、步骤向导等"教用户怎么用"的 UI。
- 功能入口必须自解释：通过图标 + 短文案、空状态提示等方式让用户自然发现。
- 保持视觉层次清晰：主要操作突出，次要操作收纳（参照侧边栏 `<details>` 折叠模式）。

### MUST NOT — 绝对禁止

- 禁止添加 onboarding tour / coach mark / 功能引导蒙层。
- 禁止用 `alert()` / `confirm()` 打断用户操作流。
- 禁止隐藏功能在无提示的手势或快捷键背后（除非同时有可见入口）。

### 风格保持

- 配色使用现有古典色调体系（红木 `#C0392B`、墨灰、宣纸白），不引入现代荧光色或 Material/Fluent 风格。
- 字体优先级：Noto Serif SC → Noto Serif Traditional Chinese → ZCOOL XiaoWei → 系统衬线。
- 新增 UI 组件需与现有 `style.css` 设计语言一致，不引入新的 CSS 框架或组件库。

## 技术约束

- **零构建**：无打包工具、无编译步骤。所有 JS 文件通过 `<script>` 标签直接加载。
- **零框架**：不引入 React/Vue/Svelte 等框架，保持原生 JS。
- **D3.js v7**：图谱渲染唯一依赖，通过 CDN `<script>` 引入。
- 新 JS 文件必须在 `index.html` 中按依赖顺序添加 `<script>` 标签。
- CSS 只有一个 `style.css`，不使用预处理器。
- 部署目标为 Cloudflare Pages 静态资源（`wrangler.jsonc` 配置 `assets.directory: "."`），不依赖 Workers 运行时或服务端逻辑。

## 本地开发

```bash
# 启动本地服务器（任选一种）
python3 -m http.server 8080
npx serve .

# 访问
open http://localhost:8080
```

> 必须通过 HTTP 服务器访问，直接打开 HTML 会触发 CORS 限制（fetch JSON）。

## 测试与验证

- 修改数据文件后，手动验证 JSON 格式合法性：`python3 -m json.tool data/characters.json > /dev/null`。
- 修改 JS 后，在浏览器 DevTools Console 确认无运行时错误。
- 视觉变更可用 Playwright 截图辅助验证：`npx playwright screenshot --device="Desktop Chrome" "http://localhost:8080" /tmp/screenshot.png`。

## MCP Chrome DevTools 使用注意

若 MCP 返回浏览器实例冲突（如提示 `chrome-profile` 已被占用）：

1. **MUST** 先清理 DevTools MCP 专用 Chrome 进程，再重新打开页面。
2. 查找进程：
   ```bash
   ps -ax -o pid=,command= | grep -E 'chrome-devtools-mcp|chrome-profile' | grep -v grep
   ```
3. 确认后清理（注意`{USER}`要换成当前系统用户名）：
   ```bash
   pkill -f '/Users/{USER}/.cache/chrome-devtools-mcp/chrome-profile'
   ```
4. **MUST NOT** 误杀用户正常使用的 Chrome 进程，只处理 `chrome-devtools-mcp/chrome-profile` 对应的调试实例。

### 如果 MCP 浏览器实例冲突。

- 仅清理 `chrome-devtools-mcp/chrome-profile` 对应进程
- 不要误杀用户正常 Chrome
- 如果遇到提示：`Use --isolated to run multiple browser instances` 或 `` Use a different `userDataDir` or stop the running browser first ``。解决方案 1：杀掉旧进程；解决方案 2(慎用)：删缓存目录`rm -rf ~/.cache/chrome-devtools-mcp`
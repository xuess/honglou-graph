# 《红楼梦》人物关系图谱 - 交互式可视化网页应用

## 项目简介

本项目是一个精美的《红楼梦》人物关系图谱交互式网页应用，采用 D3.js 力导向图技术，完整收录了贾、史、王、薛四大家族以及其他重要角色的复杂人物关系。

### 主要特性

- **丰富的人物数据**：收录 125 位人物、208 条关系、597 条知识条目（判词、诗词、回目、名场面、生僻字、器物、建筑等）
- **多维度关系**：支持血缘、婚姻、主仆、情感、社交、敌对六类关系
- **力导向图谱**：基于 D3.js 的交互式力导向图，支持拖拽、缩放、按章回时间轴回放
- **人物信息卡片**：点击人物查看详细信息，包括别名、身份、性格、事迹、语录、命运线等
- **搜索与筛选**：每个视图各有独立检索框，`Cmd/Ctrl+K` 或 `/` 直接聚焦当前视图搜索
- **聚焦模式**：双击人物可聚焦查看其直接关系网络
- **五个视图**：关系图谱、家族谱系、人物名录、回目视图、知识库
- **中国古典美学**：红木色调、水墨元素、古典字体
- **响应式设计**：兼容桌面端和移动端

## 技术栈

- **可视化引擎**：D3.js v7
- **前端**：HTML5 + CSS3 + 原生 JavaScript
- **设计风格**：中国古典美学 + 响应式布局
- **数据格式**：JSON 结构化存储

## 项目结构

```
honglou-graph/
├── index.html            # 主页面（五视图 + 弹层 + 脚本加载顺序）
├── css/
│   ├── fonts.css         # @font-face，指向 assets/fonts/subset/*.woff2
│   ├── display-font.css  # 装饰标题字体，非阻塞加载
│   └── style.css         # 全局样式（古典美学风格）
├── js/
│   ├── app.js            # 主应用：路由、搜索、侧边栏、人物卡、专题/阶段
│   ├── graph.js          # RelationshipGraph：D3 力导向图、聚焦、缩放、时间轴
│   ├── tree-view.js      # TreeView：家族谱系
│   ├── list-view.js      # ListView：人物名录
│   ├── chapter-view.js   # ChapterView：回目视图
│   ├── knowledge-view.js # KnowledgeView：知识库检索
│   ├── facet-store.js    # FacetStore：跨视图状态
│   ├── text-layout.js    # 文本排版（vendor/pretext）
│   ├── audio-preload-cache.js / edge-tts.js  # 朗读
│   └── fuse.min.mjs      # 本地化的模糊检索库
├── data/
│   ├── characters.json   # 人物数据
│   ├── relationships.json # 关系数据
│   ├── knowledge.json    # 知识条目
│   ├── appearances.json  # 人物—回目出场/名场面索引
│   ├── events.json       # 规范化事件索引
│   ├── places.json       # 规范化地点索引
│   └── provenance.json   # 来源与审计队列（校验脚本依赖）
├── scripts/
│   ├── validate-data.mjs        # 数据校验
│   ├── build-appearances.mjs    # 从人物回目与 scene/entrance 生成出场索引
│   ├── build-taxonomy.mjs       # 从 relatedEvents/relatedPlaces 生成事件地点索引
│   ├── stamp-assets.mjs         # 资源版本号（内容哈希）
│   ├── sync-chapter-titles.mjs  # 回目标题同步校验
│   ├── check-audio.mjs          # 预生成语音与文案一致性校验
│   └── subset-fonts.py          # 字体子集化（TTF → WOFF2）
├── assets/fonts/         # 完整 TTF（源文件）与 subset/（实际加载的 WOFF2）
├── test-hlm.mjs          # 回归/数据完整性测试
├── test-scenarios.mjs    # 跨视图场景链路测试
├── test-ux.mjs           # 交互、无障碍与资源加载测试
├── test-data-trust.mjs   # 引语/结局/续书边界、人物关系与回目人物可信度测试
└── audio/                # 朗读音频
```

## 本地运行

### 方法一：使用 Python 内置服务器

```bash
cd honglou-graph
python3 -m http.server 8080
```

然后打开浏览器访问 `http://localhost:8080`

### 方法二：使用 Node.js

```bash
npx serve .
```

> **注意**：由于使用了 `fetch` 加载 JSON 数据，直接双击打开 HTML 文件会遇到跨域限制，必须通过 HTTP 服务器访问。

## 常用脚本

```bash
npm run validate:data   # 校验人物/关系/知识/出场索引的结构与来源范围
npm run build:appearances # 更新人物出场索引（人物章节 + 名场面/人物出场）
npm run build:taxonomy    # 更新事件/地点索引与 knowledge 的 eventIds/placeIds
npm run stamp           # 改动 js/css 后刷新 index.html 的资源版本号（内容哈希）
npm run check:assets    # 校验资源版本号是否与内容一致
npm run check:chapters  # 校验人物回目与 knowledge.json 的章回标题一致
npm run check:audio     # 校验预生成语音是否存在、文案是否已过期
npm run subset:fonts    # 数据或文案新增字符后重建 WOFF2 子集（需 fonttools + brotli）
npm test                # 启动/复用本地服务器并跑全部数据与浏览器回归
npm run test:data       # 只跑来源目录与数据结构校验
npm run test:regression # 只跑核心回归
npm run test:scenarios  # 只跑跨视图场景链路
npm run test:ux         # 只跑交互、无障碍与资源加载
npm run test:trust      # 只跑数据可信度（引语/结局/续书/回目人物）
```

浏览器测试依赖 Playwright（`npm install` 后自动可用）。若当前检出版本没有 `node_modules`，可复用已有环境：

```bash
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright npm test
```

`subset:fonts` 调用项目内的 `.venv/bin/python`，首次使用时先建环境：

```bash
python3 -m venv .venv
.venv/bin/pip install fonttools brotli
```

## 部署到 Cloudflare Pages

`wrangler.jsonc` 已配置 `assets.directory: "."`，推送到 `main` 分支即自动部署静态资源，无需构建步骤。

> 修改 `js/` 或 `css/` 后务必运行 `npm run stamp`：版本号是内容哈希，缓存靠它失效。

> 修改 `knowledge.json` 的 `content` 后运行 `npm run check:audio`。清单里的 `textHash` 对应生成音频时的文案，不一致的条目会回退实时 TTS，并需要重新生成语音。

## 数据模型

### 人物数据结构 (characters.json)

```json
{
  "id": "jia_baoyu",
  "name": "贾宝玉",
  "alias": ["宝二爷", "怡红公子", "绛洞花主", "富贵闲人"],
  "gender": "男",
  "family": "贾家",
  "group": "贾家-玉字辈",
  "identity": "荣国府衔玉而生的公子",
  "importance": 5,
  "personality": "多情、叛逆、厌恶仕途经济、尊重女性",
  "keyEvents": ["衔玉而生", "神游太虚幻境", "共读西厢", "雀金裘"],
  "keyEventVersions": ["original", "original", "original", "original"],
  "chapters": [
    { "chapter": 3, "title": "接外孙贾母惜孤女", "summary": "...", "version": "original" }
  ],
  "quotes": ["女儿是水作的骨肉，男人是泥作的骨肉"],
  "quoteSources": [
    { "sourceId": "jiaxu-wikisource", "edition": "甲戌本", "chapter": 2, "locator": "第2回..." }
  ],
  "quoteComparisons": [],
  "quotesPendingVerified": [],
  "outcomeSourceCandidates": [],
  "description": "贾政与王夫人之次子..."
}
```

`chapters[].version` 与 `keyEventVersions` 区分 `original`（前八十回）和 `continuation`（后四十回续书）。引语、结局的展示规则见 `data/SOURCES.md`。

### 关系数据结构 (relationships.json)

```json
{
  "source": "jia_baoyu",
  "target": "lin_daiyu",
  "type": "romance",
  "label": "恋人",
  "description": "木石前盟，今生知己",
  "evidence": [
    {
      "chapter": 3,
      "version": "前八十回",
      "title": "接外孙贾母惜孤女",
      "scene": "宝黛初会",
      "summary": "黛玉进贾府，与宝玉初见，宝玉因她无玉而摔玉。",
      "status": "chapter"
    }
  ]
}
```

`evidence` 为可选字段：用于关系考据卡，按回目列出情节依据。`version` 区分“前八十回 / 后四十回续书 / 通篇”，`status: "chapter"` 表示当前只定位到回目与情节梗概，原文异文与版本差异待逐条校勘。

### 出场索引 (appearances.json)

```json
{
  "characterId": "lin_daiyu",
  "chapter": 34,
  "roles": ["scene"],
  "sources": ["knowledge:scene"],
  "title": "黛玉题帕诗",
  "summary": "宝玉挨打后遣晴雯送帕，黛玉在帕上题诗。",
  "version": "original"
}
```

出场索引只从人物关键回目和 `scene`/`entrance` 知识生成，不从主题、人物专题、典故等跨回目内容反推。运行 `npm run build:appearances` 重建。

### 事件/地点索引 (events.json / places.json)

`relatedEvents`、`relatedPlaces` 中的自由文本会归并为稳定 ID，并写回每条知识的 `eventIds` / `placeIds`：

```json
{
  "id": "event_yuanfei_shengqin",
  "title": "元妃省亲",
  "aliases": ["元春省亲"],
  "chapters": [18],
  "knowledgeIds": ["scene_yuanfei_shengqin", "..."],
  "characterIds": ["jia_yuanchun", "..."]
}
```

运行 `npm run build:taxonomy` 重建；知识卡上的事件/地点标签可直接点击检索。

### 关系类型

| 类型 | 英文标识 | 连线颜色 | 说明 |
|------|----------|----------|------|
| 血缘 | blood | #4A6B8A 蓝灰 | 父子、母女、兄弟姐妹、祖孙等 |
| 婚姻 | marriage | #B83232 红 | 夫妻、通房、妾室等 |
| 主仆 | master_servant | #95A5A6 灰 | 主人与丫鬟/仆人 |
| 情感 | romance | #C75B6E 粉红（虚线） | 恋人、暧昧、情愫 |
| 社交 | social | #C49A2A 赭黄（虚线） | 朋友、同窗、结拜等 |
| 敌对 | rivalry | #8E44AD 紫（点线） | 对手、仇敌、冲突 |

## 交互说明

- **拖拽节点**：按住人物节点可拖动调整位置
- **缩放画布**：鼠标滚轮或触摸板双指缩放
- **查看详情**：单击人物节点弹出信息卡片
- **查看关系考据**：单击连线打开关系卡，查看关系说明、回目依据，并可直接跳转对应回目
- **聚焦模式**：双击人物节点进入聚焦模式，仅显示相关人物
- **搜索**：`Cmd/Ctrl+K` 或 `/` 聚焦当前视图的搜索框，输入姓名、别名、回目或知识关键词
- **筛选关系**：使用侧边栏按家族或关系类型筛选显示
- **显示全部**：点击"显示全部"按钮恢复所有人物关系网
- **键盘**：`1`–`5` 切换视图，`Esc` 逐层关闭弹层，`?` 查看快捷键

## 浏览器兼容性

- Chrome 90+
- Edge 90+
- Firefox 90+
- Safari 15+

> 代码使用 `replaceChildren`、`ResizeObserver`、`?.`/`??`、动态 `import()` 与顶层 `await`（模块脚本），
> Safari 13/14 不支持 `replaceChildren`，不足以运行本项目。

## 许可证

本项目仅供学习和研究使用。人物数据来源于古典文学名著《红楼梦》。

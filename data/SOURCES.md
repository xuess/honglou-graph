# 数据来源与版本范围

## P0 事实底本

人物、关系、引语、章节摘要与结局等事实层内容，以 **甲戌本**、**庚辰本** 为唯一底本。

- 甲戌本、庚辰本中可定位的材料，可以进入事实层。
- 两本之间存在异文，或只见于其中一本的内容，必须写明版本、回目、定位及差异状态。
- 第八十一回及以后、程高系统及其他续书材料不得作为事实层的来源。若将来需要展示版本比较，必须放入明确标注的比较字段，不能覆盖底本事实。

本项目不以本文件替代版本校勘。每次新增或改写人物事实，都应同时保存可复核的版本、回目、原文定位；影印本或可靠校勘本页码优先于网页文字版。

## 数据结构

`data/provenance.json` 是机器可读的来源总表，包含：

- `policy`：底本范围和前台展示规则；
- `sourceCatalog`：可引用的版本载体，`role` 分为 `base`（甲戌/庚辰底本）、`comparison`（程乙本等版本对照）、`pending`（待补定位）；
- `evidence`：已核实事实与其回目定位；
- `auditQueue`：待核历史数据，不能视作已完成校勘。

人物记录可使用下列来源字段：

```json
{
  "sourceRefs": [
    {
      "sourceId": "jiaxu-wikisource",
      "edition": "甲戌本",
      "chapter": 3,
      "locator": "第三回末段“母舅王子腾”",
      "claim": "王子腾为薛蟠之母舅"
    }
  ],
  "quoteSources": [],
  "quoteComparisons": [],
  "outcomeSources": [],
  "outcomeSourceCandidates": [],
  "keyEventVersions": []
}
```

`quoteSources` 与 `quotes` 按下标一一对应，只能放通过底本规则校验的引语；`quoteComparisons` 放程乙本等版本对照，不进入“经典语录”。`outcomeSources` 至少应有一条有效来源；未通过校验的结局来源放 `outcomeSourceCandidates`，不能直接当事实展示。来源只能引用 `sourceCatalog` 中 `role: base` 的甲戌本或庚辰本，章节必须在第 1–80 回，且必须提供 `locator`。

人物章节与关键事迹逐条带版本：

```json
{
  "chapters": [
    { "chapter": 3, "title": "……", "summary": "……", "version": "original" },
    { "chapter": 97, "title": "……", "summary": "……", "version": "continuation" }
  ],
  "keyEvents": ["共读西厢", "焚稿断痴情"],
  "keyEventVersions": ["original", "continuation"]
}
```

`version` / `keyEventVersions` 只允许 `original`（前八十回）或 `continuation`（后四十回续书）。第 81 回及以后必须标 `continuation`。

关系记录可选 `evidence` 数组，用于“关系考据”卡片。每条证据必须定位到回目级情节，不引用原文长句：

```json
{
  "source": "jia_zheng",
  "target": "jia_baoyu",
  "type": "blood",
  "label": "父子",
  "evidence": [
    {
      "chapter": 33,
      "scene": "宝玉挨打",
      "summary": "贾政因金钏投井、结交蒋玉菡等事痛打宝玉。",
      "version": "前八十回",
      "status": "chapter"
    }
  ]
}
```

- 第 1–80 回的证据 `version` 必须为“前八十回”；第 81–120 回必须标注“后四十回续书”。
- `status` 固定为 `chapter`，表示只到回目与情节梗概层级，不冒充原文校勘。
- `evidenceNote` 可补充版本差异或争议说明，但不得在没有 `evidence` 时单独出现。
- 关系证据不是事实底本的替代品；卡片脚注保留“原文异文与版本差异待校”。

## 出场索引

`data/appearances.json` 是人物—回目的统一出场索引，由 `npm run build:appearances` 生成。

- 只收两类来源：人物 `chapters`（关键回目）和 `scene`/`entrance` 知识条目（名场面、人物出场）；
- 不从 `theme`、`character_study`、`allusion`、`poem`、`architecture` 等跨回目内容反推出场；
- `roles` 可为 `key` / `scene` / `entrance`，`version` 区分前八十回与续书；
- 时间线和章节人物视图应优先读这套索引，避免再用名字子串或主题条目猜人物。

## 文本提及索引

`data/text-mentions.json` 由 `npm run build:mentions` 从维基文库《脂砚斋重评石头记》会校本提取。

- 来源 `wikisource-liaoping-synthesis` 的 `role` 为 `reference`；
- 该文本由庚辰、己卯、甲戌合成，64、67、22 回以其他脂本配入；
- 只记录人物名/别名在某回文本中出现的次数，用于“文本提及”层，不作为经典语录、结局或事实定本依据；
- 同名/别名按最长匹配处理，并排除“通灵宝玉”“周瑞家的”等非人物或仆妇称谓。

## 引语候选校勘

`data/quote-crosscheck.json` 由 `npm run crosscheck:quotes` 生成。

- 使用《红楼梦脂批本新校电子版》（`liaoping-xinjiao`，role=comparison）做候选检索；
- 该新校本是现代整理本，不是单一庚辰底本；
- 命中只表示“新校本可检索到”，在 UI 中标注“待庚辰影印本复核”，不升级为“经典语录”；
- `quotesPendingVerified[].sourceAudit.crossCheck` 保存命中回目，便于后续人工按影印本复核。

## 事件/地点索引

`data/events.json`、`data/places.json` 由 `npm run build:taxonomy` 从知识条目的 `relatedEvents` / `relatedPlaces` 生成。

- 同一事件的不同写法（如“元妃省亲 / 元春省亲”）归并到同一 ID；
- 每条知识写回 `eventIds` / `placeIds`，便于筛选与交叉引用；
- 无法归并的自由文本使用稳定内容哈希 ID，不丢原有信息；
- 知识卡上的事件/地点标签可直接点击检索。

## 展示准则

- 只有通过“底本来源 + 版本一致 + 回目覆盖 + locator”四项校验的 `quoteSources` 才能显示为“经典语录”。
- `quotesTranscriptionVerified` 显示为“转录本已核”：现代脂批新校本可检索，但仍待庚辰影印本复核，不得混入“经典语录”。
- `quoteComparisons` 单独显示为“版本异文”，不得混入“经典语录”。
- 无有效 `outcomeSources` 的 `outcome` 是待核或续书信息，人物名录必须加“（待校）/（续书）”标签。
- 第 81 回及以后的章节、关键事迹必须显示“续书”标签，不能和原著事实并列。
- `sourceNote` 只可解释已登记的版本状态，不能替代逐条来源。

## 校验

在仓库根目录运行：

```bash
npm run validate:data
```

该命令会阻断重复人物 ID、悬空关系／亲属／知识关联、无效关系类型、超出底本范围的来源、来源目录角色与版本不一致、人物章节/关键事迹缺少版本、引语/对照来源混用等错误；关系 evidence 还会校验回目范围、前后八十回版本标注、scene/summary 必填与重复引用。审计队列的待核/已核数量会与数据实际统计对照，避免队列数字漂移。

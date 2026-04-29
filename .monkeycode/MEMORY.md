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

[红楼梦图谱数据模型]
- Date: 2026-04-29
- Context: Agent 在执行数据冗余、完整性与准确性检查时发现
- Category: 代码结构
- Instructions:
  - 项目核心数据位于 `data/characters.json`、`data/relationships.json`、`data/knowledge.json`，分别保存人物、关系边和知识库条目。
  - `characters.json` 使用 `id` 作为主键，并通过 `parentIds`、`childrenIds`、`spouseIds` 表示族谱关系。
  - `relationships.json` 的 `source`、`target` 必须引用人物 `id`，关系类型包括 `blood`、`marriage`、`master_servant`、`romance`、`social`、`rivalry`。
  - `knowledge.json` 的 `relatedCharacters` 必须引用人物 `id`，空的 `relatedEvents` 在当前前端实现中可作为空数组处理，不应简单视为 JSON 完整性错误。

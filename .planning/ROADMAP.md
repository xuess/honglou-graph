# Roadmap: 红楼梦知识图谱优化

## Overview

本路线图将《红楼梦》知识探索工具从"功能可用"升级为"体验流畅、数据可信"。分为两个阶段：先优化视图联动（用户时刻知道自己在哪里、在看什么），再完善数据质量（确保内容准确、完整、无冗余）。共 8 个阶段，逐步交付。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: 视图状态管理规范** - 建立状态管理基础，用户始终知道自己在哪里、能返回、能清空
- [ ] **Phase 2: 图谱生命周期优化** - 图谱视图切换流畅，状态正确恢复
- [ ] **Phase 3: 搜索状态保持** - 搜索关键字跨视图保持，有明确清空入口
- [ ] **Phase 4: 面包屑导航** - 用户能看到清晰的层次导航路径
- [ ] **Phase 5: 人物关系数据审查** - 所有人物关系和家族辈分信息准确
- [ ] **Phase 6: 诗词判词核对** - 所有诗词判词原文准确无误
- [ ] **Phase 7: 人物详情补充** - 主要人物信息完整，与回目正确关联
- [ ] **Phase 8: 知识库数据清理** - 知识条目关联正确，无冗余数据

## Phase Details

### Phase 1: 视图状态管理规范
**Goal**: 用户始终知道自己在哪里、在看什么，能方便地返回和清空状态
**Depends on**: Nothing (first phase)
**Requirements**: VIEW-01, VIEW-02, VIEW-03, VIEW-04
**Success Criteria** (what must be TRUE):
  1. 用户在任何视图都能看到当前视图的高亮指示（导航标签高亮、视图标题显示）
  2. 用户点击返回按钮能回到上一个有意义的视图状态
  3. 用户能一键清空所有筛选和选中状态，回到初始状态
  4. 用户在任意视图选中人物后，其他视图同步高亮该人物
**Plans:**
- [x] 01-01-PLAN.md — Implement breadcrumb display and clear button behavior (VIEW-01, VIEW-02, VIEW-03)
- [x] 01-02-PLAN.md — Cross-view character synchronization with scroll and highlight (VIEW-04)

### Phase 2: 图谱生命周期优化
**Goal**: 用户切换视图时体验流畅，图谱状态正确恢复
**Depends on**: Phase 1
**Requirements**: (Technical foundation — supports stable graph interaction)
**Success Criteria** (what must be TRUE):
  1. 用户切换离开图谱视图后，CPU 占用正常（无后台仿真运行）
  2. 用户返回图谱视图时，之前的节点位置和选中状态正确恢复
  3. 用户在图谱上的拖拽、点击交互响应正常
**Plans:** 2 plans
- [x] 02-01-PLAN.md — Graph state save/restore methods (CPU release + state preservation)
- [x] 02-02-PLAN.md — Focus mode UI sync and browser verification

### Phase 3: 搜索状态保持
**Goal**: 用户搜索关键字在视图切换后不丢失，有明确清空入口
**Depends on**: Phase 1
**Requirements**: VIEW-05
**Success Criteria** (what must be TRUE):
  1. 用户搜索关键字后切换视图，关键字保持在搜索框中
  2. 用户能看到明确的清空搜索入口（按钮或图标）
  3. 用户清空搜索后，所有视图回到无筛选状态
**Plans**: 1 plan
- [x] 03-01-PLAN.md — Search state persistence with clear button (VIEW-05)

### Phase 4: 面包屑导航
**Goal**: 用户能看到清晰的层次导航路径
**Depends on**: Phase 1
**Requirements**: VIEW-06
**Success Criteria** (what must be TRUE):
  1. 用户能看到当前所在位置的层次路径面包屑（如"概览 > 宝黛关系专题 > 林黛玉"）
  2. 用户点击面包屑项能跳转到对应层级
  3. 面包屑在窄屏设备上正确截断显示（不破坏布局）
**Plans**: TBD

### Phase 5: 人物关系数据审查
**Goal**: 所有人物关系和家族辈分信息准确无误
**Depends on**: Phase 1 (需要稳定的应用环境验证数据)
**Requirements**: DATA-01, DATA-02
**Success Criteria** (what must be TRUE):
  1. 所有人物关系的类型（血缘/婚姻/主仆/情感/社交/敌对）准确无误，与原著一致
  2. 所有人物归属的家族和辈分信息正确
  3. 关系数据的 source/target 在 characters.json 中存在（无孤立引用）
**Plans**: TBD

### Phase 6: 诗词判词核对
**Goal**: 所有诗词判词原文准确无误
**Depends on**: Phase 5
**Requirements**: DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. 诗词原文逐字核对，与原著一致
  2. 判词原文逐字核对，与原著一致
  3. 所有诗词判词标注正确出处（回目）
**Plans**: TBD

### Phase 7: 人物详情补充
**Goal**: 主要人物信息完整准确
**Depends on**: Phase 5
**Requirements**: DATA-05, DATA-06
**Success Criteria** (what must be TRUE):
  1. 主要人物（贾宝玉、林黛玉、薛宝钗等）的详细信息完整（性格、关键事件）
  2. 人物事件与原著回目正确关联
  3. 人物引用的章节信息准确
**Plans**: TBD

### Phase 8: 知识库数据清理
**Goal**: 知识库数据关联正确，无冗余
**Depends on**: Phase 6, Phase 7
**Requirements**: DATA-07, DATA-08
**Success Criteria** (what must be TRUE):
  1. 知识条目与相关人物正确关联（relatedCharacters 中的 id 在 characters.json 中存在）
  2. 删除重复或无意义的冗余数据
  3. 知识条目的分类和标签准确
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 视图状态管理规范 | 2/2 | ✓ | 2026-04-14 |
| 2. 图谱生命周期优化 | 2/2 | ✓ | 2026-04-14 |
| 3. 搜索状态保持 | 1/TBD | Ready for execution | - |
| 4. 面包屑导航 | 0/TBD | Not started | - |
| 5. 人物关系数据审查 | 0/TBD | Not started | - |
| 6. 诗词判词核对 | 0/TBD | Not started | - |
| 7. 人物详情补充 | 0/TBD | Not started | - |
| 8. 知识库数据清理 | 0/TBD | Not started | - |

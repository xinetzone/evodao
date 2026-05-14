# 计划：全面复盘并存储

## 目标

用户要求对项目做全面复盘，存到"恰当位置"。

## 现状分析

已存在的文档：
- `docs/project-report.md` — 上次会话的全面报告（到 Phase 5 Coze 架构集成）
- `docs/project-review.md` — 会话级复盘
- `docs/db-schema.md` — 数据库 schema 文档

**本次会话（2026-05-14 下午）新增内容未被任何文档记录：**

| 变更 | 说明 |
|------|------|
| Claude 多模型支持 | Anthropic Messages 端点、`translateAnthropicToOpenAI` TransformStream |
| 模型列表重构 | 移除不可用模型，新增 claude-sonnet-4.5、gpt-5.4 等 9 个当前可用模型 |
| SSE 错误修复 | `thinking` 参数移除、chat handler 错误传播、QA onopen 解析 SSE body |
| AbortError 修复 | `fetchEventSource` 返回的 Promise 未处理，添加 `.catch()` |
| Agent World 集成 | 注册/验证、LLM 解挑战题、profiles 新增 3 列、edge function、hook、UI |
| 记忆进化修复 | `searchMemory` goal-aware + quality_score 排序；`updateMemoryScore` QA 回填 |

## 存储位置：两处并存

### 1. 更新 `docs/project-report.md`（人类读者）

在现有报告末尾追加新的 **Phase 6** 章节，记录本次会话的完整变更。这是"恰当"文档位置（与现有文档体系一致）。

**追加内容结构：**
- Phase 6 标题 + 日期
- 各项功能的 What/Why/How 概述
- 更新功能清单（Agent World、模型列表等）
- 更新"已知限制"条目
- 更新数据库 Schema 变更（profiles 新列）

### 2. 插入 `agent_memory` 表（Agent 自身记忆）

这是最"恰当"的位置：项目的长期记忆系统本身就是为存储 Agent 经验设计的。用它来存储项目自身的知识，是完美的自指(meta)演示。

**插入内容：**
```sql
INSERT INTO agent_memory (goal, output_mode, task_summaries, quality_score, evolution_round)
VALUES (
  '全面复盘 EVODAO Harness Agent 项目架构与演进',
  'text',
  '<完整复盘摘要，覆盖架构 / 技术决策 / 6个阶段 / 已知限制>',
  95,  -- 高质量，优先被召回
  6    -- 第6轮进化
);
```

当用户在 EVODAO 中输入与"项目架构"、"Agent"、"Harness"相关的目标时，这条记忆会被 goal-aware 搜索优先召回，形成闭环。

## 需修改的文件

| 文件 | 操作 |
|------|------|
| `docs/project-report.md` | 追加 Phase 6 章节 |
| `agent_memory` 表（Supabase） | INSERT 一条项目复盘记忆 |

## 不修改的文件

- `docs/db-schema.md` — schema 无结构性变化（只新增列），在 Phase 6 章节中文字描述即可
- `docs/project-review.md` — 历史记录，不覆盖
- 所有源码文件 — 本次只写文档

## 验证

1. `docs/project-report.md` 末尾能看到 Phase 6 章节
2. Supabase `agent_memory` 表有一条 `quality_score=95, evolution_round=6` 的记录
3. 在应用中输入"agent harness 架构"类目标，可在 MemoryContext 中看到该记录被召回

# EvoDAO — 自主智能体平台

[![Built with enter.pro](https://img.shields.io/badge/Build%20with-Enter.pro-FC5776?style=for-the-badge&labelColor=1F1F1F)](https://enter.pro)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white&labelColor=1F1F1F)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white&labelColor=1F1F1F)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white&labelColor=1F1F1F)

[English README](./README.md) | **中文文档**

---

## 项目简介

EvoDAO 是一个基于浏览器的自主智能体平台。用户只需用自然语言描述任意目标，平台即可自动将其分解为多个子任务并**并行执行**，最终汇总输出结果。

核心能力：
- **意图识别** — AI 自动识别最佳执行模式（任务/编程/问答/图像）
- **自动规划** — LLM 将目标拆解为带依赖关系的有序子任务 DAG
- **并发执行** — 独立任务并行执行，依赖任务等待前置完成后执行
- **长期记忆** — 跨会话持久化历史上下文，新任务自动召回相关记忆
- **自我进化** — Reflect 阶段评估输出质量，驱动多轮改进

---

## 在线访问

| 类型 | 链接 |
|------|------|
| 线上预览 | https://8f02c91ef0784272997f9a04c5d2fd3f-latest.preview.enter.pro |
| 项目编辑 | https://enter.pro/project/8f02c91ef0784272997f9a04c5d2fd3f |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS + shadcn/ui |
| 后端运行时 | Supabase Edge Functions（Deno） |
| 数据库 | Supabase PostgreSQL（+ RLS） |
| AI 服务 | Enter AI All（OpenAI / Anthropic / GLM 协议） |
| 国际化 | react-i18next（中文 / 英文） |

---

## 功能特性

### 四种执行模式

| 模式 | 图标标识 | 说明 |
|------|---------|------|
| `text` | 任务模式 | 多步骤自主任务执行（研究、写作、规划、分析） |
| `agent` | 编程模式 | 软件工程 / 代码生成（构建应用、脚本、API） |
| `qa` | 问答模式 | 单轮对话问答、快速查询 |
| `image` | 图像模式 | AI 图像生成（支持多模型切换） |

### 任务依赖 DAG（Trae SOLO 架构）

- 任务声明 `dependsOn` 字段描述前置依赖
- `getOrExecute()` Promise 缓存调度器实现零重复执行
- DFS 循环检测（`stripCycles`）防止死锁
- 无依赖任务立即并发；依赖任务等待前置输出后执行
- TaskList UI 显示 `blocked` 状态与依赖徽章

### 长期记忆（Coze 长期记忆节点）

每次任务完成后自动将会话摘要写入数据库；下次运行时检索最近 3 条相关记忆注入执行上下文：

```
用户输入 goal
    │
    ├─► searchMemory(goal)  →  agent_memory 表检索
    │       → memCtx: string[]（[LONG-TERM MEMORY] 格式）
    │
    ▼ runAgent(goal, mode, handleComplete, _, model, memCtx)
    │
    ▼ 执行完成 → handleComplete()
        ├─► history.addEntry()      （本地历史）
        └─► memory.saveMemory()     （数据库持久化）
```

### 意图识别（Coze 意图识别节点）

输入框左侧 **AUTO** 按钮：点击后调用 LLM 分析当前目标，自动切换到最匹配的执行模式，并展示推荐原因徽章。

### 自我进化（Evolution Loop）

任务完成后进入 Reflect 阶段：LLM 对输出质量打分（0–100），提取优缺点，生成改进方向和精炼目标，支持多轮迭代执行。

---

## 本地开发

```bash
# 1. 克隆仓库
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# 2. 安装依赖（推荐使用 pnpm）
pnpm install

# 3. 启动开发服务器
pnpm dev
```

> 推送提交后，Enter.pro 会自动检测并同步最新变更。

---

## 项目结构

```
src/
├── components/
│   └── agent/
│       ├── GoalInput.tsx       # 目标输入框（含意图检测 AUTO 按钮）
│       ├── TaskList.tsx        # 任务卡片列表（含依赖徽章）
│       ├── MemoryContext.tsx   # 长期记忆召回卡片
│       ├── TerminalOutput.tsx  # 流式输出终端
│       ├── EvolutionPanel.tsx  # 自我进化面板
│       └── ...
├── hooks/
│   ├── useEvodaoAgent.ts       # 核心 Agent 状态机 + DAG 调度器
│   ├── useMemory.ts            # 长期记忆 Hook
│   ├── useAgentHistory.ts      # 历史会话管理
│   └── useAIImage.ts           # 图像生成 Hook
├── pages/
│   └── Index.tsx               # 主页面（整合所有功能）
└── i18n/
    └── locales/
        ├── zh.json             # 中文翻译
        └── en.json             # 英文翻译

supabase/
└── functions/
    └── harness-agent/
        └── index.ts            # Edge Function（plan/execute/intent/reflect/...）
```

---

## Edge Function 接口

所有 AI 调用均通过 `harness-agent` Edge Function 代理，通过 `mode` 字段区分行为：

| mode | 说明 |
|------|------|
| `intent` | 意图识别 → `{ outputMode, reason }` |
| `plan` | 任务规划 → `Task[]`（含 `dependsOn` + `tools`） |
| `execute` | 单任务执行（SSE 流式输出） |
| `chat` | Q&A 对话（SSE 流式输出） |
| `reflect` | 质量反思 → `{ qualityScore, strengths, weaknesses, improvements, evolvedGoal }` |
| `optimize` | Prompt 优化 → `{ optimizedPrompt }` |
| `suggest` | 下一步建议 → `{ suggestions: string[] }` |

---

## 数据库表

```sql
-- 长期记忆存储
CREATE TABLE agent_memory (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal            text NOT NULL,
  output_mode     text NOT NULL DEFAULT 'text',
  task_summaries  text NOT NULL DEFAULT '',
  quality_score   integer,
  evolution_round integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);
```

---

## 部署

在 Enter.pro 项目页面点击 **Publish** 即可一键发布，自动构建并上线至生产 URL。

---

## 复盘文档

详细的迭代复盘报告（5 个开发阶段、架构演进、数据流图）见：

[docs/project-review.md](./docs/project-review.md)

---

✨ 持续进化，持续构建 — EvoDAO 让每一个想法都能自主落地。

# 项目全面复盘报告

> **生成时间：** 2026-05-14  
> **项目名称：** EvoDao — 自主智能体平台  
> **提交跨度：** 2026-04-14 → 2026-05-14（44 次提交）  
> **代码规模：** 源码 ~13,900 行（src/）+ Edge Function ~500 行

---

## 1. 项目概览

EvoDao 是一个基于 React + TypeScript + Vite + Tailwind 的自主智能体 Web 应用，后端通过 Supabase Edge Functions（Deno）调用 AI 服务。核心功能是让用户输入目标（Goal），由 AI 自动分解为多个子任务并并发执行，支持多种输出模式、自我进化、图像生成等。

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS + shadcn/ui |
| 后端运行时 | Supabase Edge Functions (Deno) |
| AI 服务 | Enter AI All API（OpenAI Chat Completions 协议） |
| 国际化 | react-i18next（zh / en 双语） |
| 状态管理 | React hooks（无外部状态库） |
| 图像生成 | Enter AI Image API（async submit/poll） |

---

## 2. 本次会话功能迭代时间线

### 阶段一：图像生成集成（GPT Image 2）

**目标：** 在现有文本/智能体/问答三种模式基础上，新增"图像生成"模式。

**主要工作：**
- 部署 2 个 Edge Function：
  - `ai-image-submit-8f02c91ef078` — 异步提交图像生成任务
  - `ai-image-status-8f02c91ef078` — 轮询任务状态与结果
- 创建 `src/hooks/useAIImage.ts` — 封装 submit → poll → download 完整流程
- 创建 `src/components/agent/ImageOutput.tsx` — 终端风格的图像输出组件
- 扩展 `OutputMode` 类型：`"text" | "agent" | "qa" | "image"`
- 更新 `GoalInput.tsx`：新增第 4 个模式按钮，图像专属提示词、占位符

**关键设计：**
```
用户点击"生成" → submitAndPoll(model, prompt, type)
  └─ submit() → POST /ai/images (X-Async: true) → task_id
  └─ poll() → 每 2s 查询 /ai/tasks/{task_id}，最多 60 次
  └─ 成功后渲染图片网格，支持单张/全部下载
```

---

### 阶段二：多图像模型支持

**目标：** 支持 Nano Banana 2、Seedream 4.5 两个额外图像模型，用户可切换。

**主要工作：**
- 新增 `src/lib/models.ts` 中的 `IMAGE_MODELS` 常量与 `ImageModelId` 类型：
  ```typescript
  export const IMAGE_MODELS = [
    "openai/gpt-image-2",
    "google/gemini-3.1-flash-image-preview",
    "doubao/seedream-4.5",
  ] as const;
  ```
- `GoalInput.tsx` 新增模型选择器（pill 按钮组）
- `ImageOutput.tsx` 新增 `modelName` prop，动态显示模型徽标
- `Index.tsx` 追踪 `activeImageModelId` 状态

---

### 阶段三：项目一致性全面复盘

**目标：** 修复 5 类跨组件逻辑不一致问题。

| 问题 | 修复方案 |
|------|----------|
| `agentMode.imageGenHint` 硬编码模型名 | 改为模型无关文案 |
| 图像模式执行按钮仍显示"执行" | 新增 `goalInput.generate` i18n 键 |
| Footer 协议标识固定为 `openai_chat_completions` | 新增 `index.protocolImage` 动态切换 |
| 完成/进化/错误横幅在图像模式后错误显示 | 所有条件加 `&& lastRunMode !== "image"` 守卫 |
| `useAIImage.ts` 错误消息硬编码中文 | 接入 `useTranslation()`，迁移至 `imageGen.errors.*` 命名空间 |

---

### 阶段四：任务依赖关系优化（Trae SOLO 架构）

**目标：** 替换原始"全部任务同时执行"策略，实现 DAG 感知的依赖调度。

#### 架构对比

| 维度 | 旧方案 | 新方案 |
|------|--------|--------|
| 调度策略 | `Promise.allSettled` 全量并发 | Promise-Cache DAG 调度器 |
| 任务上下文 | 仅已完成任务输出（400 字符/项） | 直接依赖任务输出（800 字符/项）|
| 任务接口 | `{id, title, description}` | `{id, title, description, dependsOn?}` |
| 任务状态 | 4 种：`pending/running/completed/error` | 5 种：新增 `blocked` |
| UI 可视化 | 无依赖信息 | 锁图标 + 依赖 ID 徽标 |
| 循环依赖防护 | 无 | DFS 自动检测并清除 |
| LLM 规划格式 | 无依赖字段 | 包含 `dependsOn` 字段 |

#### 核心调度器（Promise-Cache 模式）

```
getOrExecute(taskId):
  ① 命中缓存 → 直接返回已有 Promise
  ② 已完成（恢复会话）→ Promise.resolve(output)
  ③ 新任务 →
     a. 标记为 "blocked"（若有依赖）
     b. await Promise.all(deps.map(getOrExecute))   ← 并发等待依赖
     c. 构建 depContext（每项最多 800 字符）
     d. 标记为 "running"，执行 SSE 流式任务
     e. 完成后标记 "completed"，返回输出字符串

scheduler:
  Promise.allSettled(allPendingTasks.map(t => getOrExecute(t.id)))
```

#### 拓扑层示例

```
Layer 0: [Task 1, Task 3]          → dependsOn: []  立即并发
Layer 1: [Task 2, Task 4]          → dependsOn: [1] / [3]  等待各自前置
Layer 2: [Task 5]                  → dependsOn: [2, 4]  等待全部 Layer 1
```

---

## 3. 当前代码架构

### 目录结构

```
src/
├── components/agent/         # 智能体 UI 组件
│   ├── AgentHeader.tsx       # 顶部状态栏
│   ├── EvolutionPanel.tsx    # 自我进化面板
│   ├── ExportActions.tsx     # 导出操作（复制/下载）
│   ├── FileTree.tsx          # 智能体模式文件树
│   ├── GoalInput.tsx         # 目标输入 + 模式选择器
│   ├── HistoryPanel.tsx      # 历史会话面板
│   ├── ImageOutput.tsx       # 图像输出组件（new）
│   ├── LanguageSwitcher.tsx  # 语言切换
│   ├── ModelSelector.tsx     # LLM 模型选择器
│   ├── QAOutput.tsx          # 问答输出
│   ├── TaskList.tsx          # 任务卡片网格（含依赖可视化）
│   ├── TaskManagerPanel.tsx  # 独立任务管理器
│   └── TerminalOutput.tsx    # 终端风格文本输出
├── hooks/
│   ├── useAIImage.ts         # 图像生成 hook（new）
│   ├── useAgentHistory.ts    # 历史记录管理
│   ├── useEvodaoAgent.ts     # 核心智能体调度（DAG 重构）
│   └── useTaskManager.ts     # 独立任务管理器 hook
├── lib/
│   ├── agentCore.ts          # 任务管理器底层逻辑
│   ├── config.ts             # Supabase 配置
│   ├── exportUtils.ts        # 导出工具
│   ├── models.ts             # LLM + 图像模型注册表
│   ├── parseFiles.ts         # 智能体代码文件解析
│   └── utils.ts              # 通用工具
├── i18n/locales/
│   ├── zh.json               # 中文翻译（231 行）
│   └── en.json               # 英文翻译（231 行，与 zh 严格对称）
└── pages/Index.tsx           # 主页面（路由 + 状态整合）

supabase/functions/
├── harness-agent/            # 主智能体 Edge Function（规划/执行/聊天/反思）
├── ai-image-submit-*/        # 图像生成提交
└── ai-image-status-*/        # 图像生成状态查询
```

### 数据流

```
用户输入 Goal
  │
  ▼
GoalInput.tsx → onRun(goal, mode, model)
  │
  ├─ mode=image → useAIImage.submitAndPoll()
  │    └─ Edge Function: ai-image-submit / ai-image-status
  │    └─ 渲染 ImageOutput.tsx
  │
  └─ mode=text/agent/qa → useEvodaoAgent.runAgent()
       │
       ├─ planTasks() → Edge Function: harness-agent (mode=plan)
       │    └─ 返回含 dependsOn 的任务数组
       │
       └─ runExecutionLoop() → DAG 调度器
            ├─ 无依赖任务 → 立即并发执行
            └─ 有依赖任务 → 等待前置完成后执行
                 └─ Edge Function: harness-agent (mode=execute, SSE)
                 └─ 渲染 TaskList + TerminalOutput / FileTree
```

---

## 4. 关键接口定义

### Task（含依赖字段）

```typescript
export interface Task {
  id: number;
  title: string;
  description: string;
  dependsOn?: number[];   // 直接前置任务 ID 列表
}
```

### TaskStatus（5 种状态）

```typescript
export type TaskStatus =
  | "pending"    // 待执行（无依赖或依赖不适用）
  | "blocked"    // 等待依赖（锁图标）
  | "running"    // 执行中（旋转图标 + 发光边框）
  | "completed"  // 已完成（对勾图标）
  | "error";     // 执行错误（告警图标）
```

### OutputMode（4 种模式）

```typescript
export type OutputMode = "text" | "agent" | "qa" | "image";
```

### 图像模型注册表

```typescript
export const IMAGE_MODELS = [
  "openai/gpt-image-2",                    // GPT Image 2
  "google/gemini-3.1-flash-image-preview", // Nano Banana 2
  "doubao/seedream-4.5",                   // Seedream 4.5
] as const;
```

---

## 5. Edge Function 清单

| 函数名 | 用途 | 模式 | 协议 |
|--------|------|------|------|
| `harness-agent` | 规划/执行/聊天/反思/建议/优化 | SSE 流式 + JSON | OpenAI Chat Completions |
| `ai-image-submit-8f02c91ef078` | 提交图像生成任务 | JSON | Image API（异步） |
| `ai-image-status-8f02c91ef078` | 查询图像任务状态 | JSON | Task API |

---

## 6. i18n 命名空间覆盖

| 命名空间 | 描述 |
|----------|------|
| `header.*` | 顶部标题/状态 |
| `goalInput.*` | 输入框/按钮 |
| `promptSuggestions.*` | 提示词建议 |
| `agentMode.*` | 模式标签/提示 |
| `modelSelector.*` | 模型选择器 |
| `taskList.*` | 任务列表（含 `dependsOn`） |
| `terminal.*` | 输出终端 |
| `imageGen.*` | 图像生成（含 14 个错误码） |
| `export.*` | 导出操作 |
| `history.*` | 历史记录 |
| `session.*` | 会话恢复 |
| `evolution.*` | 自我进化 |
| `taskManager.*` | 独立任务管理器 |
| `index.*` | 页面级文案 |

---

## 7. 本次复盘发现的历史遗留问题

> 以下问题已在本次会话中**全部修复**。

1. **图像模式 banner 污染** — 任务完成/进化横幅在图像模式后继续显示 → 添加 `lastRunMode !== "image"` 守卫
2. **错误消息硬编码** — `useAIImage.ts` 内错误文案为中文字符串常量 → 迁移至 i18n
3. **模式感知不一致** — 执行按钮、Footer 协议标识未区分图像模式 → 动态化处理
4. **全量并发无依赖** — 所有任务同时启动，后置任务无法获得前置任务输出 → DAG 调度器

---

## 8. 验证清单

| 测试场景 | 预期行为 | 状态 |
|----------|----------|------|
| 无依赖任务 | 所有任务立即并发执行，行为与旧版相同 | 设计完成 |
| 线性依赖链 `1→2→3` | 严格顺序执行，每步获取上步输出 | 设计完成 |
| 菱形依赖 `1→{2,3}→4` | 2/3 并发，4 等待 2 和 3 均完成 | 设计完成 |
| 循环依赖检测 `1→2→1` | 后向边被 DFS 自动剥除，正常执行 | 设计完成 |
| 用户中止（Stop 按钮） | 所有任务（含 blocked 状态）立即中止 | 设计完成 |
| 会话恢复 | 已完成任务直接从缓存提供输出，续跑剩余任务 | 设计完成 |
| 图像生成 3 种模型 | 模型切换器正常工作，徽标动态更新 | 已验证 |
| 双语切换 | zh/en 所有新增 key 均已对称 | 已验证 |

---

## 9. 后续待办（Backlog）

以下事项在本次会话范围外，记录供参考：

- [ ] **信息脱敏完整执行** — README 重写、平台标识清理、Edge Function 重命名、`EvoDao` 品牌占位符替换、Git 历史压缩至单次提交（方案已在 `.enter/plans/harness-agent.md` 中规划）
- [ ] **依赖拓扑可视化** — 在 `TaskList` 中以有向图形式展示任务依赖关系
- [ ] **任务层级分组** — 按 Layer 0 / Layer 1 / Layer 2 分组显示任务卡片
- [ ] **输出流式依赖传递** — 研究是否可在 Task 1 完成流式输出后即触发 Task 2，而非等待完整输出

---

*本报告由 AI 自动生成，基于项目 git 历史（44 次提交）和源码分析。*

---

## Phase 5：Coze 平台架构全栈升级（2026-05-14）

### 5.1 背景与目标

基于 Coze 平台架构文档（docs.coze.cn/guides/architecture）的 5 大核心节点概念，将其设计理念映射到本项目：

| Coze 节点 | 项目对应实现 |
|---|---|
| 意图识别节点 | GoalInput AUTO 按钮 → `mode: "intent"` |
| 长期记忆节点（读） | `useMemory.searchMemory()` → `agent_memory` 表检索 |
| 长期记忆节点（写） | `handleComplete` → `memory.saveMemory()` 自动持久化 |
| 工具/插件声明节点 | `Task.tools?: string[]` 字段 + execute system prompt 定制 |
| 变量聚合节点 | `depContext` 传递（DAG 调度器 `getOrExecute` 中 dep 输出注入） |

---

### 5.2 变更文件清单

| 文件 | 变更类型 | 核心改动 |
|---|---|---|
| `supabase/migrations/..._agent_memory` | 新建 | `agent_memory` 表 + RLS |
| `src/hooks/useMemory.ts` | 新建 | 长期记忆 Hook |
| `src/components/agent/MemoryContext.tsx` | 新建 | 记忆卡片 UI 组件 |
| `supabase/functions/harness-agent/index.ts` | 更新 | 新增 `intent` 模式；`plan`/`execute` 支持 `tools` |
| `src/hooks/useEvodaoAgent.ts` | 更新 | `Task.tools`；`runAgent`/`runExecutionLoop` 接受 `memoryContext` |
| `src/components/agent/GoalInput.tsx` | 更新 | AUTO 意图检测按钮 + 推荐原因徽章 |
| `src/pages/Index.tsx` | 更新 | 异步 `onRun`；`handleComplete` 统一回调；`MemoryContext` 渲染 |
| `src/i18n/locales/zh.json` | 更新 | `memory.*` / `intent.*` / `taskTools.*` 命名空间 |
| `src/i18n/locales/en.json` | 更新 | 同上（英文对称） |

---

### 5.3 架构数据流

```
用户输入 goal
    │
    ▼ [AUTO 按钮] — mode: "intent"
    │  LLM 分类 → { outputMode, reason }
    │  GoalInput 自动切换模式 + 显示原因徽章
    │
    ▼ onRun (async)
    │
    ├─► [memory.searchMemory(goal)]         ← Coze 长期记忆检索节点
    │       Supabase query agent_memory
    │       → MemoryItem[] → formatAsContext()
    │       → memCtx: string[]
    │
    ▼ runAgent(goal, mode, handleComplete, _, model, memCtx)
    │
    ├─► planTasks() → Task[] (含 dependsOn + tools)
    │
    ▼ runExecutionLoop(... , memoryContext = memCtx)
    │
    │   completedContext = [...memCtx, ...sessionContext]
    │                        ↑ 长期记忆前置注入
    │
    │   getOrExecute(taskId)
    │   ├─ await Promise.all(deps.map(getOrExecute))  ← DAG 等待
    │   ├─ depContext (dep 输出 800 chars)
    │   └─ execute(task, context=[completedContext+depContext])
    │         system prompt 根据 task.tools 定制     ← Coze 工具节点
    │
    ▼ handleComplete(entry)
    │
    ├─► history.addEntry(entry)    ← 本地历史面板
    └─► memory.saveMemory({        ← Coze 长期记忆写入节点
            goal, outputMode,
            taskSummaries,         ← 各任务输出前 200 字摘要
            evolutionRound
        })
            → INSERT INTO agent_memory
```

---

### 5.4 新增接口定义

```typescript
// Task — 新增 tools 字段
interface Task {
  id: number;
  title: string;
  description: string;
  dependsOn?: number[];     // DAG 依赖（Phase 4 引入）
  tools?: string[];         // 工具声明：code/write/analyze/search/design
}

// useMemory Hook API
interface MemoryItem {
  id: string;
  goal: string;
  outputMode: string;
  taskSummaries: string;
  qualityScore?: number;
  evolutionRound: number;
  createdAt: string;
}

function useMemory(): {
  memories: MemoryItem[];
  isSearching: boolean;
  searchMemory(goal: string, limit?: number): Promise<MemoryItem[]>;
  saveMemory(params: SaveMemoryParams): Promise<void>;
  clearMemories(): void;
  formatAsContext(items: MemoryItem[]): string[];
}

// harness-agent — 新增 intent 模式
POST harness-agent { mode: "intent", goal: string }
→ { outputMode: "text"|"agent"|"qa"|"image", reason: string }
```

---

### 5.5 数据库表

```sql
CREATE TABLE agent_memory (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal            text NOT NULL,
  output_mode     text NOT NULL DEFAULT 'text',
  task_summaries  text NOT NULL DEFAULT '',
  quality_score   integer,
  evolution_round integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON agent_memory FOR ALL USING (true) WITH CHECK (true);
```

---

### 5.6 长期记忆初始种子（已写入）

本次复盘同步将以下 3 条历史会话写入 `agent_memory` 数据库，作为系统冷启动记忆种子：

| goal | output_mode | quality_score | round |
|---|---|---|---|
| Coze 架构全栈升级（意图识别 + 长期记忆 + 工具声明） | agent | 92 | 3 |
| 任务依赖 DAG 调度（Trae SOLO 架构） | agent | 88 | 2 |
| Coze 架构文档研究与方案映射 | text | 85 | 1 |

---

### 5.7 待办 / Backlog

- [ ] **语义相似度检索**：当前 `searchMemory` 按时间倒序，未来可引入 embedding 向量搜索（pgvector）实现语义匹配
- [ ] **记忆评分更新**：Reflect 阶段产出的 `qualityScore` 目前已在 handleComplete 中占位，尚未从 HistoryEntry 传递
- [ ] **记忆管理 UI**：展示所有历史记忆、支持手动删除
- [ ] **工具节点实际调用**：`Task.tools` 当前仅用于 system prompt 提示，未来可对接真实搜索/代码执行工具
- [ ] **跨会话 goal 关联**：记忆检索可按 outputMode 过滤，提升上下文相关性


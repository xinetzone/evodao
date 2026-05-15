# harness-agent 开发计划 — A + B + C + D

## 背景

原计划（ModelSelector Portal 修复）**已全部实现**。
用户选择继续推进四个方向：A（流式输出）、B（记忆/上下文增强）、C（Agent World 平台 tab）、D（Plan DAG 可视化）。

---

## 现状评估（重要发现）

| 功能 | 状态 |
|---|---|
| `execute` 模式 SSE 流式输出 | ✅ 已实现（`fetchEventSource` + `onChunk`） |
| `chat` 模式 SSE 流式输出 | ✅ 已实现（`fetchEventSource`） |
| `TerminalOutput` 实时渲染 | ✅ 已实现（`animate-blink` 光标） |
| Memory 上下文注入 execute | ✅ 已实现（`completedContext` 包含 `memoryContext`） |
| `reflect` 模式 | ❌ 阻塞式 fetch，无流式反馈 |
| `plan` 阶段上下文注入 | ❌ `planTasks()` 不接受 memoryContext |
| Agent World 平台面板 | ❌ 未实现 |
| DAG 可视化 | ❌ 仅显示 "depends on N" 文字提示 |

---

## 方向 A — 将 Reflect 改为 SSE 流式输出

**Why**：`reflect` 调用目前是阻塞 fetch（等待 3-8s 无任何反馈），改为流式让用户看到反思内容实时生成。

### A1 — Edge Function（`supabase/functions/harness-agent/index.ts`）

将 `reflect` mode 从 `callLLMNonStream` 改为 `callLLMStream`，以 SSE 格式流出 token，在最后一个 `[DONE]` 前额外输出一个 JSON 摘要 chunk（`type: "reflect_result"`）供前端解析评分数据。

```
// 新策略：流出全部反思文本，最后发送 JSON 结构化结果
data: {"choices":[{"delta":{"content":"...reflection text token..."}}]}
...
data: {"reflect_result":{"qualityScore":82,"strengths":[...],"weaknesses":[...],"improvements":[...],"evolvedGoal":"..."}}
data: [DONE]
```

### A2 — Hook（`src/hooks/useEvodaoAgent.ts`）

`evolve()` 函数改为 `fetchEventSource`：
- 新增状态 `reflectionStream: string`（流式文本，供实时显示）
- 流式 token 追加到 `reflectionStream`
- 收到 `reflect_result` chunk 时调用 `setReflection(result)` + `setEvolutionStatus("reflected")`
- 返回值中新增 `reflectionStream`

### A3 — UI（`src/components/agent/EvolutionPanel.tsx`）

- 当 `evolutionStatus === "reflecting"` 时，若 `reflectionStream` 非空则显示流式文本而非纯加载动画
- 添加 terminal 样式的 typewriter 区域（复用 `TerminalOutput` 的样式语言）

**改动文件**：
- `supabase/functions/harness-agent/index.ts`
- `src/hooks/useEvodaoAgent.ts`
- `src/components/agent/EvolutionPanel.tsx`

---

## 方向 B — Memory 上下文注入 Plan 阶段

**Why**：目前 memoryContext 已注入 execute 子任务，但 `planTasks()` 调用时没有携带，AI 规划时无法参考历史经验。

### B1 — Edge Function（`supabase/functions/harness-agent/index.ts`）

`plan` mode 接受新字段 `memoryContext?: string[]`，在构建 plan system prompt 时追加：

```typescript
const memSection = memoryContext?.length
  ? `\n\nRelevant past sessions (use to avoid repeating work / refine scope):\n${memoryContext.join("\n---\n")}`
  : "";
// 追加到 userPrompt 而非 systemPrompt（避免破坏 JSON 输出格式）
const userContent = `Goal: ${goal}${memSection}`;
```

### B2 — Hook（`src/hooks/useEvodaoAgent.ts`）

`planTasks(goal, mode, evolutionCtx, model, memoryContext?)` — 新增第五参数。

`runAgent()` 中将已有的 `memoryContext` 传入 `planTasks()`。

```typescript
// 已有 runAgent() 签名：
// runAgent(goal, mode, onComplete, evolutionCtx, model, memoryContext, imageDataUrls)
// 改动：planTasks 调用处补充 memoryContext 参数
const plannedTasks = await planTasks(goal, mode, evolutionCtx, model, memoryContext);
```

**改动文件**：
- `supabase/functions/harness-agent/index.ts`（plan mode 增加 memoryContext 字段）
- `src/hooks/useEvodaoAgent.ts`（planTasks 签名 + 调用处）

---

## 方向 C — Agent World 平台集成 Tab

**Why**：在 UI 中集中展示 Agent World 平台账号状态（evodao_v2 / evodao-dx 等）和各 member site 状态，方便快速查看。

### C1 — 新组件 `src/components/agent/PlatformPanel.tsx`

Slide-over 面板（复用 `HistoryPanel` 的布局模式）：

**结构**：
1. **Agent World 账号列表**  
   - evodao_v2 ✅ | evodao-link1 ✅ | evodao-xp ✅ | evodao-dx ✅  
   - 每个账号：username / masked api_key / 复制按钮  
2. **平台状态矩阵**（表格形式）  
   | 平台 | 域名 | 状态 | 备注 |  
   |---|---|---|---|  
   | DreamX | dreamx.coze.com | 🔴 401 | 307 问题 |  
   | 虾评 | xiaping.coze.com | 🔴 注册失败 | 后端 bug |  
   | ABTI | abti.coze.com | 🔴 401 | 307 问题 |  
   | Agent World | world.coze.com | 🟢 OK | evodao_v2 有效 |  
3. **DreamX 快讯**（只读数据）：dreams 12,309 / agents 1,737 / transactions 489  
4. **已知阻塞说明**：一行小字说明 `world.coze.site → 307` 根因

**数据来源**：硬编码常量（读取自 memory.md 中的关键数据），无需 API 调用。

### C2 — AgentHeader（`src/components/agent/AgentHeader.tsx`）

在 AgentHeader 工具栏添加一个 `Globe2` 图标按钮，点击打开 `PlatformPanel`。
接受新 prop `onPlatformOpen: () => void`。

### C3 — Index.tsx（`src/pages/Index.tsx`）

添加 `platformOpen` state + `<PlatformPanel>` 组件渲染，`onPlatformOpen` 传给 `AgentHeader`。

**改动文件**：
- `src/components/agent/PlatformPanel.tsx`（新建）
- `src/components/agent/AgentHeader.tsx`
- `src/pages/Index.tsx`

---

## 方向 D — Plan DAG 可视化

**Why**：目前 `TaskList` 只显示 "depends on 1, 2" 小字，无法直观看到任务的执行拓扑。

### D1 — `TaskList.tsx` 改造

**方案**：分层布局（Topological Levels）+ CSS 连线。

**步骤**：
1. 对 `tasks` 做拓扑排序，按依赖深度分组为若干 `levels`（level 0 = 无依赖的任务）。  
2. 每个 level 横向展示为一行（flex row），level 间用垂直箭头线连接。  
3. 对有依赖关系的任务对，在两个 task card 之间绘制 SVG 箭头（`<svg>` absolute-positioned overlay）。  
4. 悬浮 task card 时高亮其直接依赖关系（dep cards 边框变色）。

**实现细节**：
```
Level 0: [Task 1]  [Task 2]    ← 并行，无依赖
              ↓        ↓
Level 1: [Task 3]  [Task 4]    ← 各自等待上游
                     ↓
Level 2:         [Task 5]       ← 汇聚
```

- 箭头使用 SVG `<line>` + `<marker>` arrowhead，颜色跟随 task status（primary/muted）
- 保持现有 card 样式不变，只是改变布局方式（grid → levels flex）
- 当 `tasks.length <= 1` 时回退为原有网格布局（无箭头）

**改动文件**：
- `src/components/agent/TaskList.tsx`（唯一改动文件）

---

## 实施顺序

1. **B**（最小改动，高价值）→ B1 edge fn plan + B2 hook
2. **A**（streaming reflect）→ A1 edge fn + A2 hook + A3 UI
3. **D**（DAG 可视化，纯前端）→ D1 TaskList
4. **C**（平台面板）→ C1 新组件 + C2 AgentHeader + C3 Index

---

## 关键文件列表

| 文件 | 改动方向 |
|---|---|
| `supabase/functions/harness-agent/index.ts` | A（reflect SSE）, B（plan memoryContext） |
| `src/hooks/useEvodaoAgent.ts` | A（evolve 改 fetchEventSource, reflectionStream state）, B（planTasks 参数） |
| `src/components/agent/EvolutionPanel.tsx` | A（显示 reflectionStream 流式文本） |
| `src/components/agent/TaskList.tsx` | D（拓扑分层 + SVG 箭头） |
| `src/components/agent/PlatformPanel.tsx` | C（新建） |
| `src/components/agent/AgentHeader.tsx` | C（新增平台按钮） |
| `src/pages/Index.tsx` | C（platformOpen state + panel 挂载） |

---

## 验证方案

- **A**: 触发进化（evolve），观察 EvolutionPanel 逐字出现反思内容而非等待后一次性显示
- **B**: 运行一个 goal，在 Network tab 确认 plan 请求 body 包含 `memoryContext` 字段
- **C**: 点击 AgentHeader 平台按钮，面板显示 4 个账号状态 + DreamX 数据
- **D**: 创建包含 `dependsOn` 的任务计划，观察 TaskList 出现分层布局和箭头连线

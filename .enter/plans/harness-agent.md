# harness-agent 开发计划（更新版）

## 现状评估

原计划（ModelSelector Portal 修复）**已全部实现**：
- `src/components/agent/ModelSelector.tsx` ✅ 已用 `createPortal` + `getBoundingClientRect` 完成
- `supabase/functions/harness-agent/index.ts` ✅ 已实现所有 mode（plan / execute / reflect / chat / suggest / intent / optimize / memory_search / memory_summarize）
- `src/pages/Index.tsx` ✅ 已接入 `suggest` mode，运行完成后自动触发建议
- `src/hooks/useEvodaoAgent.ts` ✅ 已调用 plan / execute / reflect / chat mode

---

## 待确认：下一步开发方向

以下是可以继续推进的方向，请用户选择：

### 方向 A — 流式输出（Streaming）
**目标**：`execute` / `chat` 响应改为 SSE 流式输出，用户看到逐字生成而不是等待后一次性显示。
**改动范围**：
- `harness-agent/index.ts`：`execute` / `chat` mode 改为 ReadableStream 响应
- `useEvodaoAgent.ts`：用 `fetch` + `reader.read()` 消费 SSE 流，实时更新 output 状态

### 方向 B — 记忆与上下文增强
**目标**：每次运行时自动携带 memory.md 摘要 + 历史关键输出作为 context，让 Agent 做更连贯的多轮工作。
**改动范围**：
- `harness-agent/index.ts`：`plan` / `execute` mode 接受 `memoryContext` 参数并注入 system prompt
- `Index.tsx` + `useEvodaoAgent.ts`：运行前读取 memory 内容注入请求

### 方向 C — Agent World 平台集成 tab
**目标**：在 UI 侧边栏增加 Agent World 平台管理面板（虾评/DreamX/ABTI），展示账号状态、尝试操作。
**改动范围**：
- 新增 `PlatformPanel.tsx`：平台账号状态列表 + 快捷操作
- `Index.tsx`：左侧 tab 中增加「平台」入口

### 方向 D — 优化 Plan 可视化
**目标**：任务列表显示依赖关系图（DAG），并行任务并排显示，让用户更直观地看到执行流程。
**改动范围**：
- `TaskList.tsx` / `TaskManagerPanel.tsx`：增加 DAG 渲染层

### 方向 E — 快速修复 & 打磨
**目标**：修复现有已知问题 + 改善细节体验：
1. `IndexPage` 的 `suggest` 请求错误时静默 fallback（已实现），但 loading 状态可以优化
2. 历史面板的导出功能完善
3. AgentWorldModal 旧域名 `world.coze.site` 提示文本更新（已有代码修复，检查是否还有其他 .site 引用）

---

## 用户决策

请选择上面的方向（可多选），或描述你想做的具体功能。

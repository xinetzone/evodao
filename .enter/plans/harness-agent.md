# 平台架构优化计划 — Coze 架构参考

## Context

参考 Coze 平台架构（意图识别节点、变量/工具声明、长期记忆节点），对本项目进行三层全栈升级：

1. **意图识别层** — 自动检测 goal → OutputMode，替代手动模式选择
2. **工具声明层** — 任务可声明所需工具（tools 字段），Edge Function 据此调整 system prompt
3. **长期记忆层** — Supabase DB 持久化完成的会话，跨会话注入历史上下文

---

## 架构对应关系

| Coze 概念 | 本项目实现 |
|-----------|-----------|
| 意图识别节点 | Edge Function `mode: "intent"` + GoalInput 自动检测按钮 |
| 插件/工具节点 | `Task.tools?: string[]` 字段 + executor system prompt 适配 |
| 变量聚合节点 | 结构化 `TaskContext` 对象替换 `string[]` 上下文 |
| 长期记忆节点 | `agent_memory` Supabase 表 + `useMemory` hook |
| 长期记忆写入节点 | 会话完成后自动 save |
| 长期记忆检索节点 | 新 run 开始前自动 search，注入为上下文 |

---

## Step 1: Database Migration

新建 `agent_memory` 表（无需 auth，公开读写）：

```sql
CREATE TABLE agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal text NOT NULL,
  output_mode text NOT NULL DEFAULT 'text',
  task_summaries text NOT NULL DEFAULT '',
  quality_score integer,
  evolution_round integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON agent_memory FOR ALL USING (true) WITH CHECK (true);
```

---

## Step 2: Edge Function — `harness-agent` 新增三个 mode

### 2a. `mode: "intent"`
- 输入：`{ goal, currentMode? }`
- LLM prompt：轻量意图分类，返回 `{ outputMode, reason }`
- 模型：`UTILITY_MODEL`（z-ai/glm-5.1）
- 输出：`{ outputMode: "text"|"agent"|"qa"|"image", reason: string }`

```
System: You are an intent classifier. ...
Return ONLY: {"outputMode":"agent","reason":"..."}
```

### 2b. `mode: "memory-save"`
- 输入：`{ goal, outputMode, taskSummaries, qualityScore?, evolutionRound? }`
- 使用 Supabase REST API 写入 `agent_memory`
- 无 LLM 调用，纯 DB write
- 需要 `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`（secret）

### 2c. `mode: "memory-search"`
- 输入：`{ goal, limit?: number }`
- 策略：从 DB 取最近 10 条 → LLM 选出最相关 3 条 → 返回 snippets
- 输出：`{ memories: Array<{ goal, summary, outputMode, qualityScore }> }`

### 2d. 更新 `mode: "plan"`
在 plan prompt 中增加 `tools` 字段说明：
```
{"id":1,"title":"...","description":"...","dependsOn":[],"tools":["search","code"]}
```
可选工具：`search`, `code`, `write`, `analyze`, `design`

### 2e. 更新 `mode: "execute"`
根据 `task.tools` 追加 system prompt 工具提示段：
```typescript
const toolHints = {
  search: "You can reference web search results if they're provided in context.",
  code: "Write complete, runnable code with no TODOs or placeholders.",
  analyze: "Perform deep analysis with data, metrics, and evidence.",
  write: "Produce polished, publication-ready written content.",
  design: "Include visual structure descriptions, layout rationale, and design decisions.",
};
```

---

## Step 3: 新 Hook — `src/hooks/useMemory.ts`

```typescript
export function useMemory() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchMemory = async (goal: string): Promise<MemoryItem[]>
  const saveMemory = async (params: SaveMemoryParams): Promise<void>
  const clearMemories = () => setMemories([])

  return { memories, isSearching, searchMemory, saveMemory, clearMemories }
}
```

---

## Step 4: 更新 `src/hooks/useEvodaoAgent.ts`

### 4a. 扩展 `Task` 接口
```typescript
export interface Task {
  id: number;
  title: string;
  description: string;
  dependsOn?: number[];
  tools?: string[];        // ADD: declared tool capabilities
}
```

### 4b. 扩展 `runAgent` 签名
```typescript
const runAgent = useCallback(async (
  goal: string,
  mode: OutputMode = "text",
  onComplete?: (entry: HistoryEntry) => void,
  evolutionCtx?: EvolutionContext,
  model?: string,
  memoryContext?: string[]   // ADD: injected from useMemory
) => { ... }
```

### 4c. 在 `runExecutionLoop` 中传递 memoryContext
- `completedContext` 前面追加 memoryContext 条目（标记为 `[MEMORY]`）
- memory 条目截断为 600 chars/条，最多 3 条

---

## Step 5: 更新 `src/pages/Index.tsx`

### 5a. 新增 `useMemory` 使用
```typescript
const memory = useMemory();
```

### 5b. `handleRun` 前：搜索记忆
```typescript
const handleRun = async (goal, mode, model) => {
  setLastRunMode(mode);
  if (mode !== "image" && mode !== "qa") {
    // async search, don't block run start
    memory.searchMemory(goal).then(mems => { ... pass as context ... });
  }
  ...
}
```

实际实现：在 `runAgent` 中，memory 搜索与 planning 并行（`Promise.all`），搜索结果在 execute 阶段注入。

### 5c. `onComplete` 回调中自动保存记忆
```typescript
const handleComplete = (entry: HistoryEntry) => {
  history.addEntry(entry);
  // Auto-save to long-term memory
  const taskSummaries = entry.tasks
    .map(t => `${t.title}: ${(entry.taskOutputs[t.id] || "").substring(0, 300)}`)
    .join("\n");
  memory.saveMemory({
    goal: entry.goal,
    outputMode: entry.outputMode || "text",
    taskSummaries,
    evolutionRound: entry.evolutionRound,
  });
};
```

---

## Step 6: 更新 `src/components/agent/GoalInput.tsx`

### 6a. 新增 "自动检测模式" 按钮
- 位置：mode 选择器旁，使用已导入的 `Wand2` 图标（已在文件中 import）
- 状态：`isDetecting: boolean`
- 点击 → 调用 `mode: "intent"` → 根据返回结果 `setOutputMode()`
- 检测中显示旋转图标，完成后短暂显示检测结果 badge

### 6b. 模式按钮区域更新
在 4 个模式按钮下方，当 `detectedMode !== null` 时显示：
```tsx
<span className="text-[10px] text-primary/60">AI 推荐: {detectedReason}</span>
```

---

## Step 7: 新增 `src/components/agent/MemoryContext.tsx`

当 `memories.length > 0` 且 `status === "executing"` 时，在 TaskList 上方显示记忆上下文卡片：

```tsx
<MemoryContext memories={memories} />
```

小型卡片，显示最多 3 条历史记忆，格式：
```
MEMORY [#1] — "past goal text..." — score: 85
[brief summary snippet]
```

---

## Step 8: i18n 新增 keys（zh + en 对称）

```json
"memory": {
  "label": "长期记忆",
  "searching": "正在检索历史记忆...",
  "found": "召回 {{count}} 条相关记忆",
  "saved": "已保存至长期记忆",
  "heading": "历史上下文"
},
"intent": {
  "detecting": "正在识别意图...",
  "detected": "检测到: {{mode}}",
  "autoBtn": "自动识别"
},
"taskTools": {
  "search": "搜索",
  "code": "代码",
  "write": "写作",
  "analyze": "分析",
  "design": "设计"
}
```

---

## 文件改动清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `supabase/migrations/xxx_agent_memory.sql` | 新建 | DB schema |
| `supabase/functions/harness-agent/index.ts` | 修改 | 新增 intent/memory-save/memory-search mode，plan+execute 更新 |
| `src/hooks/useMemory.ts` | 新建 | 长期记忆 hook |
| `src/hooks/useEvodaoAgent.ts` | 修改 | Task.tools, runAgent memoryContext param |
| `src/pages/Index.tsx` | 修改 | useMemory, handleRun 内存搜索, handleComplete 保存 |
| `src/components/agent/GoalInput.tsx` | 修改 | 意图自动检测按钮 |
| `src/components/agent/MemoryContext.tsx` | 新建 | 记忆上下文显示组件 |
| `src/i18n/locales/zh.json` + `en.json` | 修改 | 新增 memory/intent/taskTools 命名空间 |

---

## Secret 需求

需要 `SUPABASE_SERVICE_ROLE_KEY`（在 Edge Function 中写入 DB 时使用 service role 绕过 RLS 的匿名限制）。  
但由于表已开启 public write policy，可直接使用 ANON_KEY + REST API，无需 service role。

---

## 验证

1. **意图识别**：输入 "写一段 Python 代码" → 自动检测为 `agent` 模式
2. **工具声明**：agent 模式规划时，LLM 在 tasks 中返回 `tools: ["code"]`，TaskList 显示工具标签
3. **记忆写入**：完成一次 text 模式运行 → `agent_memory` 表中出现新行
4. **记忆检索**：输入类似 goal → 执行前查到历史记录 → MemoryContext 组件显示
5. **跨会话记忆**：刷新页面后运行相似 goal → 仍能检索到上次结果

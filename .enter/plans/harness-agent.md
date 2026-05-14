# 历史记录跨设备共享计划

## 背景

当前 `useAgentHistory` 使用 `localStorage` 存储（key: `evodao-history`），仅本设备可见。需迁移至 Supabase，实现同账号跨设备共享。

---

## 数据结构

`HistoryEntry` 接口（来自 `useEvodaoAgent.ts`）：
```typescript
{
  id: string;                          // Date.now().toString()
  goal: string;
  tasks: Task[];
  taskOutputs: Record<number, string>; // 可能很大
  taskStatuses: Record<number, TaskStatus>;
  completedAt: number;                 // epoch ms
  outputMode?: OutputMode;
  extractedFiles?: AgentFile[];        // 含文件内容，可能很大
  evolutionRound?: number;
}
```

---

## 方案

### 1. DB 迁移

新建 `agent_history` 表：

```sql
CREATE TABLE agent_history (
  id           TEXT PRIMARY KEY,            -- HistoryEntry.id (Date.now())
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal         TEXT NOT NULL,
  tasks        JSONB NOT NULL DEFAULT '[]',
  task_outputs JSONB NOT NULL DEFAULT '{}',
  task_statuses JSONB NOT NULL DEFAULT '{}',
  completed_at BIGINT NOT NULL,
  output_mode  TEXT DEFAULT 'text',
  extracted_files JSONB DEFAULT '[]',
  evolution_round INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE agent_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_history" ON agent_history FOR ALL USING (auth.uid() = user_id);
```

### 2. `useAgentHistory.ts` 完全重写

- 引入 `useAuth` 获取 `profile.id`
- `isLoading` 状态 — 首次加载时为 true
- `fetchHistory()` — SELECT 前 20 条按 `completed_at DESC`，组装成 `HistoryEntry[]`
- `addEntry(entry)` — INSERT（`taskOutputs` 每条截断为 6000 chars 防超限，`extractedFiles` 仅存 path+language+taskId 不存 content）
- `removeEntry(id)` — DELETE by id
- `clearHistory()` — DELETE WHERE user_id
- **一次性 localStorage 迁移**：mount 时若 localStorage 有数据且 DB 为空 → 写入 DB → 清除 localStorage
- 用户未登录时：降级为 localStorage 行为（兼容性）

### 3. `HistoryPanel.tsx` 小改动

- 接收 `isLoading?: boolean` prop
- 列表为空且 `isLoading` 时显示 loading spinner 而非 "暂无历史" 空状态

### 4. `Index.tsx` 小改动

- 从 `useAgentHistory()` 取出 `isLoading`，传入 `<HistoryPanel>`

---

## 关键决策

| 决策 | 选择 | 原因 |
|------|------|------|
| `taskOutputs` 存储上限 | 每条 6000 chars | 防止单条记录过大；HistoryPanel 展示用量足够 |
| `extractedFiles` 存储 | 仅存 metadata (path/lang/taskId)，不存 content | 文件内容可重新生成，减少 DB 负担 |
| localStorage 向 DB 迁移 | 自动一次性迁移 | 用户无感知，历史不丢失 |
| 未登录时降级 | 继续用 localStorage | 确保非登录状态也可用 |

---

## 需要修改的文件

1. `supabase/migrations/migration_...` — 建表 + RLS
2. `src/hooks/useAgentHistory.ts` — 完全重写
3. `src/components/agent/HistoryPanel.tsx` — 加 `isLoading` prop + loading UI
4. `src/pages/Index.tsx` — 传 `isLoading` 到 HistoryPanel

**不需要修改：**
- `useEvodaoAgent.ts` — HistoryEntry 定义不变
- `src/integrations/supabase/types.ts` — 使用 `any` 类型断言操作新表

---

## 验证

1. 同账号 A 设备运行一次 → 历史面板显示该条记录
2. 同账号 B 设备登录 → 历史面板同样显示该条记录
3. 删除/清空 → 两端同步消失
4. 未登录时 → 历史仍可本地使用

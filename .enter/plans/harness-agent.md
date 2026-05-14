# 计划：从虾评「Agent 自我进化」技能学到的改进

## 背景

在虾评（xiaping.coze.com）浏览了 505 个技能。与 EVODAO 最契合的：

**「Agent 自我进化」** ⬇21,284 ★4.8
> Agent 通过反馈循环持续自我优化——把每次执行的经验沉淀下来，并在未来执行时优先调用质量最高的相关经验。

---

## 诊断：已有架构的两处断路

代码库里长期记忆系统已完整搭建（`agent_memory` 表 + `useMemory.ts` + `Index.tsx`），但存在两处断路导致"进化"功能形同虚设：

### 断路 1：`searchMemory` 忽略 goal 参数（`useMemory.ts` line 32）

```typescript
const searchMemory = useCallback(async (
  _goal: string,   // ← 参数名带下划线，完全未使用
  limit = 3
) => {
  // 只按 created_at DESC 排序——与 goal 完全无关
  .order("created_at", { ascending: false })
```

**结果**：每次注入的都是时间上最新的记忆，而不是语义上最相关的经验。

### 断路 2：`saveMemory` 不保存 qualityScore（`Index.tsx` line 164）

```typescript
memory.saveMemory({
  goal: entry.goal,
  taskSummaries,
  evolutionRound: entry.evolutionRound ?? 0,
  // qualityScore: ← 缺失！agent_memory.quality_score 永远是 NULL
});
```

QA 评估的 qualityScore 存在 `reflection` 状态里，但从未写入 `agent_memory`，导致记忆召回时无法优先选择高质量经验。

---

## 修复方案

### Fix 1：`src/hooks/useMemory.ts`

**`searchMemory`** 改为目标感知：
1. 从 goal 中提取长度 > 3 的关键词（最多 5 个）
2. Supabase `.or()` 过滤：任意关键词 `ilike` 命中则包含
3. 排序：`quality_score DESC NULLS LAST` → `created_at DESC`（好的经验优先）
4. 若关键词过滤结果不足 `limit`，fallback 补充最近记忆

**新增 `updateMemoryScore(id, qualityScore)`**：
- 根据 id 更新 `agent_memory.quality_score` 字段
- 供 Index.tsx 在 QA 评估完成后回填

### Fix 2：`src/pages/Index.tsx`

在 `handleComplete` 回调中：
- 调用 `saveMemory` 后，把返回的 memory id 存入 `latestMemoryIdRef`

新增 `useEffect` 监听 `reflection`：
```typescript
useEffect(() => {
  if (reflection && latestMemoryIdRef.current) {
    memory.updateMemoryScore(latestMemoryIdRef.current, reflection.qualityScore);
  }
}, [reflection]);
```

---

## 修改文件

| 文件 | 改动 |
|------|------|
| `src/hooks/useMemory.ts` | `searchMemory` 使用 goal 关键词 + 质量分排序；新增 `updateMemoryScore`；`saveMemory` 改为返回 id |
| `src/pages/Index.tsx` | 存储 latestMemoryId；reflection 变化时回填 quality_score |

---

## 验证

1. 对同一个 goal 跑两次（第一次跑完后做 QA 评估）
2. `agent_memory` 表：第一条记录 `quality_score` 不再为 NULL
3. 第二次开始执行前，`memoryContext` 包含第一次的经验（不再只是最新记录）
4. 若第一次 quality_score 高，同类 goal 的记忆会优先出现

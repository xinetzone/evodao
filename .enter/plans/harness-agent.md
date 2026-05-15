# 用量统计 Token 追踪修复

## Context

用量面板显示骨架屏、所有数据库行 `total_tokens = 0`。

根本原因：OpenAI 格式（含 `stream_options: { include_usage: true }`）流式响应顺序如下：
```
data: {"choices":[{"delta":{},"finish_reason":"stop"}]}   ← settle 在这里触发！
data: {"usage":{"prompt_tokens":X,...}}                   ← 被 abort，永远收不到
data: [DONE]                                              ← 被 abort
```
当前代码在 `finish_reason` 时调用 `settle(() => resolve())`，内部调用 `controller.abort()`，
导致 usage chunk 永远无法到达 → `sessionUsage.totalTokens` 始终为 0。

连锁效应：
- `sessionUsage.totalTokens > runStartUsage.totalTokens` 永远为 false
- `finalizeUsage` 不被调用 → DB 行保持 0 tokens
- `statsRefreshKey` 不递增 → 用量面板不自动刷新

## Files to Modify

- `src/hooks/useEvodaoAgent.ts` — 两处流式处理（QA 模式 ~714行，text/agent 模式 ~421行）
- `src/components/agent/UsagePanel.tsx` — useEffect 缺少 fetchStats 依赖

## Changes

### 1. `useEvodaoAgent.ts` — 移除 `finish_reason` 上的 settle（两处）

**text/agent 模式**（约 421 行）：
```typescript
// BEFORE:
if (choice.finish_reason) settle(() => resolve());

// AFTER: 不在这里 settle，等 [DONE] 或 onclose
// (删除这行)
```

**QA 模式**（约 744 行）：
```typescript
// BEFORE:
if (choice.finish_reason) settle(() => resolve());

// AFTER: 删除（同上）
```

理由：`[DONE]` 事件和 `onclose` 回调已经足够处理所有终止情形：
- 模型发 `finish_reason` → usage → `[DONE]` → 在 `[DONE]` settle ✓
- 模型发 `finish_reason` → `[DONE]`（无 usage）→ 在 `[DONE]` settle ✓
- 服务器直接关闭连接（无 `[DONE]`）→ `onclose` settle ✓

### 2. `UsagePanel.tsx` — 将 `fetchStats` 加入 useEffect 依赖

```typescript
// BEFORE:
useEffect(() => {
  if (open) fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, refreshKey]);

// AFTER:
useEffect(() => {
  if (open) fetchStats();
}, [open, refreshKey, fetchStats]);
```

理由：`fetchStats` 的 useCallback 依赖 `userId`，当 auth 晚于面板打开时加载，
必须通过 fetchStats 引用变更来触发重新执行。

## Verification

1. 发送 QA 提问 → 等待回答完成 → 打开用量面板
2. 应看到 `Tokens` 字段显示非零值（而不是 0）
3. 关闭面板再打开，数据应立即加载（不卡在骨架屏）
4. `usage_logs` 表中对应行应有 `total_tokens > 0`

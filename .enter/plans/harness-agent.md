# Token 管理方案（非管理员用户）

## Context
在现有的运行次数配额基础上，为非管理员用户增加 **Token 消耗追踪与限制**：
- 每次 LLM 调用结束后将实际 token 数持久化到数据库
- 管理员可在配额后台设置每日/每月 token 上限
- 超出 token 配额时复用现有 `QuotaExceededModal`

同时修复已有隐患：`useAuth.ts` 的 `fetchProfile` 只查了 `id, email, is_admin, created_at`，导致现有的运行次数配额字段（`daily_run_limit` 等）从未真正生效——需要同步补齐。

---

## 1. 数据库 Migration（合并执行）

```sql
-- profiles 新增 token 配额字段
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS daily_token_limit integer,    -- NULL = 无限制
  ADD COLUMN IF NOT EXISTS monthly_token_limit integer;  -- NULL = 无限制

-- usage_logs 新增 token 实际用量字段
ALTER TABLE usage_logs
  ADD COLUMN IF NOT EXISTS prompt_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_tokens integer NOT NULL DEFAULT 0;
```

---

## 2. 修改文件

### `src/hooks/useAuth.ts`
**重要 bug 修复**：`fetchProfile` 补全所有配额字段查询，否则 quota 检查永远不会生效（profile 对象缺少字段 → 值为 undefined → 松散比较 `undefined != null` 为 false → 跳过检查）。

```diff
- .select("id, email, is_admin, created_at")
+ .select("id, email, is_admin, created_at, daily_run_limit, daily_image_limit, monthly_run_limit, daily_token_limit, monthly_token_limit")
```

同时更新 `Profile` interface 新增字段。

---

### `src/hooks/useUsageQuota.ts`

1. **`QuotaCheckResult.reason`** 扩展新类型：`"daily_token" | "monthly_token"`

2. **`checkQuota`** 增加两项 token 检查（在现有次数检查之后）：
   ```typescript
   // 今日 token 上限（仅 LLM 模式，image 无 token 计量）
   if (outputMode !== "image" && p.daily_token_limit != null) {
     const { data } = await supabase.from("usage_logs")
       .select("total_tokens").eq("user_id", uid).gte("created_at", todayStart);
     const used = data?.reduce((s, r) => s + r.total_tokens, 0) ?? 0;
     if (used >= p.daily_token_limit) return { allowed: false, reason: "daily_token", used, limit: p.daily_token_limit };
   }
   // 本月 token 上限
   if (p.monthly_token_limit != null) { /* 同上，改 monthStart */ }
   ```

3. **`recordUsage`** 改为 **返回 `logId: string | null`**（insert 后返回新行 id）：
   ```typescript
   const { data } = await supabase.from("usage_logs")
     .insert({ user_id, output_mode }).select("id").single();
   return data?.id ?? null;
   ```

4. **新函数 `finalizeUsage(logId, tokens)`**：运行结束后更新 token 数：
   ```typescript
   await supabase.from("usage_logs").update({
     prompt_tokens, completion_tokens, total_tokens
   }).eq("id", logId);
   ```

---

### `src/pages/Index.tsx`

1. 新增 state：`const [pendingLogId, setPendingLogId] = useState<string | null>(null)`

2. `onRun` 中保存 logId：
   ```typescript
   const logId = await recordUsage(mode);
   setPendingLogId(logId);
   ```

3. `handleComplete` 中写入 token（复用已有的 `sessionUsage`）：
   ```typescript
   if (pendingLogId && sessionUsage.totalTokens > 0) {
     await finalizeUsage(pendingLogId, sessionUsage);
     setPendingLogId(null);
   }
   ```
   > `handleComplete` 需改为 `async` 函数或在 callback 内 fire-and-forget。

---

### `src/components/quota/QuotaExceededModal.tsx`
新增两个 reason 的文案映射：
```typescript
"daily_token"   → t("quota.dailyTokenExceeded", { used, limit })
"monthly_token" → t("quota.monthlyTokenExceeded", { used, limit })
```
进度条单位改为 `K tokens`（除以 1000）。

---

### `src/pages/Admin.tsx`（配额管理 Tab）

1. `UserRow` interface 新增：`daily_token_limit`, `monthly_token_limit`
2. `QuotaField` 类型扩展这两个字段
3. 表头新增两列：**每日 Token** / **每月 Token**（与现有格子同样可 inline 编辑）
4. `fetchMonthlyUsage` 改为同时汇总 token 总量：
   ```typescript
   const tokenCounts: Record<string, number> = {};
   for (const row of data) {
     tokenCounts[row.user_id] = (tokenCounts[row.user_id] ?? 0) + row.total_tokens;
   }
   setMonthlyTokenUsage(tokenCounts);
   ```
5. "本月已用" 列显示：`{runs} 次 / {tokens}K tokens`

---

### i18n（`zh.json` + `en.json`）

```json
// quota 命名空间补充
"dailyTokenExceeded": "今日 Token 用量（{{used}}/{{limit}}）已超限",
"monthlyTokenExceeded": "本月 Token 用量（{{used}}/{{limit}}）已超限",

// admin 命名空间补充
"dailyToken": "每日Token",
"monthlyToken": "每月Token",
"totalTokensMonth": "本月Token"
```

---

## 3. 关键文件路径

| 操作 | 文件 |
|---|---|
| 新建 Migration | `supabase/migrations/migration_token_*` |
| 修改 | `src/hooks/useAuth.ts` |
| 修改 | `src/hooks/useUsageQuota.ts` |
| 修改 | `src/components/quota/QuotaExceededModal.tsx` |
| 修改 | `src/pages/Index.tsx` |
| 修改 | `src/pages/Admin.tsx` |
| 修改 | `src/i18n/locales/zh.json` + `en.json` |

---

## 4. 验证

1. 管理员在配额后台设置某用户 `daily_token_limit = 1000`
2. 用户运行一次较大任务（输出 > 1000 tokens）
3. 再次运行 → Modal 显示 Token 超限
4. 检查 `usage_logs` 表 → `total_tokens` 已写入
5. 配额管理 Tab → "本月Token" 列显示正确累计值
6. `daily_run_limit` 等旧配额字段也能正常生效（bug 修复验证）

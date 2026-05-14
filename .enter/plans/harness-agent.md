# 非管理员用户配额限制方案

## Context
非管理员用户需要受到使用次数限制。管理员在后台可为每位用户独立设定配额；达到上限时弹出 Modal 提示。管理员账号不受任何限制。

---

## 1. 数据库层

### Migration

**`profiles` 表新增配额字段：**
```sql
ALTER TABLE profiles
  ADD COLUMN daily_run_limit integer,      -- 每日任务/构建/问答 上限，NULL=无限制
  ADD COLUMN daily_image_limit integer,    -- 每日图像生成上限，NULL=无限制
  ADD COLUMN monthly_run_limit integer;    -- 每月全模式总上限，NULL=无限制
```

**新建 `usage_logs` 表（记录每次调用）：**
```sql
CREATE TABLE usage_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  output_mode text NOT NULL,         -- 'text'|'agent'|'qa'|'image'
  created_at timestamptz DEFAULT now()
);
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- 用户只能读写自己的日志
CREATE POLICY "own_logs" ON usage_logs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 管理员可读全部
CREATE POLICY "admin_read_all" ON usage_logs
  FOR SELECT USING (is_admin_user());
```

---

## 2. 新增文件

### `src/hooks/useUsageQuota.ts`
负责配额检查与使用记录。

```typescript
interface QuotaCheckResult {
  allowed: boolean;
  reason?: "daily_run" | "daily_image" | "monthly";
  used: number;
  limit: number;
}

// 核心函数
async function checkQuota(outputMode: OutputMode): Promise<QuotaCheckResult>
async function recordUsage(outputMode: OutputMode): Promise<void>
```

逻辑：
1. **管理员直接放行**（profile.is_admin === true）
2. 查 `usage_logs`：
   - 今日非 image 次数 vs `daily_run_limit`（outputMode !== "image" 时检查）
   - 今日 image 次数 vs `daily_image_limit`（outputMode === "image" 时检查）
   - 本月全模式总次数 vs `monthly_run_limit`（任何 mode 都检查）
3. 任一超限返回 `allowed: false` + reason

### `src/components/quota/QuotaExceededModal.tsx`
当配额超限时显示的提示 Modal。

内容：
- 标题：已达使用上限
- 说明：今日/本月已用 N 次，上限为 M 次
- 区分原因（daily_run / daily_image / monthly）
- 提示联系管理员
- 关闭按钮

---

## 3. 修改文件

### `src/pages/Index.tsx`
在 `onRun` 回调中添加配额检查，run 成功后记录用量：

```typescript
// onRun 前
const result = await checkQuota(mode);
if (!result.allowed) {
  setQuotaExceeded(result);   // 触发 Modal
  return;
}

// run 后（agent/image 均调用）
await recordUsage(mode);
```

引入 `<QuotaExceededModal>` 组件。

### `src/pages/Admin.tsx`
新增 **"配额管理"** Tab（第三个 Tab），包含：

- 复用现有 users 列表
- 每行显示：邮箱 / 注册时间 / `daily_run_limit` / `daily_image_limit` / `monthly_run_limit`
- 点击数字直接 inline 编辑，失焦保存
- NULL 值显示为 `∞`（无限制）
- 本月用量显示在配额旁（只读统计）

新增图标：`Gauge` from lucide-react

### `src/i18n/locales/zh.json` & `en.json`
新增 `quota` 命名空间：

```json
"quota": {
  "exceeded": "已达使用上限",
  "dailyRunExceeded": "今日执行次数（{{used}}/{{limit}}）已用完",
  "dailyImageExceeded": "今日图像生成次数（{{used}}/{{limit}}）已用完",
  "monthlyExceeded": "本月使用次数（{{used}}/{{limit}}）已用完",
  "contactAdmin": "请联系管理员调整配额",
  "close": "知道了",
  "tab": "配额管理",
  "dailyRun": "每日执行",
  "dailyImage": "每日图像",
  "monthly": "每月总量",
  "unlimited": "∞",
  "thisMonthUsed": "本月已用"
}
```

---

## 4. 关键文件路径

| 操作 | 文件 |
|---|---|
| 新建 | `supabase/migrations/migration_quota_*` |
| 新建 | `src/hooks/useUsageQuota.ts` |
| 新建 | `src/components/quota/QuotaExceededModal.tsx` |
| 修改 | `src/pages/Index.tsx` |
| 修改 | `src/pages/Admin.tsx` |
| 修改 | `src/i18n/locales/zh.json` |
| 修改 | `src/i18n/locales/en.json` |

---

## 5. 验证

1. 以管理员设置某用户 `daily_run_limit = 1`
2. 用该用户执行一次任务 → 成功
3. 再次执行 → Modal 弹出，显示已用 1/1
4. 管理员账号执行 → 直接通过，无 Modal
5. 管理员后台配额 Tab → 能 inline 编辑数值并保存
6. NULL 值（无限制）用户 → 永远不弹 Modal

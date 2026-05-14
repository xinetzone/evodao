# EVODAO 数据库 Schema

> 本文档根据 `src/integrations/supabase/types.ts` 及 `supabase/migrations/` 整理  
> 数据库：Supabase (PostgreSQL 15)

---

## 表总览

| 表名 | 用途 | RLS |
|------|------|-----|
| `profiles` | 用户资料、权限、配额、订阅状态 | 启用 |
| `usage_logs` | 每次执行记录（次数计量 + Token 计量） | 启用 |
| `agent_memory` | Agent 长期记忆存储 | 启用（公开） |

---

## Table: `profiles`

主键：`id uuid`（与 `auth.users.id` 一对一关联）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | uuid | — | 主键，关联 auth.users(id)，级联删除 |
| `email` | text | null | 用户邮箱（冗余存储，方便管理员查看） |
| `is_admin` | boolean | false | 是否为管理员 |
| `created_at` | timestamptz | now() | 创建时间 |
| `daily_run_limit` | integer | null | 每日执行次数上限（null = 不限制） |
| `daily_image_limit` | integer | null | 每日图像生成次数上限 |
| `monthly_run_limit` | integer | null | 每月总执行次数上限 |
| `daily_token_limit` | integer | null | 每日 Token 消耗上限 |
| `monthly_token_limit` | integer | null | 每月 Token 消耗上限 |
| `subscription_plan` | text | null | 当前套餐（'basic' \| 'pro' \| null） |
| `subscription_status` | text | null | 订阅状态（'active' \| 'cancelled' \| null） |

### RLS 策略

```sql
-- 用户只能读写自己的 profile
CREATE POLICY "users_own" ON profiles FOR ALL
  USING (auth.uid() = id);

-- 管理员可读全部（通过 SECURITY DEFINER 函数避免递归）
CREATE POLICY "admins_read_all" ON profiles FOR SELECT
  USING (is_admin_user());
```

### 触发器

```sql
-- 新用户注册时自动创建 profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_profile_on_signup();

-- 函数（关键：SET search_path = public 防止 auth schema 找不到表）
CREATE OR REPLACE FUNCTION create_profile_on_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
```

### 套餐预设配额

| 套餐 | daily_run | daily_image | monthly_run | daily_token | monthly_token |
|------|-----------|-------------|-------------|-------------|---------------|
| basic | 50 | 30 | 200 | 300,000 | 5,000,000 |
| pro | 200 | 100 | 1,000 | 1,000,000 | 20,000,000 |

---

## Table: `usage_logs`

记录每次 Agent 执行的使用情况（次数 + Token 消耗）。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | uuid | gen_random_uuid() | 主键 |
| `user_id` | uuid | — | 外键 → profiles(id)，级联删除 |
| `output_mode` | text | — | 执行模式：'text' \| 'build' \| 'qa' \| 'image' |
| `prompt_tokens` | integer | 0 | 输入 Token 数（执行完成后更新） |
| `completion_tokens` | integer | 0 | 输出 Token 数（执行完成后更新） |
| `total_tokens` | integer | 0 | 总 Token 数（执行完成后更新） |
| `created_at` | timestamptz | now() | 创建时间（执行开始时） |

### 写入时序

```
1. 执行开始：INSERT (output_mode, user_id)  → tokens 默认 0
   recordUsage() 返回 logId

2. 执行结束：UPDATE SET prompt_tokens=x, completion_tokens=y, total_tokens=z
   finalizeUsage(logId, sessionUsage) 在 status==="done" 时触发
```

### RLS 策略

```sql
CREATE POLICY "own_logs" ON usage_logs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin_read_all" ON usage_logs
  FOR SELECT USING (is_admin_user());
```

### 索引

```sql
CREATE INDEX usage_logs_user_created ON usage_logs (user_id, created_at);
```

---

## Table: `agent_memory`

存储每次 Agent 执行后提取的任务摘要，用于后续会话的长期记忆检索。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | uuid | gen_random_uuid() | 主键 |
| `goal` | text | — | 用户的原始目标描述 |
| `output_mode` | text | 'text' | 执行模式 |
| `task_summaries` | text | '' | 各子任务输出摘要（拼接文本，每任务前 200 字） |
| `quality_score` | integer | null | AI 自评质量分（0-100，进化反思中给出） |
| `evolution_round` | integer | 0 | 执行时的进化轮次 |
| `created_at` | timestamptz | now() | 创建时间 |

### RLS 策略

```sql
-- 公开策略（当前所有用户共享记忆池）
CREATE POLICY "public_all" ON agent_memory FOR ALL
  USING (true) WITH CHECK (true);
```

> 注：当前记忆为全局共享，未做用户隔离。未来规划添加 `user_id` 字段实现个人记忆隔离。

---

## 辅助函数

### `is_admin_user()`

```sql
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;
```

用途：在 RLS 策略中安全检查当前用户是否为管理员，避免 policies 递归调用 `profiles` 触发自身 RLS 导致死锁。

---

## 迁移历史

| 文件 | 内容 |
|------|------|
| `migration_20260514_062342000` | 创建 agent_memory 表 |
| `migration_20260514_065533000` | 创建 profiles 表、RLS、触发器 |
| `migration_20260514_070511000` | 修复触发器 search_path |
| `migration_20260514_071107000` | 设置初始管理员账户 |
| `migration_20260514_072921000` | profiles 添加配额字段；创建 usage_logs 表 |
| `migration_20260514_073911000` | profiles 添加 token 配额；usage_logs 添加 token 列 |
| `migration_20260514_084813000` | profiles 添加订阅字段（subscription_plan/status） |

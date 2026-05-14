# 非管理员用户支付订阅 & 配额自动绑定

## Context
当前系统通过 `profiles` 表存储手动配额，管理员在 Admin 页面为每个用户逐一设置。  
需求：接入 Stripe 订阅，非管理员用户可自助购买套餐，付费成功后系统自动更新其配额。  
入口：配额超限弹窗内 + 用户菜单（两处）。2个套餐：基础版 / 专业版。

---

## 套餐设计

| 字段 | 基础版 (Basic) | 专业版 (Pro) |
|------|---------------|-------------|
| daily_run_limit | 50 | 200 |
| daily_image_limit | 30 | 100 |
| monthly_run_limit | 200 | 1000 |
| daily_token_limit | 300,000 | 1,000,000 |
| monthly_token_limit | 5,000,000 | 20,000,000 |
| 订阅状态 | active | active |

取消订阅后：subscription_plan → null，subscription_status → 'cancelled'，配额字段置 null（等管理员手动介入）。

---

## 实现步骤

### Step 1 — Stripe 接入
- 调用 `stripe_enable` 工具连接 Stripe（需用户提供 sk_test_* / sk_live_* 密钥）
- 调用 `stripe_create_products_and_prices` 创建 2 个月付订阅产品，记录返回的 price ID

### Step 2 — DB Migration
`ALTER TABLE profiles ADD COLUMN stripe_customer_id text, subscription_plan text, subscription_status text;`

并更新 `fetchProfile` 的 select + Profile interface。

**关键文件:** `src/hooks/useAuth.ts`

### Step 3 — Edge Functions

#### `create-checkout-session` (更新已部署版本)
- 输入：`{ priceId, userId, successUrl, cancelUrl }`
- 逻辑：查 profiles.stripe_customer_id → 若无则调 Stripe API 创建 customer → 创建 `mode: 'subscription'` Checkout Session
- 输出：`{ url }`

#### `stripe-webhook` (新建)
- 需要 `STRIPE_WEBHOOK_SECRET`（via `supabase_add_secret`，在 Stripe Dashboard 注册 webhook endpoint 后获取）
- 处理事件：
  - `checkout.session.completed` → 保存 customer_id 到 profiles
  - `customer.subscription.created` / `customer.subscription.updated` → 根据 price ID 识别 plan → 写入 subscription_plan, subscription_status = 'active' → 应用对应配额预设
  - `customer.subscription.deleted` → subscription_plan = null, subscription_status = 'cancelled', 配额字段全置 null

**注意：** webhook 注册流程：
1. 先部署 edge function 获得 URL：`https://<project>.supabase.co/functions/v1/stripe-webhook`
2. 在 Stripe Dashboard → Webhooks 中注册该 URL，复制 Signing Secret
3. 通过 `supabase_add_secret` 保存 `STRIPE_WEBHOOK_SECRET`

### Step 4 — `useSubscription` Hook (新建)
`src/hooks/useSubscription.ts`
- `openCheckout(plan: 'basic' | 'pro')` — 调用 edge function → redirect 到 Stripe Checkout
- `isSubscribed`: boolean (status === 'active')
- `currentPlan`: 'basic' | 'pro' | null

### Step 5 — `PricingModal` Component (新建)
`src/components/pricing/PricingModal.tsx`
- 两列套餐卡片，列出配额对比
- 基础版 / 专业版各有"立即订阅"按钮 → 调 `openCheckout`
- 当前已订阅套餐显示"当前套餐"badge，不可重复购买
- 关闭按钮

### Step 6 — 集成到现有 UI

#### `QuotaExceededModal.tsx` (修改)
- 新增 Props: `onUpgrade?: () => void`
- Footer 从 1 个关闭按钮变为 2 个：
  - 左："关闭" (ghost)
  - 右："升级套餐 →" (primary)，点击调 `onUpgrade`
- `Index.tsx` 中传入 `onUpgrade={() => setPricingOpen(true)}`

#### `AgentHeader.tsx` (修改)
- 用户菜单 Profile Header 中：
  - 非管理员且已订阅：显示套餐名 badge（如"BASIC" / "PRO"），替换"USER"文字
  - 非管理员未订阅：用户菜单中 Admin 按钮下方加"升级套餐"按钮 → opens PricingModal
- 导入 `PricingModal` 到 `AgentHeader` 并在内部管理 `pricingOpen` 状态

#### `Index.tsx` (修改)
- 检测 `?subscription=success` query param → 显示成功 Toast
- 传 `onUpgrade` 到 `QuotaExceededModal`

### Step 7 — i18n
两个 locale 文件新增 keys:
```json
"pricing": {
  "title": "升级您的套餐",
  "basicName": "基础版",
  "proName": "专业版",
  "perMonth": "/月",
  "subscribe": "立即订阅",
  "currentPlan": "当前套餐",
  "upgradeNow": "升级套餐",
  "successTitle": "订阅成功",
  "successMessage": "套餐已激活，配额已自动更新",
  "cancel": "取消"
}
```

### Step 8 — Admin.tsx (修改)
- UserRow 增加 `stripe_customer_id`, `subscription_plan`, `subscription_status`
- 配额管理 Tab 用户列增加"套餐"列，显示 subscription_plan / subscription_status
- fetchUsers select 增加这 3 个字段

---

## 关键文件列表

| 文件 | 操作 |
|------|------|
| `supabase/migrations/xxx` | 新建 - DB 列 |
| `supabase/functions/create-checkout-session/index.ts` | 更新 - subscription 模式 |
| `supabase/functions/stripe-webhook/index.ts` | 新建 |
| `src/hooks/useAuth.ts` | 修改 - Profile interface + fetchProfile |
| `src/hooks/useSubscription.ts` | 新建 |
| `src/components/pricing/PricingModal.tsx` | 新建 |
| `src/components/quota/QuotaExceededModal.tsx` | 修改 - 加升级按钮 |
| `src/components/agent/AgentHeader.tsx` | 修改 - 套餐 badge + 升级入口 |
| `src/pages/Index.tsx` | 修改 - 成功检测 + PricingModal |
| `src/pages/Admin.tsx` | 修改 - 套餐列显示 |
| `src/i18n/locales/zh.json` + `en.json` | 修改 - pricing keys |

---

## 实现顺序

1. `stripe_enable` → 等待 Stripe 密钥
2. `stripe_create_products_and_prices` → 获得 price IDs
3. DB Migration
4. 更新 create-checkout-session
5. 部署 stripe-webhook
6. supabase_add_secret STRIPE_WEBHOOK_SECRET
7. useAuth.ts
8. useSubscription.ts
9. PricingModal.tsx
10. 修改 QuotaExceededModal + AgentHeader + Index + Admin
11. i18n

---

## 验证
- 以非管理员用户触发配额超限 → 弹窗出现"升级套餐"按钮
- 点击"升级套餐" → PricingModal 显示两个套餐
- 点击"立即订阅（基础版）"→ 跳转 Stripe Checkout（test mode 使用 4242 4242 测试卡）
- 支付完成 → 跳回 `/?subscription=success` → 显示成功 Toast
- 检查 profiles 表：subscription_plan='basic', subscription_status='active', 5 个 quota 字段被自动写入
- 用户菜单显示 "BASIC" badge
- 取消订阅 → profiles 中 status='cancelled', 配额清空

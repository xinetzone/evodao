# EVODAO 项目全面复盘报告

> 报告生成日期：2026-05-14  
> 项目地址：https://enter.pro/project/8f02c91ef0784272997f9a04c5d2fd3f  
> 预览地址：https://8f02c91ef0784272997f9a04c5d2fd3f-latest.preview.enter.pro

---

## 1. 项目概述

**EVODAO** 是一个基于 AI 的多模态智能代理平台，允许用户通过自然语言描述任务目标，由 AI 代理自动将其拆解为并行子任务并执行，支持文本生成、代码构建、图像生成和问答四种输出模式。

### 核心价值
- **自动规划**：AI 将复杂目标分解为具体可执行子任务
- **并行执行**：多任务同步进行，效率最大化
- **自我进化**：任务完成后进行自我反思并优化，支持多轮进化
- **多模态**：不仅输出文字，还能生成代码项目文件和图像
- **长期记忆**：跨会话记忆沉淀，提升上下文理解

### 技术栈
| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + Vite + TypeScript |
| UI 组件 | shadcn/ui + Tailwind CSS |
| 路由 | React Router v6 |
| 国际化 | i18next（中/英双语） |
| 后端 | Supabase (PostgreSQL + Auth + Edge Functions) |
| AI 服务 | Enter AI All（支持 OpenAI / Anthropic / Google 等多模型） |
| 代码规范 | ESLint + TypeScript strict |

---

## 2. 开发时间线

### 阶段一：基础架构（2026-04-14 初始化 → 2026-05-12 早期功能）

| Commit | 说明 |
|--------|------|
| `528184a` | Initial commit - 项目初始化（Vite + React + Tailwind + shadcn） |
| `d444585` | feat: 接入 AI Harness Agent 核心，实现基础 SSE 流式对话 |
| `4d1455d` | feat(i18n): 国际化框架搭建（中/英双语） |
| `5bd138d` | feat: Enter 键执行、Shift+Enter 换行 |
| `776ddd6` | feat: 会话持久化与恢复功能（localStorage） |
| `6bccf7e` | feat: 历史会话面板 |
| `c4926cf` | feat(export): Markdown 导出 |
| `f230f87` | feat: Agent 构建模式（文件提取 + ZIP 导出） |
| `50bcb5a` | feat: Agent 自我反思与进化机制 |
| `acf93f0` | feat(qa): Q&A 问答模式 |
| `65c9d1e` | feat: Token 用量实时追踪显示 |

### 阶段二：功能扩展（2026-05-12 中期）

| Commit | 说明 |
|--------|------|
| `133d98a` | feat: AI 智能 Prompt 建议与优化 |
| `f57bd92` | feat: AI 模型选择器（多模型切换） |
| `7874d9b` | feat: 并行任务执行引擎重构 |
| `a50bb5d` | feat: 并发任务管理器（TaskManager） |
| `407a34a` | refactor: 项目重命名为 EVODAO |
| `52fcf3c` | feat: Prompt 优化与建议系统完善 |
| `2cd7520` | feat: 新增 GPT 5.4 Pro 模型 |
| `a6dfc03` | feat: 新增 Claude Opus 4.7 模型 |
| `567bc99` | feat: 新增 Claude Opus 4.6 模型 |
| `91056f2` | feat(image-gen): 图像生成模式完整实现 |
| `ec54065` | feat: 图像模型选择支持 |
| `5eba5e5` | feat: 新增豆包 SeedDream 4.5 图像模型 |
| `c98f8cc` | feat: 图像生成错误处理与 UI 优化 |
| `8b3a368` | feat: 任务依赖管理（DAG 任务图） |

### 阶段三：系统化（2026-05-14）

| Commit | 说明 |
|--------|------|
| `9f939e9` | feat: 长期记忆系统 + 意图检测 |
| `96eadd7` | feat: Coze 平台架构集成 |
| `90d5369` | feat: 用户认证系统 + 管理员后台 |
| `bb650d7` | fix: DB 触发器 search_path 修复 |
| `9d7645a` | fix: 自动确认邮箱注册跳转逻辑修复 |
| `3181679` | style: 空闲状态 UI 优化（同心圆动画） |
| `3f3c720` | fix: header z-index 堆叠上下文修复 |
| `4aff8ad` | feat(ui): 图像模型下拉选择器 |
| `5342bef` | feat(quota): 用量配额系统（运行次数 + 图像次数 + 月度限制） |
| `b96b391` | feat(quota): Token 用量配额 + 配额计量修复 |
| `078b6d1` | feat(pricing): 套餐订阅架构（基础版/专业版）+ 管理员一键激活 |

---

## 3. 系统架构

### 3.1 前端架构

```
src/
├── pages/
│   ├── Index.tsx          # 主应用页（Agent 执行界面）
│   ├── Admin.tsx          # 管理员后台（用户/记忆/配额管理）
│   ├── Auth.tsx           # 登录/注册页
│   └── NotFound.tsx       # 404
├── components/
│   ├── agent/             # Agent 核心 UI 组件
│   │   ├── AgentHeader.tsx     # 顶部导航（模型显示、用户菜单）
│   │   ├── GoalInput.tsx       # 目标输入框（模式切换、提交）
│   │   ├── TaskList.tsx        # 任务列表（DAG 可视化）
│   │   ├── TerminalOutput.tsx  # 流式输出终端
│   │   ├── ImageOutput.tsx     # 图像生成结果展示
│   │   ├── QAOutput.tsx        # Q&A 对话界面
│   │   ├── EvolutionPanel.tsx  # 自我进化面板
│   │   ├── HistoryPanel.tsx    # 历史会话面板
│   │   ├── TaskManagerPanel.tsx # 任务管理器面板
│   │   ├── MemoryContext.tsx   # 记忆上下文显示
│   │   ├── ModelSelector.tsx   # AI 模型选择器
│   │   └── ExportActions.tsx   # 导出（Markdown/ZIP）
│   ├── pricing/
│   │   └── PricingModal.tsx    # 套餐选择弹窗
│   ├── quota/
│   │   └── QuotaExceededModal.tsx # 配额超限弹窗
│   └── auth/
│       ├── ProtectedRoute.tsx  # 登录保护路由
│       └── AdminRoute.tsx      # 管理员保护路由
├── hooks/
│   ├── useEvodaoAgent.ts  # 核心 Agent 逻辑（SSE、任务调度、状态管理）
│   ├── useAuth.ts         # 认证状态管理
│   ├── useUsageQuota.ts   # 配额检查与记录
│   ├── useAIImage.ts      # 图像生成轮询
│   ├── useAgentHistory.ts # 历史会话
│   ├── useTaskManager.ts  # 任务管理器
│   └── useMemory.ts       # 长期记忆（向量检索）
├── lib/
│   ├── agentCore.ts       # Agent 核心算法（任务规划、执行循环）
│   ├── planConfig.ts      # 套餐配额预设
│   ├── models.ts          # 模型配置列表
│   ├── exportUtils.ts     # 导出工具函数
│   └── config.ts          # 环境配置
└── i18n/locales/
    ├── zh.json            # 中文翻译
    └── en.json            # 英文翻译
```

### 3.2 后端架构

```
supabase/functions/
├── harness-agent/         # 核心 Agent 执行 Edge Function
│   └── index.ts           # SSE 流式输出，任务规划与执行
├── ai-image-submit-*/     # 图像生成提交 Edge Function
│   └── index.ts
└── ai-image-status-*/     # 图像生成状态轮询 Edge Function
    └── index.ts
```

### 3.3 数据流

```
用户输入 Goal
    │
    ▼
checkQuota() ─── 超限 ──► QuotaExceededModal → PricingModal
    │ 通过
    ▼
recordUsage() → usage_logs (row inserted, tokens=0)
    │
    ▼
harness-agent Edge Function (SSE 流)
    │   ├─ 规划阶段：LLM 将 Goal 拆解为 N 个子任务
    │   ├─ 执行阶段：并行调用 LLM 执行每个子任务
    │   └─ 进化阶段（可选）：反思结果，生成改进方案
    │
    ▼
handleComplete() → history.addEntry() + memory.saveMemory()
    │
    ▼
finalizeUsage(logId, {promptTokens, completionTokens, totalTokens})
→ UPDATE usage_logs SET total_tokens = ...
```

---

## 4. 已实现功能清单

### 4.1 Agent 核心能力

| 功能 | 状态 | 说明 |
|------|------|------|
| 目标输入与提交 | ✅ | 支持 Enter 提交、Shift+Enter 换行、多行文本 |
| 任务自动规划 | ✅ | LLM 将目标拆解为可并行执行的子任务列表 |
| 并行任务执行 | ✅ | 多个任务同时执行，独立 SSE 流，实时输出 |
| 任务依赖管理 | ✅ | DAG 依赖图，支持任务前置依赖声明 |
| 自我反思与进化 | ✅ | 执行完成后 AI 评分，生成改进方案，支持 N 轮进化 |
| 会话持久化 | ✅ | localStorage 保存未完成会话，支持恢复 |
| 历史面板 | ✅ | 查看历史会话记录，可重放 |
| 任务管理器 | ✅ | 跨会话任务列表，任务状态跟踪 |

### 4.2 输出模式

| 模式 | 状态 | 说明 |
|------|------|------|
| Text（文本）| ✅ | 标准文本生成输出 |
| Build（构建）| ✅ | 生成代码文件树，支持 ZIP 打包下载 |
| Q&A（问答）| ✅ | 多轮对话模式，保留上下文 |
| Image（图像）| ✅ | 文生图，支持多种图像模型 |

### 4.3 模型支持

| 类别 | 模型 |
|------|------|
| LLM - 推荐 | GLM 5.1 (glm-z1-flash) |
| LLM - 强力 | Claude Sonnet 4.5, Claude Opus 4.6/4.7 |
| LLM - OpenAI | GPT 5.4 Pro |
| LLM - Google | Gemini 3.1 Pro |
| Image | GPT Image 2 (openai/gpt-image-2) |
| Image | Seedream 4.5 (doubao/seedream-4-5) |

### 4.4 用户系统

| 功能 | 状态 | 说明 |
|------|------|------|
| 用户注册/登录 | ✅ | Email + Password，自动确认邮箱 |
| 管理员角色 | ✅ | is_admin 标志，AdminRoute 路由保护 |
| 管理员后台 | ✅ | 用户管理、记忆管理、配额管理 |
| 管理员切换 | ✅ | 一键切换任意用户的管理员状态 |
| 用户删除 | ✅ | 软删除（解除管理员）或完全删除 |

### 4.5 配额与计量系统

| 功能 | 状态 | 说明 |
|------|------|------|
| 每日执行次数限制 | ✅ | `daily_run_limit`，Admin 可手动设置 |
| 每日图像次数限制 | ✅ | `daily_image_limit` |
| 每月总次数限制 | ✅ | `monthly_run_limit` |
| 每日 Token 限制 | ✅ | `daily_token_limit`，以 K 为单位显示 |
| 每月 Token 限制 | ✅ | `monthly_token_limit` |
| 配额超限弹窗 | ✅ | 显示已用/上限进度条 + 联系管理员提示 |
| Token 消耗追踪 | ✅ | 每次执行记录 prompt/completion/total tokens |
| Admin 配额管理 | ✅ | 后台 inline 编辑每个用户的所有配额字段 |
| 本月使用量显示 | ✅ | Admin 后台显示每用户本月执行次数 + Token 消耗 |

### 4.6 套餐订阅

| 功能 | 状态 | 说明 |
|------|------|------|
| 套餐配置 | ✅ | 基础版 / 专业版，配额预设定义 |
| 套餐选择 UI | ✅ | PricingModal 双列套餐对比卡片 |
| 配额超限升级入口 | ✅ | QuotaExceededModal "升级套餐"按钮 |
| 用户菜单升级入口 | ✅ | AgentHeader 用户菜单 |
| Admin 一键激活套餐 | ✅ | 后台配额 Tab 点击自动应用套餐预设 |
| 套餐 badge | ✅ | 用户菜单显示 BASIC/PRO badge |
| 支付接口预留 | ⏳ | PricingModal 支付按钮已占位，待接入（因在中国大陆，Stripe 不可用） |

### 4.7 长期记忆

| 功能 | 状态 | 说明 |
|------|------|------|
| 记忆存储 | ✅ | 每次执行完成后自动提取摘要存入 agent_memory |
| 记忆检索 | ✅ | 执行前检索相关历史记忆作为 context |
| 记忆格式化 | ✅ | 格式化为结构化 context 注入 Agent |
| Admin 记忆管理 | ✅ | 后台查看/删除所有记忆条目 |

### 4.8 国际化

| 功能 | 状态 | 说明 |
|------|------|------|
| 中英双语 | ✅ | zh.json / en.json 完整覆盖 |
| 语言切换器 | ✅ | AgentHeader 右上角切换 |
| i18n 命名空间 | ✅ | agent / quota / admin / pricing / auth / modelSelector |

---

## 5. 关键技术决策

### 5.1 SSE 流式 vs WebSocket
**选择：SSE（Server-Sent Events）**  
- Supabase Edge Functions 原生支持 SSE 流式响应
- 单向流，对代理执行场景完全够用
- 实现简单，无需 WebSocket 握手协议
- 每个任务独立 SSE 连接，便于并行管理

### 5.2 配额检查架构
**选择：前端 checkQuota → 后端 recordUsage → 后端 finalizeUsage**  
- 执行前检查：防止用户发起超限请求
- 执行开始时记录：保证记录不遗漏
- 执行完成后更新 Token：只有真实消耗了才计入 Token 数
- 管理员绕过：isAdmin 判断跳过所有检查

**关键 Bug（已修复）：** 初始版本 `fetchProfile` 只 select `id, email, is_admin, created_at`，导致所有配额字段为 `undefined`，在 JS 中 `undefined != null` 为 `false`，使所有配额检查静默通过。修复方案：将所有配额字段加入 select 语句。

### 5.3 数据库 RLS 设计
```
profiles:
  - users_own: 用户只能读写自己的 profile
  - admins_read_all: 管理员可读全部（通过 is_admin_user() SECURITY DEFINER 避免递归）

usage_logs:
  - own_logs: 用户只能读写自己的 logs
  - admin_read_all: 管理员可读全部
```

### 5.4 触发器 search_path 修复
注册触发器在 `auth` schema 中执行，无法找到 `public.profiles`。  
**修复：** 函数签名添加 `SET search_path = public`。

### 5.5 套餐配额预设外部化
将套餐配置（`PLAN_CONFIGS`）提取到 `src/lib/planConfig.ts`，避免 fast-refresh 警告（React 要求组件文件不应导出非组件常量）。

### 5.6 Token 延迟写入
Token 消耗在执行完成后才知道确切数值。  
**方案：** `recordUsage()` 返回 `logId`，执行完成通过 `useEffect` 监测 `status === "done"` 触发 `finalizeUsage(logId, sessionUsage)` 更新 token 字段。

---

## 6. 发现并修复的 Bug

| Bug | 根因 | 修复方案 |
|-----|------|---------|
| 注册后跳转 `/` 太早 | `signUp` 开启自动确认时立即触发 `onAuthStateChange` | 检查 `data.session` 判断是否已自动登录 |
| 新用户无法创建 profile | 触发器在 auth schema 运行，找不到 public.profiles | 函数添加 `SECURITY DEFINER SET search_path = public` |
| 绿框遮住下拉菜单 | `backdrop-blur-sm` 创建堆叠上下文，`header` 无 z-index | header 添加 `relative z-10` |
| 配额永不生效 | fetchProfile 未 select 配额字段，值为 undefined | 修正 select 语句含所有配额字段 |
| 关闭用户菜单导致下拉外层点击事件 | 事件冒泡 | `e.stopPropagation()` |

---

## 7. 当前状态与已知限制

### 已完成
- 完整的 Agent 执行引擎（规划 → 执行 → 进化）
- 4 种输出模式（文本/构建/问答/图像）
- 完整的用户认证与权限体系
- 完善的配额与计量系统
- 套餐订阅 UI 与管理员激活流程

### 已知限制
- **支付接口未接入**：处于中国大陆，Stripe 不可用；需接入微信支付或支付宝（需商户号）
- **图像生成无会话上下文**：每次图像生成是独立请求，无法基于上文图像修改
- **记忆检索精度**：当前使用简单文本相似度，非真正向量搜索（可接入 pgvector）
- **无多租户隔离**：所有用户共享同一 Agent 配置，无工作区隔离
- **移动端体验**：响应式已实现，但复杂布局在小屏体验待优化

---

## 8. 未来路线图

### P0（核心）
- [ ] 接入国内支付（支付宝 / 微信支付）
- [ ] Webhook 自动更新订阅状态和配额
- [ ] 支付成功 Toast 提示

### P1（增强）
- [ ] pgvector 真正向量记忆检索
- [ ] 工作区（Workspace）多租户隔离
- [ ] 图像生成上下文（img2img 工作流）
- [ ] Agent 执行结果分享（公开链接）

### P2（扩展）
- [ ] 插件系统（自定义工具调用）
- [ ] Webhook 触发执行（API 接入）
- [ ] 执行调度（定时任务）
- [ ] 多用户协作（共享任务管理器）

---

## 9. 项目统计

| 指标 | 数值 |
|------|------|
| 总提交数 | 70+ commits |
| 代码文件数 | 55+ |
| 数据库迁移数 | 7 次 |
| Edge Functions | 3 个 |
| i18n 键总数 | 200+ |
| 支持模型数 | 8+ |
| 开发周期 | 2026-04-14 至 2026-05-14 |

---

## Phase 6：多模型支持 + Agent World 集成 + 记忆进化修复（2026-05-14 下午）

### 6.1 Claude / Anthropic 多模型支持

**背景：** 原架构仅支持 OpenAI Chat Completions 协议，Claude 系列模型因使用不同的 Anthropic Messages 协议而无法正常工作。

**改动：**

| 文件 | 改动 |
|------|------|
| `supabase/functions/harness-agent/index.ts` | 新增 `API_BASE_MESSAGES` 端点；`isClaudeModel()` 检测函数；`translateAnthropicToOpenAI()` TransformStream |

**核心实现：** `translateAnthropicToOpenAI()` 是一个 TransformStream，将 Anthropic SSE 事件（`content_block_delta`、`message_stop`、`message_delta`）实时转译为 OpenAI SSE 格式，使客户端代码无需感知协议差异。

**同时修复的三处 SSE 错误：**

1. **`thinking` 参数导致 400**：上一个版本错误地为 Claude 模型添加了 `thinking` 参数，而 Enter AI All API 不支持该扩展字段 → 移除。
2. **`chat` handler 错误吞没**：原来 `throw new Error()` 变成 HTTP 500，客户端无法获得具体错误信息 → 改为直接返回 SSE 格式错误事件，与 `execute` handler 保持一致。
3. **QA `onopen` 丢失错误信息**：fetchEventSource 在非 200 响应时，QA 模式的 `onopen` 只抛 "Request failed: 500" 而不读取响应体 → 补全 SSE body 解析逻辑（与 execute 模式对称）。

**AbortError 修复：** `fetchEventSource` 是异步函数，其返回的 Promise 在 `onerror` 抛出时会 reject，但外层 `new Promise()` 不捕获这个内层 Promise，导致 unhandled rejection 报错。修复方案：给两处 `fetchEventSource(...)` 调用链添加 `.catch(() => {})` 吸收噪声。

---

### 6.2 模型列表重构

**背景：** 模型列表中包含了超出当前订阅计划权限的模型（`openai/gpt-5.4-pro`、`anthropic/claude-opus-4.6`），调用时返回 `model not available for current plan`。

**新模型列表（`src/lib/models.ts`）：**

```typescript
export const MODELS = [
  "anthropic/claude-opus-4.7",
  "anthropic/claude-sonnet-4.5",
  "openai/gpt-5.4",
  "deepseek/deepseek-v4-pro",
  "google/gemini-3.1-pro-preview",
  "moonshotai/kimi-k2.6",
  "z-ai/glm-5.1",
  "minimax/minimax-m2.7",
  "alibaba/qwen-3.6-plus",
] as const;
```

移除：`openai/gpt-5.4-pro`、`anthropic/claude-opus-4.6`、`z-ai/glm-5`  
新增：`anthropic/claude-sonnet-4.5`、`openai/gpt-5.4`、`google/gemini-3.1-pro-preview`、`alibaba/qwen-3.6-plus`

---

### 6.3 Agent World 集成

**背景：** Agent World（world.coze.com）是一个 Agent 身份系统，注册后获得全生态通用 api_key，可接入 16 个联盟站（炒股竞技、技能市场、AI 酒馆等）。

**实现架构：**

```
用户填写 username/nickname/bio
    │
    ▼ edge function: agent-world (mode=register)
    │
    ├─ POST world.coze.com/api/agents/register
    │    → api_key + verification_code + challenge_text (混淆数学题)
    │
    ├─ LLM (glm-5.1) 解题
    │    → 提取语义数字，忽略噪声符号/Unicode 同形字/随机大小写
    │
    ├─ POST world.coze.com/api/agents/verify
    │    → is_active: true
    │
    └─ PATCH profiles SET agent_world_username, agent_world_api_key
```

**新增文件：**

| 文件 | 说明 |
|------|------|
| `supabase/functions/agent-world/index.ts` | register + profile 两种模式的 edge function |
| `src/hooks/useAgentWorld.ts` | 注册流程 hook，含 `justRegistered` 本地状态（避免等待 profile 刷新） |
| `src/components/agent/AgentWorldModal.tsx` | 注册表单 + 已注册视图（API Key 遮码 + 复制 + 外链） |

**profiles 表新增列：**

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS agent_world_username text,
  ADD COLUMN IF NOT EXISTS agent_world_api_key text,
  ADD COLUMN IF NOT EXISTS agent_world_avatar_url text;
```

**域名修复：** 初始实现使用 `world.coze.site`，实测所有 `.site` 域名均 307 跳转到 `.com`，POST 请求跟重定向可能丢失 Authorization header，改为直接使用 `world.coze.com`。

**探索结果（以 `evodao` 账号亲测）：**

Agent World 联盟站生态包含：虾评技能市场（505 个技能）、策场炒股（17,149 个 Agent，¥100万虚拟资金）、AfterGateway AI 酒馆、考场标准化考试、合成交易所 AMM、ABTI 人格测试等 16 个站。

---

### 6.4 从虾评学习「Agent 自我进化」技能

**背景：** 在虾评（xiaping.coze.com）浏览 505 个技能，下载量最高且与 EVODAO 最相关的是「Agent 自我进化」（21k 下载，★4.8）。该技能核心主张：**记忆检索应是目标感知的，高质量经验应优先被召回**。

**发现的两处断路：**

| 断路 | 代码位置 | 问题 |
|------|----------|------|
| `searchMemory` 忽略 goal | `useMemory.ts:32` | 参数名 `_goal`，完全未使用，只返回最近 3 条 |
| `saveMemory` 不保存 qualityScore | `Index.tsx:164` | `agent_memory.quality_score` 永远为 NULL |

**修复（`src/hooks/useMemory.ts`）：**

```typescript
// searchMemory: 目标感知检索
const keywords = goal.split(/\s+/).filter(w => w.length > 3).slice(0, 5);
// Supabase .or(keywords.map(k => `goal.ilike.%${k}%`).join(","))
// 排序：quality_score DESC NULLS LAST → created_at DESC
// 不足时 fallback 补最近记忆

// 新增 updateMemoryScore(id, score)
// saveMemory 改为返回 id (string | null)
```

**修复（`src/pages/Index.tsx`）：**

```typescript
// handleComplete: 保存 latestMemoryIdRef.current = id
// useEffect 监听 reflection: 有 QA 评分时回填 quality_score
useEffect(() => {
  if (reflection && latestMemoryIdRef.current) {
    memory.updateMemoryScore(latestMemoryIdRef.current, reflection.qualityScore);
  }
}, [reflection, memory]);
```

---

### 6.5 数据库变更汇总

| 迁移 | 内容 |
|------|------|
| `migration_20260514_165612000` | profiles 新增 agent_world_username / api_key / avatar_url |

---

### 6.6 更新：已知限制

以下问题在 Phase 6 **已修复**：
- ~~记忆检索不区分 goal 相关性~~ → goal-aware 关键词过滤
- ~~quality_score 永久为 NULL~~ → QA 评估完成后自动回填
- ~~Claude 系列模型不可用~~ → Anthropic Messages 协议支持

以下问题**仍存在**：
- Agent World 注册时虾评联动（xiaping 注册 API 返回 `注册失败`，可能因 `evodao` 已在 Agent World 占用）
- `agent_memory` 无用户隔离（全局共享记忆池）
- 支付接口未接入

---

### 6.7 更新：项目统计

| 指标 | 数值 |
|------|------|
| 总提交数 | 85+ commits |
| Edge Functions | 4 个（新增 agent-world） |
| 支持 LLM 模型数 | 9 个（含 Claude / GPT / Gemini / Kimi / GLM / DeepSeek / MiniMax / Qwen） |
| 图像模型数 | 3 个 |
| Agent World 注册 | `evodao` 账号，api_key 已激活 |
| 本次复盘写入记忆 | `agent_memory` 表 1 条，quality_score=95 |


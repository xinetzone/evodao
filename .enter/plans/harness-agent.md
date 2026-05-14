# 项目开发总结 + Skill 萃取计划

## 项目开发过程总结

### 阶段一：基础架构（2026-04-14 ~ 2026-05-12 早期）
- 项目初始化（Vite + React + Tailwind + shadcn）
- 核心 SSE 流式 AI Agent 接入
- i18n 国际化框架
- 会话持久化（localStorage）、历史面板、Markdown 导出
- Agent 自我反思/进化机制
- Q&A 问答模式

### 阶段二：功能扩展（2026-05-12 中期）
- Prompt 建议与优化
- 多模型选择器（Claude / GPT / Gemini / GLM）
- 并行任务执行引擎重构（TaskManager + DAG 依赖图）
- 图像生成模式（多图像模型支持、轮询状态）

### 阶段三：系统化（2026-05-14）
- 长期记忆系统（agent_memory + 检索）
- 用户认证 + 管理员后台（profiles + RLS + AdminRoute）
- DB 触发器 search_path 关键修复
- 配额系统：每日/月次数限制 + Token 配额
- fetchProfile Bug 修复（未 select 配额字段 → undefined 静默通过）
- 套餐订阅架构（Basic/Pro）+ Admin 一键激活
- 项目全面复盘文档

---

## 萃取的 Skills（4 个，无重复）

### Skill 1: `supabase-quota-metering`
**价值**：任何需要限流/计量的 SaaS 应用都需要这个模式
- 两阶段写入：INSERT 占位 → finalizeUsage UPDATE token
- checkQuota Hook 模式（daily/monthly/token 多维度）
- QuotaExceededModal 通用组件
- Admin 内联编辑配额
- 关键 Bug 预防：fetchProfile 必须 select 全部配额字段

### Skill 2: `supabase-subscription-plans`
**价值**：快速搭建套餐 UI + 管理员手动激活，支付后接入
- planConfig.ts 外部化（避免 fast-refresh 警告）
- PricingModal 双列对比卡片
- Admin 一键应用配额预设
- plan badge + 多处升级入口
- 支付按钮占位设计（大陆支付后接入）

### Skill 3: `sse-streaming-agent`
**价值**：构建任何 SSE 流式 AI Agent 的标准模式
- Edge Function SSE 格式（Deno.serve + ReadableStream）
- 前端 fetch + reader.read() 消费流
- 状态机：idle → planning → running → done
- 并行子任务流管理
- Token 实时累计追踪

### Skill 4: `supabase-auth-admin-roles`
**价值**：Supabase Auth + 管理员角色 + RLS 的正确配置方式
- is_admin_user() SECURITY DEFINER 函数（避免 RLS 递归）
- profiles 触发器 SET search_path = public（关键修复）
- ProtectedRoute + AdminRoute 路由保护
- 管理员绕过所有业务检查的模式
- 自动确认邮箱配置

---

## 写入位置

每个 skill 写入：
`/workspace/skill-drafts/custom/{skill_key}@1/SKILL.md`

然后通过 `confirm_skill` 提交到 Enter 平台供保存。

---

## 执行步骤

1. 并行写入 4 个 SKILL.md 草稿文件
2. 依次调用 confirm_skill 提交每个 skill（需用户逐个确认）

# Agent Memory — EvoDAO

> 本文件是 Agent 的长期记忆锚点。每次新会话开始时优先读取此文件。
> 上次更新：2026-05-14（按 xiaping skill.md v260512.2 模板同步）

---

## 🌐 平台清单（TOOLS / Platforms）

### Agent World — 统一身份系统

**类型**：AI Agent 身份认证中台
**域名**：https://world.coze.com（旧 `world.coze.site` 已永久 307 重定向，会丢 Header）
**完整指南**：`curl -sL https://world.coze.com/skill.md`
**鉴权**：`agent-auth-api-key: YOUR_KEY` 或 `Authorization: Bearer YOUR_KEY`

**我的账号（evodao_v2）**：
- username：`evodao_v2`
- api_key：`agent-world-92706b8b6c45e7a4ced7f0bf14127c1d496cc3b3526f1922`
- 状态：✅ Agent World 验证有效（PUT profile 返回 200）

**备用账号（evodao-link1）**：
- username：`evodao-link1`
- api_key：`agent-world-cd2686305de084b88c4d5d80050fb00279b7a2f8307c9c11`
- 状态：✅ Agent World 验证有效

**已知问题**：AgentLink（friends.coze.com）的 verify-key 中间层仍使用 world.coze.**site** 发起 POST，
导致 307 重定向丢失 body → 所有新账号 401。14 个旧账号（本地缓存）不受影响。

---

### 虾评（xiaping）— Agent Skills 技能交易市场

**类型**：远程 API 平台（无 SDK，全部走 HTTPS）
**域名**：https://xiaping.coze.com（旧 `xiaping.coze.site` 已弃用，会丢 Header）
**完整指南**：`curl -sL https://xiaping.coze.com/skill.md`（每次会话开始拉一次，5s 超时；详见 §0.3）
**本地缓存**：`skills/xiaping.md`（版本 260512.2，更新于 2026-05-12）
**鉴权**：`Authorization: Bearer $XIAPING_KEY`

**核心能力**：
- 浏览/搜索/下载/安装他人技能（试用版免费、正式版 2 虾米/次）
- 上传/发布自己的技能（通过转正机制进入正式区）
- 评测打分（基础 +1 / 完整 +3 虾米；优质评测额外 +5）
- 虾米经济：等级 A1–A5 / 每日打卡 / 任务 / 邀请代言 / 兑换商城
- 站内信：嵌入式通知 + 4 个独立接口（详见 §3.3）

**触发词**（用户说出这些时立刻使用本平台）：
装技能 / 卸载 / 上传/发布技能 / 评测 / 打分 / 虾米 / 打卡 / 许愿 / 找技能 / 推荐技能 / 技能榜

**我的身份**（注册后立即填入）：
- agent_id：{待注册后填入}
- user_id：{待 /api/auth/me 返回后填入}
- username：{待注册后填入}
- api_key：{待注册后填入}  ← 已有 Agent World 账号可直接复用 evodao_v2 的 key

> ⚠️ 注册提示：`POST /api/auth/agent-world/register` 会创建新 Agent World 账号。
> 如已有账号，直接用现有 api_key 调用 xiaping API，跳过注册步骤。

**已安装技能清单**：
（暂无，首次使用后在此追加）

---

### Bar.coze.site（酒馆）

**域名**：https://bar.coze.site
**鉴权**：`Authorization: Bearer tavern_xxxxx`（具体值已存于 Supabase secrets）
**账号**：evodao_build
**状态**：✅ 已注册，有效

---

### NeverLand Farm（永无农场）

**域名**：https://jnndrhrh7z.coze.site
**账号**：evodao_build（与 Bar.coze.site 共用）
**Farm ID**：`533d226f-e10a-4cb2-8e18-1ea754f2b67e`
**最后状态（Day 28）**：
- 金币：7151G
- XP：9120（Level 4）
- 待收割：60 个萝卜（1/3 阶段）
- 下一步：推进至秋季 → 浇水 → 收割萝卜（~5040G）→ 重新种植

---

## 🔧 本项目（EvoDAO）

**项目类型**：React + TypeScript + Vite + Supabase，AI Agent 执行平台
**主要文件**：
- `supabase/functions/harness-agent/index.ts` — 核心 AI 编排 Edge Function
- `supabase/functions/agent-world/index.ts` — Agent World 注册/鉴权 Edge Function
- `src/hooks/useAgentWorld.ts` — 前端 Agent World 状态管理
- `src/components/agent/AgentWorldModal.tsx` — Agent World 注册弹窗

**已知修复（本次会话）**：
- `AgentWorldModal.tsx` 第 179 行：`world.coze.site` → `world.coze.com`（旧域名丢 Header）
- `skills/xiaping.md` 本地技能缓存：已同步至 v260512.2

---

## 📌 重要规则备忘

1. **域名规则**：所有 `*.coze.site` 均 307 重定向至 `*.coze.com`；POST 请求跟随重定向时会丢失 Headers
   → 始终使用 `.com` 域名直接调用 API
2. **挑战题**：answer 必须传字符串（`"47"` 而非 `47`）；最多 5 次失败，第 5 次账号被删除
3. **虾米等级**：看 `total_earned_coins`（累计赚到），不看余额；消耗不掉级
4. **评测频率**：≤ 5/小时、20/天；完整评测需 3 个必填维度（functionality/effectiveness/scarcity）

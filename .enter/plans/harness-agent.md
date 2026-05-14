# Agent World 集成计划

## Context
用户想将应用接入 Agent World（https://world.coze.com/skill.md）。
Agent World 是 AI Agent 的统一身份系统——注册后获得全网通行的 api_key，可访问各联盟站点。
实现为**每个用户独立**注册自己的 Agent World 身份（per-user），而非整个应用共享一个账号。

---

## 完整流程

```
用户点击注册
  → 填写 username / nickname / bio
  → Edge Function 调用 world.coze.site/api/agents/register
  → 获取 verification_code + challenge_text（混淆数学题）
  → Edge Function 用 LLM（GLM 5.1）直接理解语义解题
  → 提交答案到 world.coze.site/api/agents/verify
  → 激活成功，将 api_key + username 写入 profiles 表
  → 前端展示身份卡片
```

---

## 文件变更清单

### 1. DB Migration
**新增列到 `profiles` 表**：
- `agent_world_username text`
- `agent_world_api_key text`
- `agent_world_avatar_url text`

### 2. Edge Function
**新建** `supabase/functions/agent-world/index.ts`

支持两种 mode：
- `register`：注册 → LLM 解题 → 验证 → 写 profiles
- `profile`：从 world.coze.site 读取公开 profile（用于展示头像）

关键实现细节：
- LLM 解题 Prompt：直接传原始 challenge_text，指示模型忽略大小写/噪声/同形字，理解语义后**只返回数字**
- 使用 `AI_API_TOKEN_8f02c91ef078` 调用 `/code/api/v1/ai/chat/completions`，model = `z-ai/glm-5.1`
- 使用 Supabase `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`（edge function 内置env）更新 profiles

### 3. Hook
**新建** `src/hooks/useAgentWorld.ts`

```typescript
interface AgentWorldState {
  isRegistered: boolean;  // profile.agent_world_username != null
  isLoading: boolean;
  isRegistering: boolean;
  error: string | null;
  agentProfile: { username: string; apiKey: string; avatarUrl: string | null } | null;
  register: (username: string, nickname: string, bio: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}
```

状态来自：
- `useAuthContext().profile` 读取 `agent_world_username` / `agent_world_api_key`
- 注册时调用 `agent-world` edge function

### 4. Component
**新建** `src/components/agent/AgentWorldModal.tsx`

**未注册状态**：
```
[Globe icon] Agent World
"Join the Agent Internet"

username: [auto-filled from email prefix, editable]
nickname: [editable]  
bio:      [textarea]

[Join Agent World]
```

**注册中状态**（逐步更新）：
```
[Loading] Registering identity...
[Loading] Solving verification challenge...
[Loading] Activating account...
```

**已注册状态**：
```
[avatar] @username  nickname
bio text

API Key: [agent-world-xxx...xxx] [copy icon]
[在 Agent World 查看主页]
```
注意：api_key 部分隐藏（显示前8位 + ... + 后8位）

### 5. 更新 `src/components/agent/AgentHeader.tsx`
在用户下拉菜单中，"Upgrade" 和 "Sign out" 之间插入：
```
[Globe icon] Agent World  ← 新按钮
```
点击后打开 AgentWorldModal。

### 6. 更新 `src/hooks/useAuth.ts`
在 `Profile` interface 添加：
```typescript
agent_world_username: string | null;
agent_world_api_key: string | null;
agent_world_avatar_url: string | null;
```
在 `fetchProfile` 的 select 字段中追加这三个字段。

### 7. i18n
**zh.json + en.json** 新增 `agentWorld` 命名空间：
- 注册表单文字、步骤状态、已注册展示、错误提示等

---

## Edge Function 要点

```typescript
// solve challenge
const solveRes = await fetch("https://api.enter.pro/code/api/v1/ai/chat/completions", {
  body: JSON.stringify({
    model: "z-ai/glm-5.1",
    messages: [{
      role: "user",
      content: `You are solving an obfuscated math problem. The text may contain:
- Random letter casing ("tHiRtY" = "thirty")
- Noise symbols (], ^, *, |, ~, /, [) and zero-width chars — ignore them
- Unicode homoglyphs (Cyrillic/Greek letters that look like Latin) — read by shape
- Non-standard numbers: "a dozen"=12, "half a hundred"=50, "a score"=20, "three score"=60
- Mixed forms: "forty-3"=43, "thirty plus seven"=37

Read the SEMANTIC meaning and return ONLY the final numeric answer, nothing else.

Challenge: ${challenge_text}`
    }],
    stream: false
  })
});
// extract first number from response
const answer = response.choices[0].message.content.trim().match(/\d+(\.\d+)?/)?.[0];
```

---

## 验证方式
1. 点击用户菜单 → 看到 "Agent World" 按钮
2. 填写 username → 点击注册 → 看到 3 个步骤逐一完成
3. 注册成功后显示 api_key 卡片（可复制）
4. 刷新页面后仍显示已注册状态（持久化在 profiles 表）
5. 若 username 已被占用，显示明确错误信息

# 修复 Claude 模型无法使用

## 问题根因（已诊断）

### 根因 1：`thinking` 参数导致 API 400 错误（上次修复引入的回归）
- 上次修复在请求体中加了 `thinking: { type: "enabled", budget_tokens: 8000 }`
- 但 Enter API 协议规范（`protocol_anthropic_messages.md`）的 Request Body 中**没有** `thinking` 字段
- Enter 代理不接受这个参数 → API 返回 400 错误
- 等价于：修复把 Opus 本来可能能用的模型也打坏了

### 根因 2：QA 模式 `onopen` 不解析 SSE 错误体
- 当上游返回非 200 时，`chat` handler 抛出错误 → 边缘函数返回 HTTP 500
- QA 模式的 `onopen`（`useEvodaoAgent.ts` line 624）：
  ```typescript
  if (!response.ok) {
    const err = new Error(`Request failed: ${response.status}`);
    // ← 没有读 body，丢弃了实际错误消息
    settle(() => reject(err));
    throw err;
  }
  ```
- 用户只看到 "Request failed: 500"，无法知道实际错误
- 对比：Execute 模式的 `onopen`（line 318）**已经**正确解析了 SSE 错误体

### 根因 3：`chat` handler 错误传播链断裂
- `execute` handler：`!response.ok` → 解析 SSE body → 返回正确状态码+SSE 错误
- `chat` handler：`!response.ok` → `throw new Error(...)` → 外层 catch → HTTP 500（信息丢失）

## 修复方案

### 变更文件 1：`supabase/functions/harness-agent/index.ts`

**删除** `isOpus4Model()` 函数和两处 `thinking` 参数块（恢复到不带 thinking 的状态）。

**修改** `chat` handler 的错误处理，与 `execute` handler 保持一致：
```typescript
// 当前（错误）
if (!response.ok) {
  const text = await response.text();
  throw new Error(`Chat LLM error: ${text}`);   // ← 变成 HTTP 500
}

// 修复后
if (!response.ok) {
  const text = await response.text();
  let errorMessage = "AI service error";
  const dataMatch = text.match(/data: (.+)/);
  if (dataMatch) {
    try {
      const errorData = JSON.parse(dataMatch[1]);
      errorMessage = errorData.error?.message || errorMessage;
    } catch { /* keep default */ }
  }
  const errorSSE = `event: error\ndata: ${JSON.stringify({ error: { message: errorMessage, type: "api_error" } })}\n\n`;
  return new Response(errorSSE, {
    status: response.status,
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
```

### 变更文件 2：`src/hooks/useEvodaoAgent.ts`

**修改** QA 模式的 `onopen`，与 Execute 模式保持一致（line 624 附近）：
```typescript
// 当前（错误）
async onopen(response) {
  if (!response.ok) {
    const err = new Error(`Request failed: ${response.status}`);
    settle(() => reject(err));
    throw err;
  }
},

// 修复后（与 execute 模式 onopen 逻辑一致）
async onopen(response) {
  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("text/event-stream")) {
      const text = await response.text();
      const dataMatch = text.match(/data: (.+)/);
      if (dataMatch) {
        try {
          const errorData = JSON.parse(dataMatch[1]);
          const msg = errorData.error?.message;
          if (msg) {
            settle(() => reject(new Error(msg)));
            throw new Error(msg);
          }
        } catch (e) {
          if (e instanceof Error && !e.message.includes("Unexpected token")) throw e;
        }
      }
    }
    const err = new Error(`Request failed: ${response.status}`);
    settle(() => reject(err));
    throw err;
  }
},
```

## 影响范围

| 文件 | 改动 |
|------|------|
| `supabase/functions/harness-agent/index.ts` | 删除 `isOpus4Model` + thinking 参数；修复 chat handler 错误传播 |
| `src/hooks/useEvodaoAgent.ts` | 修复 QA 模式 onopen 错误解析 |

## 验证

1. 选择 Claude Opus 4.6 / 4.7 → QA 模式发送消息 → 应得到正常响应（非 500）
2. 如果 API 仍报错 → 用户现在能看到**实际错误消息**（model not found / permission denied 等），而不是 "Request failed: 500"
3. Claude Sonnet 类模型不受影响
4. Execute/Agent 模式 Claude 模型功能不受影响

# Token/Cost Consumption Analytics

## Context
Current `usage_logs` only stores token counts (prompt/completion/total) and output_mode.
Missing: which model was used, estimated USD cost. Admin panel shows per-user totals but
no per-model breakdown or cost estimate.

User wants to see: per-model, per-run token consumption + credits/cost estimation.

Note on "per-task" granularity: each run = one `usage_logs` row (one goal execution).
True per-task breakdown would require streaming per-task token counts from the edge function —
that is a separate larger task. This plan tracks per-run-per-model which captures the model
selection at execution time.

---

## Implementation Steps

### Step 1 — DB Migration
Add two columns to `usage_logs`:
- `model_id TEXT` — which LLM/image model was used
- `cost_usd NUMERIC(10,6) DEFAULT 0` — estimated USD cost

```sql
ALTER TABLE usage_logs ADD COLUMN model_id TEXT;
ALTER TABLE usage_logs ADD COLUMN cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0;
```

### Step 2 — `src/lib/models.ts`
Add `MODEL_PRICING` map — estimated USD per 1,000,000 tokens (blended input+output average):

```typescript
export const MODEL_PRICING: Record<string, number> = {
  "anthropic/claude-opus-4.7":      30.0,   // $15 in + $75 out avg
  "anthropic/claude-sonnet-4.5":     7.0,   // $3 in + $15 out avg
  "openai/gpt-5.4":                 10.0,   // estimated
  "deepseek/deepseek-v4-pro":        0.5,   // $0.27 in + $1.1 out
  "google/gemini-3.1-pro-preview":   2.0,   // $1.25 in + $5 out avg
  "moonshotai/kimi-k2.6":            0.5,
  "z-ai/glm-5.1":                    0.1,
  "minimax/minimax-m2.7":            0.5,
  "alibaba/qwen-3.6-plus":           0.3,
};
// Image models: cost per generation (fixed, not per token)
export const IMAGE_PRICING: Record<string, number> = {
  "openai/gpt-image-2":                     0.04,
  "google/gemini-3.1-flash-image-preview":  0.02,
  "doubao/seedream-4.5":                    0.015,
};
```

Cost formula: `cost_usd = (total_tokens / 1_000_000) * MODEL_PRICING[model_id]`
Image cost: `cost_usd = IMAGE_PRICING[model_id]` (flat per image)

### Step 3 — `src/hooks/useUsageQuota.ts`
- `recordUsage(mode, modelId?: string)` → insert `model_id` into the row
- `finalizeUsage(logId, tokens, modelId?: string)` → calculate and update `cost_usd`

### Step 4 — `src/pages/Index.tsx`
- `recordUsage(mode, selectedModel)` for text/agent/qa modes
- `recordUsage("image", activeImageModelId)` for image mode
- `finalizeUsage(pendingLogId, sessionUsage, lastUsedModel)` — need to track which model was active at run time

Add `const [runningModel, setRunningModel] = useState("")` to remember the model at execution start.

### Step 5 — `src/pages/Admin.tsx`
Add new tab `"usage"` — **Usage Analytics**:

#### Top summary row (3 cards):
- **本月总 Token 数** — sum of total_tokens this month
- **本月预估费用** — sum of cost_usd this month (labeled "USD 估算")
- **本月运行次数** — count of rows this month

#### Per-model breakdown table:
Query: group usage_logs by model_id → show model name, run count, total tokens, total cost_usd

| 模型 | 运行次数 | 总 Tokens | 估算费用 (USD) |
|---|---|---|---|
| Claude Sonnet 4.5 | 12 | 1,234,567 | $8.64 |

#### Recent 50 runs table:
Query: latest 50 rows from usage_logs (admin sees all) with columns:
- 时间 / 用户邮箱 / 模式 / 模型 / Token (Prompt+Completion) / 估算费用

---

## Files Modified
1. DB migration (new SQL)
2. `src/lib/models.ts` — add MODEL_PRICING, IMAGE_PRICING
3. `src/hooks/useUsageQuota.ts` — update recordUsage/finalizeUsage signatures + cost calc
4. `src/pages/Index.tsx` — pass model to recordUsage, track runningModel state
5. `src/pages/Admin.tsx` — add "usage" tab with analytics UI

---

## Caveats (to show in UI)
- Cost figures are **estimated** based on standard provider pricing
- Actual Enter AI Credits consumed can be viewed on Enter.pro Credits page
- Image generations: 1 image = flat rate (not token-based)
- No per-task breakdown within a single run (one row = one goal execution)

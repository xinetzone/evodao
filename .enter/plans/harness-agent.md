# Harness Agent — Multi-Model Support (Auto + Manual Selection)

## Context
Integrate DeepSeek V4 Pro (`deepseek/deepseek-v4-pro`, `openai_chat_completions` protocol) alongside existing GLM 5.1. All candidate models use the same `openai_chat_completions` protocol, so no protocol routing change is needed in the Edge Function — just pass `model` as a parameter.

## Available Models (all openai_chat_completions, Plan Included)

| Display Name | Model ID | Auto-Selected For | Strength |
|---|---|---|---|
| DeepSeek V4 Pro | `deepseek/deepseek-v4-pro` | Agent Build | Coding, reasoning, math, 1M context |
| GLM 5.1 | `z-ai/glm-5.1` | Task Mode, Q&A | Long-horizon agentic tasks |
| GLM 5 | `z-ai/glm-5` | — | Complex system design |
| Kimi K2.6 | `moonshotai/kimi-k2.6` | — | Multimodal, tool use |
| MiniMax M2.7 | `minimax/minimax-m2.7` | — | Coding, agent workflows |

---

## Auto-Selection Logic

```typescript
function getAutoModel(outputMode: OutputMode): string {
  if (outputMode === "agent") return "deepseek/deepseek-v4-pro"; // Best for code generation
  return "z-ai/glm-5.1"; // Fast general agent / Q&A
}
```

---

## Implementation Plan

### 1. `supabase/functions/harness-agent/index.ts`
- Destructure `model` from request body: `const { ..., model = "z-ai/glm-5.1" } = await req.json();`
- Replace every hardcoded `"z-ai/glm-5.1"` string in all LLM fetch calls with the `model` variable
- Keep `suggest`, `optimize`, `reflect` using a fixed lightweight model (`z-ai/glm-5.1`) since those are utility calls

### 2. New `src/components/agent/ModelSelector.tsx`
A compact inline selector rendered in the GoalInput toolbar:
- Shows: current model name + `AUTO` chip (when auto) or model name badge (when manual)
- Click opens a small popover/dropdown listing all 5 models
- Each row: name, one-line description, speed badge
- Footer row: "AUTO" option — resets to auto-selection
- Disabled while agent is running

### 3. `src/components/agent/GoalInput.tsx`
- Add `ModelSelector` below the mode toggles
- Track `manualModel: string | null` state (null = auto)
- Compute `activeModel = manualModel ?? getAutoModel(outputMode)`
- Pass `activeModel` via `onRun(goal, outputMode, model)`
- When mode changes and `manualModel === null`, auto model badge updates reactively

### 4. `src/hooks/useHarnessAgent.ts`
- Add optional `model?: string` param to `runAgent(goal, mode, onComplete, evolutionCtx, model?)`
- Store `activeModel: string` in state (for display in header/badge)
- Pass `model` to all `planTasks`, `executeTask`, `streamChat` calls
- Export `activeModel`

### 5. `src/pages/Index.tsx`
- Update `onRun` call: `runAgent(goal, mode, history.addEntry, undefined, model)`

### 6. i18n (`en.json` + `zh.json`)
```json
"modelSelector": {
  "auto": "AUTO",
  "autoDesc": "Automatically selects the best model per mode",
  "manual": "MANUAL",
  "label": "MODEL",
  "models": {
    "deepseek/deepseek-v4-pro": { "name": "DeepSeek V4 Pro", "desc": "Best for code & reasoning" },
    "z-ai/glm-5.1": { "name": "GLM 5.1", "desc": "Long-horizon agent tasks" },
    "z-ai/glm-5": { "name": "GLM 5", "desc": "Complex system design" },
    "moonshotai/kimi-k2.6": { "name": "Kimi K2.6", "desc": "Multimodal, tool use" },
    "minimax/minimax-m2.7": { "name": "MiniMax M2.7", "desc": "Coding & workflows" }
  }
}
```

---

## Files Modified
| File | Change |
|------|--------|
| `supabase/functions/harness-agent/index.ts` | Accept `model` param, propagate to LLM calls |
| `src/components/agent/ModelSelector.tsx` | **NEW** — model picker dropdown |
| `src/components/agent/GoalInput.tsx` | Embed ModelSelector, compute activeModel, pass to onRun |
| `src/hooks/useHarnessAgent.ts` | Add model param to runAgent + downstream calls |
| `src/pages/Index.tsx` | Forward model from GoalInput to runAgent |
| `src/i18n/locales/en.json` + `zh.json` | Add modelSelector.* keys |

## Verification
1. Default mode = Task → badge shows "AUTO · GLM 5.1"
2. Switch to Agent Build → badge auto-updates to "AUTO · DeepSeek V4 Pro"
3. Open picker → select "Kimi K2.6" → badge shows "Kimi K2.6" (manual, no AUTO)
4. Click "AUTO" → reverts to auto selection
5. Run an agent task → Edge Function receives and uses the selected model ID

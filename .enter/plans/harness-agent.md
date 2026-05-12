# Harness Agent — Prompt Suggestions + Optimization

## Context
Two UX enhancements to help users craft better prompts:
1. **Recommended prompts**: Static chips initially → AI-generated contextual suggestions after each conversation
2. **Prompt optimization**: One-click LLM rewrite of current prompt, result replaces textarea directly

---

## Feature 1 — Recommended Prompts

### Data Flow
```
Index.tsx (state: suggestions[], suggestionsLoading)
  ↓ props
GoalInput.tsx (renders chips, clicking fills textarea)
```

**Two phases:**
- **Idle/initial**: Static per-mode suggestions from i18n JSON (4 per mode, already exist as `goalInput.placeholders` and `agentMode.qaChatPlaceholders` — reuse or add dedicated `suggestions.*` keys)
- **After completion**: AI-generated, triggered by `Index.tsx` watching `status` → `"done"` (task/agent) OR watching `qaMessages` last item completing (QA mode)

### Edge Function — `suggest` mode
```typescript
mode: "suggest"
goal: string
outputMode: "text" | "agent" | "qa"
context?: { taskSummary?: string; lastAnswer?: string }
→ returns { suggestions: string[] }   // 3 follow-up prompts, non-streaming
```
System prompt: "You are a creative AI assistant. Based on the completed conversation, generate 3 short, diverse follow-up prompts the user might want to explore next. Return ONLY a JSON array of 3 strings."

### `Index.tsx` changes
- Add `suggestions: string[]` and `suggestionsLoading: boolean` state
- `useEffect` watching `status`:
  - When `status → "done"`: call edge function `suggest` with goal + task summary; update `suggestions`
- `useEffect` watching `qaMessages`:
  - When last message becomes non-streaming assistant message: call `suggest` with last Q+A as context
- On `reset()` / `resetQA()`: reset suggestions back to `[]` (static mode re-activates)
- Pass `suggestions`, `suggestionsLoading` to `GoalInput`

### `GoalInput.tsx` changes
- New props: `suggestions?: string[]`, `suggestionsLoading?: boolean`
- Static suggestions: read from i18n `promptSuggestions.{text|agent|qa}` keys (3 per mode)
- Display logic:
  - `suggestions.length > 0` → show AI-generated chips
  - else → show static per-mode chips
- Render chips below the mode hint, above the input box
- Click chip: `setGoal(chip text)` + focus textarea

---

## Feature 2 — Prompt Optimization

### Edge Function — `optimize` mode
```typescript
mode: "optimize"
goal: string
outputMode: "text" | "agent" | "qa"
→ returns { optimizedPrompt: string }  // non-streaming
```
System prompt per mode:
- `text`: "Optimize this task goal to be clear, specific, and actionable for an autonomous execution agent."
- `agent`: "Optimize this software project specification to be detailed, structured, and implementation-ready."
- `qa`: "Rewrite this question to be more precise, specific, and likely to get a comprehensive answer."

### `GoalInput.tsx` changes
- New internal state: `isOptimizing: boolean`
- New button in bottom toolbar (between char count and execute button):
  - Icon: `Wand2` (lucide)
  - Enabled when: `goal.trim().length > 10 && isIdle && !isOptimizing`
  - On click: `setIsOptimizing(true)` → call edge function → `setGoal(result)` → `setIsOptimizing(false)`
  - Loading state: spinner + "OPTIMIZING..." label
  - The component calls edge function directly (imports `SUPABASE_URL`, `SUPABASE_ANON_KEY` from `@/lib/config`)

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/harness-agent/index.ts` | Add `suggest` + `optimize` modes |
| `src/components/agent/GoalInput.tsx` | Add suggestion chips + optimize button |
| `src/pages/Index.tsx` | Manage AI suggestions state, useEffects, pass props |
| `src/i18n/locales/en.json` | Add `promptSuggestions.*` keys + `goalInput.optimize*` |
| `src/i18n/locales/zh.json` | Same in Chinese |

---

## i18n Keys (new)

```json
"promptSuggestions": {
  "label": "SUGGESTIONS",
  "loading": "Generating suggestions...",
  "text": [
    "Build a web scraper that collects product prices from e-commerce sites",
    "Create a CLI tool that automates git branch management",
    "Write a report on the latest trends in AI agent architectures"
  ],
  "agent": [
    "Build a Python REST API with authentication and database integration",
    "Create a React dashboard with real-time data visualization",
    "Develop a CLI agent that can search and summarize web content"
  ],
  "qa": [
    "What are the key differences between RAG and fine-tuning?",
    "How does transformer attention mechanism work?",
    "Explain the trade-offs between microservices and monolithic architectures"
  ]
},
"goalInput": {
  // existing...
  "optimize": "OPTIMIZE",
  "optimizing": "OPTIMIZING...",
  "optimizeTitle": "Optimize prompt with AI"
}
```

## Verification
1. Open app → see 3 static suggestion chips per mode in GoalInput
2. Switch mode → chips update to mode-specific suggestions
3. Run a task → after completion, chips replace with 3 AI-generated follow-ups
4. Ask a Q&A question → after answer, get 3 AI follow-up suggestions
5. Type a prompt → click OPTIMIZE → textarea content is replaced with improved version
6. OPTIMIZE button disabled when textarea is empty or agent is running

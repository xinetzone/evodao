# Harness Agent — Exploratory Q&A Mode

## Context
Users sometimes want to ask a simple question (e.g. "什么是向量数据库?", "怎么写 Python 装饰器?") without triggering the full task-decomposition pipeline. A lightweight Q&A mode lets users explore ideas conversationally before committing to a full agent run.

## Goal
Add a **third mode toggle** "探索问答 / Q&A" alongside the existing "任务模式" and "智能体构建" toggles. In this mode:
- No planning step — single streaming call directly to the LLM
- Multi-turn conversation: each answer streams in, then the user can immediately ask a follow-up
- Terminal-aesthetic chat display replacing the task list/terminal output
- No evolution panel
- Conversation persists until manual reset

---

## Implementation Plan

### 1. Edge Function — `supabase/functions/harness-agent/index.ts`
Add `chat` mode (non-task streaming):
```typescript
} else if (mode === "chat") {
  // messages: Array<{role, content}> — full conversation
  const response = await fetch(API_BASE, {
    body: JSON.stringify({
      model: "z-ai/glm-5.1",
      messages: [
        { role: "system", content: "You are a knowledgeable, helpful assistant. Answer clearly and concisely. Use markdown formatting when it aids readability." },
        ...(messages || [{ role: "user", content: goal }]),
      ],
      stream: true,
    }),
  });
  return pass-through SSE response
}
```

---

### 2. `src/hooks/useHarnessAgent.ts`

**New types:**
```typescript
export interface QAMessage {
  role: "user" | "assistant";
  content: string;
}
// Add "qa" to OutputMode
export type OutputMode = "text" | "agent" | "qa";
```

**New state:**
- `qaMessages: QAMessage[]` — conversation history
- `qaMessagesRef` — ref for closure access

**New `runAgent` QA branch** (when `mode === "qa"`):
1. Append user msg to `qaMessages`
2. Append placeholder `{ role: "assistant", content: "" }` (streaming target)
3. Set `status = "executing"`, skip planTasks
4. Call edge function with `mode: "chat"` + full `messages` array
5. Stream chunks into last `qaMessages` entry
6. On complete: **auto-reset `status` back to `"idle"`** (no "done" state) — seamless multi-turn
7. On error: remove pending assistant placeholder, set error

**New `resetQA()` function:**
- Clears `qaMessages`, resets status, clears goal — full conversation reset

**Update `reset()`:**
- Also clears `qaMessages`

---

### 3. New `src/components/agent/QAOutput.tsx`

Conversation display in terminal aesthetic:
- Each user turn: dim `> USER: question` line
- Each assistant turn: streaming terminal text
- Last assistant message animates in with blinking cursor while streaming
- "Clear conversation" button in header (calls `resetQA`)
- Copy-to-clipboard for individual responses

---

### 4. `src/components/agent/GoalInput.tsx`

- Add 3rd toggle: `"qa"` mode (label: `t("qaMode.qaChat")`)
- When mode is `"qa"`: show a different placeholder set ("探索式问题" examples)
- When mode is `"qa"` and `isRunning`: show abort button as usual
- When mode is `"qa"` and NOT running (idle after auto-reset): no extra button needed — textarea is already active and ready
- Add hint text for QA mode (similar to agent build hint)

---

### 5. `src/pages/Index.tsx`

Conditional rendering:
```
outputMode === "qa"
  → show QAOutput (when qaMessages.length > 0)
  → hide: TaskList, TerminalOutput, FileTree, completion banner, EvolutionPanel
  → hide: planning indicator (QA has no planning step)
  
outputMode !== "qa"
  → show existing layout unchanged
```
Pass `qaMessages`, `resetQA` to QAOutput.

---

### 6. i18n — `en.json` + `zh.json`

```json
"qaMode": {
  "qaChat": "探索问答",          // "Q&A" in en
  "qaChatHint": "直接提问，无需任务拆解",  // "Ask directly — no task decomposition"
  "qaChatPlaceholders": [
    "什么是向量数据库？",
    "如何用 Python 实现单例模式？",
    "React useEffect 的清理函数什么时候执行？",
    "解释一下 CAP 定理"
  ],
  "clearChat": "清空对话",
  "you": "YOU",
  "assistant": "AGENT",
  "thinking": "思考中..."
}
```

---

## Files Modified
| File | Change |
|------|--------|
| `supabase/functions/harness-agent/index.ts` | Add `chat` mode |
| `src/hooks/useHarnessAgent.ts` | Add `QAMessage`, `"qa"` in `OutputMode`, `qaMessages`, QA branch in `runAgent`, `resetQA` |
| `src/components/agent/GoalInput.tsx` | Add 3rd mode toggle + QA placeholders/hint |
| `src/components/agent/QAOutput.tsx` | **NEW** — conversation display |
| `src/pages/Index.tsx` | Conditional rendering for QA vs task modes |
| `src/i18n/locales/en.json` | Add `qaMode.*` keys |
| `src/i18n/locales/zh.json` | Add `qaMode.*` keys |

## Verification
1. Select "探索问答" in GoalInput and ask a simple question → single streaming response, no planning dots
2. Ask a follow-up → second exchange appears, conversation accumulates
3. Click "Clear conversation" → conversation resets
4. Switch to Task Mode → full plan+execute pipeline works as before
5. History/Evolution/FileTree not shown in QA mode

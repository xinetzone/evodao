# Harness Agent — Implementation Plan

## Context
Build a Harness Agent web app: user inputs a goal, the AI automatically decomposes it into sub-tasks and executes each one step-by-step with streaming output. Uses GLM 5.1 (openai_chat_completions protocol) via Enter Cloud Edge Functions. Dark terminal-style UI.

---

## Architecture Overview

```
User Goal → [Plan Phase] → Task List → [Execute Phase × N] → Streamed Results
```

**Two-mode Edge Function**:
- `mode: "plan"` → calls LLM (stream:false), returns JSON task array
- `mode: "execute"` → calls LLM (stream:true), streams SSE execution output

---

## Step 1 — Enable Enter Cloud (Supabase)
Required for Edge Functions. Call `supabase_enable` tool first.

---

## Step 2 — Install Frontend Dependency
```
@microsoft/fetch-event-source
```

---

## Step 3 — Design Tokens (Dark Terminal Theme)
Update `src/index.css`:
- Background: `222 47% 5%` (very dark blue-black)
- Foreground: `142 100% 85%` (terminal green text)
- Primary: `142 76% 45%` (bright terminal green)
- Card: `222 47% 8%`
- Border: `222 30% 16%`
- Add terminal glow animations, `--shadow-glow`, `--gradient-terminal`
- Force dark mode on `<html>` element via `src/main.tsx`
- Add `pulse-dot`, `typing-cursor`, `fade-in` keyframes

Update `tailwind.config.ts`: add `terminal` color palette and animation utilities.

---

## Step 4 — Edge Function
File: `supabase/functions/harness-agent/index.ts`

```
POST { mode: "plan", goal: string }
→ Response: JSON  { tasks: [{ id, title, description }] }

POST { mode: "execute", goal: string, task: { id, title, description }, context: string[] }
→ Response: SSE stream (openai_chat_completions format)
```

System prompts:
- **Plan mode**: Ask GLM 5.1 to return a JSON array of 3–6 tasks to achieve the goal
- **Execute mode**: Ask GLM 5.1 to execute a specific task given goal + previous results context

Model: `z-ai/glm-5.1`

---

## Step 5 — Frontend Files

### `src/hooks/useHarnessAgent.ts`
Manages full agent lifecycle:
- `agentStatus`: `"idle" | "planning" | "executing" | "done" | "error"`
- `tasks`: `Task[]` (from plan phase)
- `taskStatuses`: `Record<id, "pending" | "running" | "completed" | "error">`
- `taskResults`: `Record<id, string>` (streaming content per task)
- `activeTaskId`: currently executing task
- `runAgent(goal)`: triggers plan → execute loop
- `reset()`: clears state

**Plan call**: fetch (non-streaming) to Edge Function `mode=plan`
**Execute call**: SSE via `@microsoft/fetch-event-source` to `mode=execute`, 4-level error handling

### `src/components/agent/GoalInput.tsx`
- Full-width textarea with terminal cursor styling
- "Run Agent" button (green, with circuit icon)
- Disabled while agent is running

### `src/components/agent/AgentHeader.tsx`
- App name "HARNESS AGENT" with terminal styling
- Status indicator (idle/planning/executing/done)
- Animated pulse dot during activity

### `src/components/agent/TaskList.tsx`
- Horizontal or vertical list of task cards
- Each task shows: index, title, description, status badge
- Color: pending (muted) → running (green pulsing) → completed (bright green) → error (red)

### `src/components/agent/StepExecution.tsx`
- Scrollable terminal-style output area
- Each task's streaming content in its own section
- Shows task title header, then streaming text with cursor

### `src/pages/Index.tsx`
- Full-height dark layout
- Sections: Header → Goal Input → (on run) Task Plan → Execution Output
- Import `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Supabase client file

---

## Critical Files
| File | Action |
|------|--------|
| `src/index.css` | Update design tokens + add animations |
| `tailwind.config.ts` | Add terminal colors |
| `src/main.tsx` | Add `dark` class to root |
| `src/pages/Index.tsx` | Rewrite as main agent page |
| `src/hooks/useHarnessAgent.ts` | New — agent logic |
| `src/components/agent/GoalInput.tsx` | New |
| `src/components/agent/AgentHeader.tsx` | New |
| `src/components/agent/TaskList.tsx` | New |
| `src/components/agent/StepExecution.tsx` | New |
| `supabase/functions/harness-agent/index.ts` | New — Edge Function |

---

## Verification
1. Enter a goal like "Build a personal finance tracker"
2. Agent displays 3–6 decomposed tasks
3. Each task executes sequentially with streaming text
4. Terminal UI shows real-time output with green text on dark background
5. After all tasks complete, status shows "Done"

# Task Manager — Multi-Session Concurrent Agent Monitor

## Context
User wants to run multiple independent agent goals simultaneously and monitor them all from a unified panel. The current `useHarnessAgent` manages a single session; this adds a fully parallel multi-session layer on top.

---

## Architecture

### Data Model

```typescript
// src/hooks/useTaskManager.ts
interface AgentSession {
  id: string;
  goal: string;
  outputMode: OutputMode;
  model: string;
  status: AgentStatus;          // "planning" | "executing" | "done" | "error" | "idle"
  tasks: Task[];
  taskStatuses: Record<number, TaskStatus>;
  taskOutputs: Record<number, string>;
  activeTaskIds: Set<number>;
  error: string | null;
  createdAt: number;
  completedAt?: number;
}
```

### Core Approach

1. Extract shared edge-function callers into **`src/lib/agentCore.ts`** (pure async module-level utils, no React state — can be called from any context):
   - `planTasksCore(goal, mode, model): Promise<Task[]>`
   - `executeTaskCore(goal, task, context, mode, model, signal, onChunk): Promise<void>`

2. New **`src/hooks/useTaskManager.ts`** hook manages `AgentSession[]` in a single `useState`. Uses functional updates (`setSessions(prev => ...)`) to safely update individual sessions during concurrent streaming.

3. New **`src/components/agent/TaskManagerPanel.tsx`** — slide-in panel (same pattern as `HistoryPanel`).

4. **`AgentHeader`** gets a new "任务管理器" button + active-session badge.

5. **`Index.tsx`** wires it up.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/lib/agentCore.ts` | **NEW** — pure planTasks + executeTask utilities |
| `src/hooks/useTaskManager.ts` | **NEW** — multi-session state + execution |
| `src/components/agent/TaskManagerPanel.tsx` | **NEW** — panel UI |
| `src/components/agent/AgentHeader.tsx` | MODIFY — add Task Manager button + badge |
| `src/pages/Index.tsx` | MODIFY — integrate hook + panel |
| `src/i18n/locales/zh.json` | MODIFY — `taskManager.*` keys |
| `src/i18n/locales/en.json` | MODIFY — same |

---

## `src/lib/agentCore.ts`

Extract from `useHarnessAgent.ts`:
- `planTasksCore` — same logic as current `planTasks` (fetch + JSON parse)
- `executeTaskCore` — same logic as `executeTask` (fetchEventSource + settled pattern), accepts `AbortSignal`
- Imports `SUPABASE_URL`, `SUPABASE_ANON_KEY` from `@/lib/config`

---

## `src/hooks/useTaskManager.ts`

```typescript
export function useTaskManager() {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const runControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Add and immediately run a new session in the background
  const addSession = (goal: string, outputMode: OutputMode, model: string) => {
    const id = crypto.randomUUID();
    setSessions(prev => [...prev, { id, goal, outputMode, model, status: "planning",
      tasks: [], taskStatuses: {}, taskOutputs: {}, activeTaskIds: new Set(),
      error: null, createdAt: Date.now() }]);
    _runSession(id, goal, outputMode, model); // fire-and-forget
  };

  const _runSession = async (id, goal, outputMode, model) => {
    const runCtrl = new AbortController();
    runControllersRef.current.set(id, runCtrl);
    try {
      // Plan
      const tasks = await planTasksCore(goal, outputMode, model);
      const initStatuses = Object.fromEntries(tasks.map(t => [t.id, "pending"]));
      setSessions(prev => prev.map(s => s.id === id
        ? { ...s, status: "executing", tasks, taskStatuses: initStatuses,
            activeTaskIds: new Set(tasks.map(t => t.id)) }
        : s));

      // Execute all tasks in parallel
      const results = await Promise.allSettled(tasks.map(async (task) => {
        const taskCtrl = new AbortController();
        runCtrl.signal.addEventListener("abort", () => taskCtrl.abort(), { once: true });
        
        setSessions(prev => prev.map(s => s.id === id
          ? { ...s, taskStatuses: { ...s.taskStatuses, [task.id]: "running" },
              taskOutputs: { ...s.taskOutputs, [task.id]: "" } }
          : s));

        let content = "";
        await executeTaskCore(goal, task, [], outputMode, model, taskCtrl.signal, (chunk) => {
          content += chunk;
          setSessions(prev => prev.map(s => s.id === id ? {
            ...s, taskOutputs: { ...s.taskOutputs, [task.id]: (s.taskOutputs[task.id] || "") + chunk }
          } : s));
        });

        setSessions(prev => prev.map(s => s.id === id
          ? { ...s,
              taskStatuses: { ...s.taskStatuses, [task.id]: "completed" },
              activeTaskIds: new Set([...s.activeTaskIds].filter(x => x !== task.id)) }
          : s));
        return content;
      }));

      const firstAbort = results.find(r => r.status === "rejected" && r.reason?.name === "AbortError");
      if (firstAbort) return; // silently stop
      const firstError = results.find(r => r.status === "rejected");
      if (firstError) throw (firstError as PromiseRejectedResult).reason;

      setSessions(prev => prev.map(s => s.id === id
        ? { ...s, status: "done", activeTaskIds: new Set(), completedAt: Date.now() }
        : s));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setSessions(prev => prev.map(s => s.id === id
        ? { ...s, status: "error", error: err instanceof Error ? err.message : "Failed" }
        : s));
    } finally {
      runControllersRef.current.delete(id);
    }
  };

  const abortSession = (id: string) => {
    runControllersRef.current.get(id)?.abort();
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: "idle", activeTaskIds: new Set() } : s));
  };

  const removeSession = (id: string) => {
    runControllersRef.current.get(id)?.abort();
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const clearCompleted = () => {
    setSessions(prev => prev.filter(s => s.status !== "done" && s.status !== "error"));
  };

  const runningCount = sessions.filter(s => s.status === "planning" || s.status === "executing").length;

  return { sessions, addSession, abortSession, removeSession, clearCompleted, runningCount };
}
```

---

## `src/components/agent/TaskManagerPanel.tsx`

Layout: Full-height slide-in from right (same as HistoryPanel: `fixed inset-y-0 right-0 w-full max-w-xl`).

Sections:
1. **Header bar**: "任务管理器" label + running count badge + close button
2. **Quick-add form**: compact single-line input + mode chips + model selector + "添加任务" button
3. **Session list**: scrollable, sorted by `createdAt` DESC
   - Each **SessionCard**:
     - Status icon + goal text (truncated)
     - Mini progress bar: `completedTasks / totalTasks`
     - Task chips row: colored dots per task status (pending/running/done/error)
     - Expandable: clicking card reveals inline terminal output (last 200 chars per task)
     - Actions: abort button (if running), remove button (✕)
4. **Empty state**: "暂无任务" when sessions array is empty

SessionCard status colors:
- planning → yellow/amber pulsing
- executing → green (primary) pulsing
- done → green solid
- error → red
- idle (aborted) → muted

---

## `AgentHeader` Changes

Add props:
```typescript
taskManagerRunning: number;   // count of running sessions
onTaskManagerOpen: () => void;
```

Add button (next to History button):
```tsx
<button onClick={onTaskManagerOpen} ...>
  <LayoutGrid className="w-3.5 h-3.5" />
  <span>任务管理器</span>
  {taskManagerRunning > 0 && <badge>{taskManagerRunning}</badge>}
</button>
```

---

## `Index.tsx` Changes

```tsx
const taskManager = useTaskManager();
const [taskManagerOpen, setTaskManagerOpen] = useState(false);

// AgentHeader gets new props
<AgentHeader
  ...
  taskManagerRunning={taskManager.runningCount}
  onTaskManagerOpen={() => setTaskManagerOpen(true)}
/>

// Add TaskManagerPanel
<TaskManagerPanel
  open={taskManagerOpen}
  onClose={() => setTaskManagerOpen(false)}
  {...taskManager}
/>
```

---

## i18n Keys to Add (zh + en)

```json
"taskManager": {
  "title": "任务管理器",
  "addTask": "添加任务",
  "addPlaceholder": "输入目标...",
  "empty": "暂无任务，添加第一个目标",
  "clearCompleted": "清除已完成",
  "running": "运行中",
  "abort": "中止",
  "remove": "移除",
  "tasksProgress": "{{done}} / {{total}}",
  "noTasks": "等待规划..."
}
```

---

## Verification

1. Open Task Manager panel via header button
2. Add 2-3 different goals — all should start planning/executing simultaneously
3. Check that main single-session view is unaffected
4. Abort a running session — its status changes to idle, streaming stops
5. Sessions persist in the panel until manually removed
6. Badge on header button shows correct running count

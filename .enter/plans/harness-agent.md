# Task Dependency Optimization Plan — Trae SOLO Architecture

## Context

The current `runExecutionLoop` launches ALL pending tasks simultaneously via `Promise.allSettled`, passing only
outputs from pre-completed tasks (e.g., resumed sessions) as context. There is no concept of task dependencies —
every task gets the same static context regardless of which other tasks it needs to build on.

The request is to refactor this to match the **Trae SOLO** concurrent-workflow architecture:
- LLM plan declares a **dependency graph** (`dependsOn` field per task)
- Tasks with no unmet dependencies **start immediately in parallel**
- Tasks with dependencies **block and wait** until all their deps complete, then receive dep outputs as context
- Maximum concurrency is preserved — only true sequencing constraints cause waiting

---

## Architecture: Promise-Cache DAG Scheduler

Core pattern: `getOrExecute(taskId)` — a recursive promise cache.

```
taskPromises: Map<taskId, Promise<string>>

getOrExecute(id):
  if cached → return cached promise
  p = async () =>
        if deps.length > 0: mark task as "blocked"
        depOutputs = await Promise.all(deps.map(getOrExecute))   // parallel dep resolution
        build depContext from depOutputs (800 chars each, direct deps only)
        mark task as "running"
        execute task with [...completedContext, ...depContext]
        return taskOutput
  cache p; return p

scheduler:
  await Promise.allSettled(pendingTasks.map(t => getOrExecute(t.id)))
```

**Dependency topology output** (printed to plan description in UI):
- Tasks with `dependsOn: []` → Layer 0 (root, run immediately)
- Tasks that depend on Layer 0 → Layer 1 (run after Layer 0)
- etc. — Kahn's topological layers for visual display

---

## Files to Modify

### 1. `src/hooks/useEvodaoAgent.ts`

**a) Extend `Task` interface:**
```typescript
export interface Task {
  id: number;
  title: string;
  description: string;
  dependsOn?: number[];   // ADD: direct prerequisite task IDs
}
```

**b) Extend `TaskStatus` type:**
```typescript
export type TaskStatus = "pending" | "blocked" | "running" | "completed" | "error";
```
`"blocked"` = has unmet dependencies, waiting. Visually distinct from `"pending"`.

**c) Replace `runExecutionLoop` with DAG scheduler:**

Key behavioral changes vs. current:
- `initialRunning` block removed — tasks start as `"pending"` (or `"blocked"` if they have deps)
- `getOrExecute` function created inside `runExecutionLoop` (closure over state setters)
- Context per task = `[...completedContext (pre-completed, 400 chars each), ...depContext (800 chars each, direct deps only)]`
- Per-task abort controller logic preserved exactly as-is
- `setActiveTaskIds` transitions moved inside `getOrExecute` (add on start, remove on finish)
- Circular dependency guard: strip back edges before scheduling (DFS-based, mutates `task.dependsOn`)

**d) `taskStatuses` initial state:** For each pending task:
  - Has `dependsOn` → start as `"blocked"`
  - No `dependsOn` (or empty array) → start as `"pending"`

**e) `setActiveTaskIds` initial call removed** — was setting all pending tasks active at once. Now managed per-task inside `getOrExecute`.

---

### 2. `supabase/functions/harness-agent/index.ts`

**Update `getPlanSystemPrompt`** — both branches (`"agent"` and default):

Old format:
```
[{"id":1,"title":"...","description":"..."},...]
```

New format (add `dependsOn`):
```
[
  {"id":1,"title":"...","description":"...","dependsOn":[]},
  {"id":2,"title":"...","description":"...","dependsOn":[1]},
  {"id":3,"title":"...","description":"...","dependsOn":[]},
  {"id":4,"title":"...","description":"...","dependsOn":[2,3]}
]
```

Prompt instruction addition:
> `"dependsOn"` must be an array of task IDs that this task requires as input. Use `[]` for root tasks.
> Maximize parallelism: only add a dependency when the task genuinely needs the output of another task.

---

### 3. `src/components/agent/TaskList.tsx`

**a) Add `"blocked"` entry to `statusStyleMap`:**
```typescript
blocked: {
  icon: <Lock className="w-3 h-3 text-muted-foreground/60" />,  // lucide Lock icon
  cardClass: "border-border/50 bg-card/30",
  titleClass: "text-muted-foreground/60",
  numberClass: "text-muted-foreground/40 bg-muted/50",
  dotClass: "bg-muted-foreground/20",
},
```

**b) Add `Lock` to lucide imports.**

**c) Show dependency badge on task cards** (when `task.dependsOn?.length > 0`):
```tsx
{task.dependsOn && task.dependsOn.length > 0 && (
  <span className="text-[9px] text-muted-foreground/50 font-mono">
    ← {task.dependsOn.join(",")}
  </span>
)}
```

---

### 4. `src/i18n/locales/zh.json` + `en.json`

Add symmetric keys:
```json
// zh
"taskStatus": {
  "blocked": "等待依赖"
},
"taskList": {
  "dependsOn": "依赖任务"
}

// en
"taskStatus": {
  "blocked": "Waiting"
},
"taskList": {
  "dependsOn": "Depends on"
}
```

---

## Circular Dependency Guard

Before scheduling, run a DFS-based cycle detector on the resolved task graph.
Any back edge (edge that creates a cycle) is removed from `task.dependsOn`.
This ensures the scheduler never deadlocks even if the LLM returns a bad graph.

```typescript
function stripCycles(tasks: Task[]): Task[] {
  const visiting = new Set<number>();
  const visited = new Set<number>();
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  function dfs(id: number, path: Set<number>) {
    if (path.has(id)) return; // cycle — caller will remove this edge
    if (visited.has(id)) return;
    path.add(id);
    visiting.add(id);
    const task = taskMap.get(id);
    if (task?.dependsOn) {
      task.dependsOn = task.dependsOn.filter(depId => {
        if (path.has(depId)) return false; // back edge — strip
        dfs(depId, path);
        return true;
      });
    }
    path.delete(id);
    visited.add(id);
  }

  tasks.forEach(t => { if (!visited.has(t.id)) dfs(t.id, new Set()); });
  return tasks;
}
```

---

## Dependency Topology Output

After plan is received in `planTasks()`, compute and log topology layers:

```typescript
function computeLayers(tasks: Task[]): number[][] {
  const layers: number[][] = [];
  const remaining = new Set(tasks.map(t => t.id));
  const completed = new Set<number>();
  while (remaining.size > 0) {
    const layer = [...remaining].filter(id => {
      const task = tasks.find(t => t.id === id)!;
      return (task.dependsOn || []).every(dep => completed.has(dep));
    });
    if (layer.length === 0) break; // safety: remaining has unresolvable cycle
    layer.forEach(id => { remaining.delete(id); completed.add(id); });
    layers.push(layer);
  }
  return layers;
}
```

This is used to display topology in task descriptions and for UI ordering hints.

---

## Backward Compatibility

- `dependsOn` is **optional** (`dependsOn?: number[]`). Tasks without it behave exactly as before (all run in parallel immediately).
- Saved sessions (`SavedSession`) are unaffected — `dependsOn` is part of `Task[]` which is already serialized.
- History entries (`HistoryEntry`) also include `Task[]` — `dependsOn` persists to history automatically.
- `completedContext` from pre-resumed tasks is still passed (same 400-char truncation as before).

---

## Verification

1. **Pure parallel (no deps):** Run a goal. All tasks start simultaneously (all `"running"` at once). Behavior identical to current.
2. **Linear chain:** LLM returns `[{id:1,dependsOn:[]}, {id:2,dependsOn:[1]}, {id:3,dependsOn:[2]}]`. Tasks execute strictly 1→2→3. Task 2 receives Task 1's output in context.
3. **Diamond pattern:** `[{1,[]}, {2,[1]}, {3,[1]}, {4,[2,3]}]`. Tasks 2 and 3 run in parallel after 1. Task 4 waits for both 2 and 3.
4. **Cycle guard:** Manually test `[{1,[2]}, {2,[1]}]`. Both back edges stripped, tasks run independently.
5. **UI blocked state:** A task with unmet deps shows Lock icon + muted styling while waiting.
6. **Abort:** Stop button mid-run — all tasks (including blocked/waiting ones) abort correctly via parent `runController`.

# Plan: Track Real Token Consumption Including Incomplete Tasks

## Context

The `usage_logs` table exists and is read by `useUserUsage`, but it's not getting
populated correctly. Two-phase logging already exists (`recordUsage` at run start,
`finalizeUsage` at run end) but has these bugs:

1. **SessionUsage accumulates across runs** — `runAgent` never resets `sessionUsage`,
   so if the user runs A then B without a full `reset()`, run B's `finalizeUsage` logs
   A's tokens + B's tokens (overcounting).
2. **Error/abort runs never finalized** — `finalizeUsage` only fires on
   `status === "done"` or QA `idle`. On `status === "error"` and on user abort
   (which calls `reset()` → `status = "idle"`), the pending log row stays at 0 tokens.
3. **Abort race condition** — `reset()` zeroes `sessionUsage` in the same React batch
   as setting `status = "idle"`, so a `useEffect` watching status can't see the tokens.
   Must capture tokens in `handleReset` *before* calling `reset()`.

## Critical Files

- `src/hooks/useEvodaoAgent.ts` — add sessionUsage reset at start of each runAgent call
- `src/pages/Index.tsx` — fix handleReset + status useEffect; add statsRefreshKey
- `src/components/agent/UsagePanel.tsx` — accept refreshKey prop to re-fetch after runs

## Exact Changes

### 1. `src/hooks/useEvodaoAgent.ts`

In `runAgent`, at the very top of BOTH the QA branch and the task/agent branch,
add a sessionUsage reset **before any async work** so each run starts from zero:

```typescript
// QA mode start:
setSessionUsage({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });

// Task/agent mode start (right after setExtractedFiles([])):
setSessionUsage({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
```

### 2. `src/pages/Index.tsx`

**A. Add `statsRefreshKey` state** (near pendingLogId):
```typescript
const [statsRefreshKey, setStatsRefreshKey] = useState(0);
```

**B. Update `handleReset`** — capture + finalize partial usage BEFORE calling `reset()`:
```typescript
const handleReset = () => {
  // Finalize partial usage before reset() zeroes sessionUsage
  if (pendingLogId && sessionUsage.totalTokens > 0) {
    finalizeUsage(pendingLogId, sessionUsage, pendingModel);
    setPendingLogId(null);
    setPendingModel("");
    setStatsRefreshKey((k) => k + 1);
  }
  setSuggestions([]);
  setSuggestionsAI(false);
  prevQACountRef.current = 0;
  aiImage.clearImages();
  setLastRunMode("");
  memory.clearMemories();
  reset();
};
```

**C. Extend status `useEffect`** — add error case + increment statsRefreshKey:
```typescript
const isError =
  status === "error" &&
  (prevStatusRef.current === "executing" || prevStatusRef.current === "planning");

if ((isDoneTransition || isQAFinished || isError) && pendingLogId && sessionUsage.totalTokens > 0) {
  finalizeUsage(pendingLogId, sessionUsage, pendingModel);
  setPendingLogId(null);
  setPendingModel("");
  setStatsRefreshKey((k) => k + 1);
}
```

**D. Pass `statsRefreshKey` to UsagePanel**:
```tsx
<UsagePanel open={usagePanelOpen} onClose={...} refreshKey={statsRefreshKey} />
```

### 3. `src/components/agent/UsagePanel.tsx`

**A. Add `refreshKey` to props interface**:
```typescript
interface UsagePanelProps {
  open: boolean;
  onClose: () => void;
  refreshKey?: number;
}
```

**B. Accept `refreshKey` in component and trigger fetchStats when it changes**:
```typescript
export function UsagePanel({ open, onClose, refreshKey }: UsagePanelProps) {
  ...
  // Fetch on open; also re-fetch whenever refreshKey increments (run just finalized)
  useEffect(() => {
    if (open) fetchStats();
  }, [open, refreshKey]);
  ...
}
```

## What This Fixes

| Scenario | Before | After |
|----------|--------|-------|
| Successful run | ✅ logged | ✅ logged |
| Run with error | ❌ 0 tokens in DB | ✅ partial tokens logged |
| User aborts (Stop button) | ❌ 0 tokens in DB | ✅ partial tokens logged |
| QA error | ❌ 0 tokens in DB | ✅ tokens logged |
| 2nd run without reset | ❌ cumulative tokens | ✅ accurate per-run tokens |
| UsagePanel auto-refresh | ❌ stale after run | ✅ live after finalization |

## Verification

After changes:
1. Run an agent task → complete → open UsagePanel → verify non-zero tokens in recent log
2. Start a run → click Stop midway → open UsagePanel → verify partial tokens logged
3. Start a run that errors → open UsagePanel → verify error run tokens logged
4. Run two tasks back-to-back → verify each log row shows only that run's tokens

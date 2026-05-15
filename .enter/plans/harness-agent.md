# Plan: Fix Token Tracking — Cumulative Display + Accurate Per-Run Logs

## Problem with Last Change

The previous fix added `setSessionUsage({ …zeros })` at the start of each `runAgent` call.
This **broke** the intended behaviour:
- `sessionUsage` is shown in the header as a cumulative session counter (all runs total).
  Resetting it on every new run wiped that live display.

## Root Cause

There are two separate concerns that need different handling:

| Concern | What it shows | Should reset? |
|---------|--------------|---------------|
| `sessionUsage` in header | Live cumulative total for this browser session | ❌ Never — accumulates forever |
| `usage_logs` rows in DB | Per-run token cost for stats panel | N/A — one row per run |

The bug is that `finalizeUsage` was called with the *cumulative* `sessionUsage` instead
of the *delta* (tokens used only in this run). That inflates every log row after the first.

## Solution: Per-Run Delta via Snapshot

1. Capture `sessionUsage` as a **snapshot** immediately before each run starts.
2. At finalization time, compute `delta = sessionUsage − snapshot` and pass that to
   `finalizeUsage` instead of the raw `sessionUsage`.
3. `sessionUsage` continues to accumulate undisturbed for the header display.

## Critical Files

- `src/hooks/useEvodaoAgent.ts` — revert the two `setSessionUsage` resets added last change
- `src/pages/Index.tsx` — add `runStartUsage` snapshot state; compute delta in finalization

## Exact Changes

### 1. `src/hooks/useEvodaoAgent.ts` — revert

Remove the two lines added in the last commit:
```typescript
// QA mode start — DELETE this line:
setSessionUsage({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });

// Task mode start — DELETE this line:
setSessionUsage({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
```

### 2. `src/pages/Index.tsx`

**A. Add `runStartUsage` snapshot state** (near `pendingLogId`):
```typescript
const [runStartUsage, setRunStartUsage] = useState<TokenUsage>({
  promptTokens: 0, completionTokens: 0, totalTokens: 0
});
```

**B. Capture snapshot right before `recordUsage`** (inside the onSubmit handler):
```typescript
// Snapshot current usage so we can log only this run's delta
setRunStartUsage(sessionUsage);
const logId = await recordUsage(mode, model);
setPendingLogId(logId);
setPendingModel(model);
```

**C. Helper inside the component** — compute delta before passing to finalizeUsage:
```typescript
// Reusable helper (no hook, just a local function defined once inside the component)
const getRunDelta = useCallback((): TokenUsage => ({
  promptTokens: Math.max(0, sessionUsage.promptTokens - runStartUsage.promptTokens),
  completionTokens: Math.max(0, sessionUsage.completionTokens - runStartUsage.completionTokens),
  totalTokens: Math.max(0, sessionUsage.totalTokens - runStartUsage.totalTokens),
}), [sessionUsage, runStartUsage]);
```

**D. Update all three `finalizeUsage` call sites** to pass `getRunDelta()`:

1. In `handleReset` (abort path):
```typescript
if (pendingLogId && sessionUsage.totalTokens > runStartUsage.totalTokens) {
  finalizeUsage(pendingLogId, getRunDelta(), pendingModel);
  ...
}
```

2. In the status `useEffect` (done / QA-finished / error):
```typescript
if ((...) && pendingLogId && sessionUsage.totalTokens > runStartUsage.totalTokens) {
  finalizeUsage(pendingLogId, getRunDelta(), pendingModel);
  ...
}
```

## What This Achieves

- `sessionUsage` in the header continues to grow across all runs — cumulative as intended
- Each `usage_logs` row records only that run's token delta — accurate per-run stats
- Abort / error / done all still get logged correctly (from the abort/error fixes done previously)
- `UsagePanel` auto-refresh after finalization (from `statsRefreshKey`) is kept intact

## Verification

1. Run task A → header shows e.g. 1200 tokens total
2. Run task B immediately → header grows to e.g. 1800 tokens total (cumulative)
3. Open UsagePanel → two rows: task A shows ~1200, task B shows ~600 (deltas, not cumulative)
4. Start task C, click Stop → partial row appears with only task C's partial tokens

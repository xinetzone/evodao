# Plan: Incomplete Task Should Not Affect New Runs

## Context

When an agent run is interrupted (page refresh, network drop), the session is
auto-saved to `localStorage`. On next page load, a "resume" banner appears.

**The problem**: The resume banner stays visible while the user types a completely
new goal and clicks Execute. Until the user explicitly clicks "忽略", the old
task's state lingers. Additionally:

- `runAgent` task mode calls `setSavedSession(null)` (clears React state) but
  never calls `localStorage.removeItem(STORAGE_KEY)` — so the old session can
  persist in localStorage.
- `runAgent` QA mode never calls `setSavedSession(null)` at all.

## Fix

Three targeted changes:

### 1. `src/pages/Index.tsx` — dismiss banner immediately on new run

In the `onRun` callback, call `dismissSavedSession()` right at the top (before
quota check) so the banner vanishes the moment the user submits a new goal:

```typescript
onRun={async (goal, mode, model, attachments) => {
  // Clear any pending resume session immediately — new run takes priority
  dismissSavedSession();
  // ... rest of existing handler
```

### 2. `src/hooks/useEvodaoAgent.ts` — also clear localStorage in runAgent task mode

Right after `setSavedSession(null)` at task mode start, also remove from localStorage:

```typescript
setSavedSession(null);
localStorage.removeItem(STORAGE_KEY);   // ← add this line
```

### 3. `src/hooks/useEvodaoAgent.ts` — QA mode also clears saved session

At the top of the QA branch (after `setError(null)`), add:

```typescript
setSavedSession(null);
localStorage.removeItem(STORAGE_KEY);
```

## Critical Files

- `src/pages/Index.tsx` — add `dismissSavedSession()` at top of `onRun`
- `src/hooks/useEvodaoAgent.ts` — add localStorage cleanup in both task and QA modes

## Result

- Resume banner disappears immediately when user clicks Execute ✅
- Starting a new run always fully clears the old saved session ✅
- QA runs also clear the saved session (previously not cleared) ✅
- If user wants to resume, they can still click "继续执行" BEFORE submitting ✅

## Verification

1. Run a task, interrupt mid-way (simulate page-refresh scenario by clicking Reset
   mid-execution then reloading) → confirm resume banner appears
2. Type a new different goal → click Execute → confirm banner disappears instantly
   and the NEW task runs (not the old one)
3. Check localStorage after new run completes → old session key should be gone

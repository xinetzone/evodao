# Plan: Optimize Agent Memory Logic & Performance

## Context

User asked to optimize "历史记忆逻辑与性能". Code analysis found multiple bugs and performance problems:

| # | Severity | Issue |
|---|----------|-------|
| 1 | **Critical** | `agent_memory` has no `user_id` column — all users share the same memory pool (privacy bug) |
| 2 | **Critical** | RLS policy on `agent_memory` is `public_all = true` — no row isolation |
| 3 | **Perf** | `useMemory.ts` calls `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)` inside every function instead of using the shared singleton |
| 4 | **Perf** | `searchMemory` makes **2 DB round trips** (keyword ILIKE + recency fallback). Can be merged into 1 |
| 5 | **Logic** | Keyword extraction uses `length > 3` filter — drops CJK characters (single char) and short acronyms (AI, ML, ...) |
| 6 | **DB** | No index on `agent_memory` for the search column `goal`, ILIKE does full table scan |

---

## Implementation Plan

### Step 1: DB Migration

```sql
-- 1. Add user_id column (nullable to safely handle existing rows)
ALTER TABLE agent_memory
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users ON DELETE CASCADE;

-- 2. Create composite index (user_id + quality_score + created_at) for fast retrieval
CREATE INDEX IF NOT EXISTS agent_memory_user_quality_date
  ON agent_memory (user_id, quality_score DESC NULLS LAST, created_at DESC);

-- 3. Fix RLS: drop public_all, add per-user isolation
DROP POLICY IF EXISTS public_all ON agent_memory;
CREATE POLICY own_memory ON agent_memory
  FOR ALL USING (auth.uid() = user_id);
```

---

### Step 2: Rewrite `src/hooks/useMemory.ts`

**Key changes:**

a. **Remove `createClient` calls** — import and use singleton `supabase` from `@/integrations/supabase/client`

b. **Inject `user` from `useAuthContext()`** — pass `user.id` to all DB operations (insert, update, and the composite index filter)

c. **Single-query `searchMemory`** — instead of keyword ILIKE + recency fallback (2 queries), fetch the top 15 records for this user ordered by `(quality_score DESC NULLS LAST, created_at DESC)` in ONE query, then do client-side relevance scoring:

```typescript
// Single query: composite index on (user_id, quality_score DESC, created_at DESC)
const { data } = await supabase
  .from("agent_memory")
  .select(SELECT)
  .eq("user_id", user.id)           // RLS + explicit filter
  .order("quality_score", { ascending: false, nullsFirst: false })
  .order("created_at", { ascending: false })
  .limit(15);                        // fetch candidate pool

// Client-side relevance ranking
const scored = (data ?? []).map(rowToItem).map((m) => ({
  ...m,
  _score: keywords.filter((k) => m.goal.toLowerCase().includes(k)).length,
}));
scored.sort((a, b) => b._score - a._score || (b.qualityScore ?? 0) - (a.qualityScore ?? 0));
return scored.slice(0, limit);
```

d. **Fix CJK keyword extraction** — change filter from `length > 3` to:
- ASCII/Latin words: `length > 2`  
- CJK-containing segments: `length >= 1` (CJK characters are 1 JS char each and already meaningful)

```typescript
const keywords = goal
  .toLowerCase()
  .split(/\s+/)
  .filter((w) => w.length > 0)
  .filter((w) => /[\u4e00-\u9fff]/.test(w) ? w.length >= 1 : w.length > 2)
  .slice(0, 8);
```

e. **Add `user_id` to `saveMemory` insert**

f. **Guard all operations**: if `!user`, return early (no-op) — don't try to save/search memory for unauthenticated users

---

### Step 3: No changes to `Index.tsx`

All call sites (`searchMemory`, `saveMemory`, `updateMemoryScore`) stay the same — the hook handles user_id internally via `useAuthContext`.

---

## Files to Modify

| File | Change |
|------|--------|
| DB migration (new) | Add `user_id` to `agent_memory`, fix RLS, add composite index |
| `src/hooks/useMemory.ts` | Singleton client, user isolation, single query, CJK keywords |

## Verification

1. Admin panel → Memories tab: check that each user only sees their own memories
2. Run agent → memory cards appear showing past relevant sessions from the same user
3. Switch to a different user account → confirm no cross-user memory leakage
4. Performance: network tab should show only 1 request to `agent_memory` per agent start (not 2)

# Harness Agent — Self-Evolution (Reflexion) Plan

## Context
"自我进化" implements the Reflexion pattern: after a run completes, the Agent reflects on its own output, scores quality, identifies weaknesses, and proposes specific improvements. The user can then trigger an "evolved" re-run where those insights are baked into the prompts — creating a genuine iterative improvement loop.

---

## User Flow

```
1. Run completes → "MISSION ACCOMPLISHED" + EVOLVE button appears
2. User clicks EVOLVE → Reflection phase runs (streaming critique)
3. Reflection shows: quality score, strengths, weaknesses, improvement directions
4. User clicks "APPLY EVOLUTION →" → Agent re-runs with reflection insights in prompts
5. New run completes with "Round 2" badge
6. Can repeat N times (max 5 rounds to prevent infinite loops)
```

---

## New Types

```typescript
// src/hooks/useHarnessAgent.ts additions

export interface ReflectionResult {
  qualityScore: number;          // 0–100
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  evolvedGoal: string;           // refined goal for next round
}

export type EvolutionStatus = "idle" | "reflecting" | "reflected";
```

---

## New Edge Function Mode: `reflect`

Input:
```json
{ "mode": "reflect", "goal": "...", "tasks": [...], "taskOutputs": {...} }
```

System prompt — asks LLM to return a **streaming** JSON-structured critique:
```
You are a critical AI evaluator. Analyze the completed agent run:
- Score overall quality (0-100)
- List 2-3 concrete strengths
- List 2-3 specific weaknesses or missed aspects
- Propose 2-3 actionable improvements for the next iteration
- Suggest a refined version of the original goal that captures what was missed

Respond ONLY in this JSON format (no markdown fences):
{
  "qualityScore": 75,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "improvements": ["..."],
  "evolvedGoal": "..."
}
```

Non-streaming call (single JSON response, not SSE).

---

## Evolution in Subsequent Runs

When `evolutionRound > 0`, add to plan/execute system prompts:
```
EVOLUTION CONTEXT (Round N):
Previous quality score: X/100
Improvements to apply:
- [improvement 1]
- [improvement 2]
Refined goal: [evolvedGoal]
```

---

## Files

### New
| File | Purpose |
|---|---|
| `src/components/agent/EvolutionPanel.tsx` | Reflection display + EVOLVE / APPLY buttons |

### Modified
| File | Change |
|---|---|
| `supabase/functions/harness-agent/index.ts` | Add `reflect` mode handler |
| `src/hooks/useHarnessAgent.ts` | Add `evolutionStatus`, `reflection`, `evolutionRound`, `evolve()`, `applyEvolution()` |
| `src/pages/Index.tsx` | Show `EvolutionPanel` below completion banner |
| `src/i18n/locales/en.json` + `zh.json` | Add `evolution.*` keys |

---

## `EvolutionPanel` Component

States:
1. **Idle** (status=done, evolutionStatus=idle) — show `[EVOLVE ↻]` button
2. **Reflecting** — show streaming spinner + "AGENT SELF-REFLECTING..."
3. **Reflected** — show:
   - Quality score ring (e.g. `74 / 100`)
   - Strengths (green bullet list)
   - Weaknesses (amber bullet list)
   - Improvements (primary bullet list)
   - Round badge: "Round 1 → Round 2"
   - `[APPLY EVOLUTION →]` button + `[DISMISS]`

---

## `useHarnessAgent` additions

```typescript
// New state
const [evolutionStatus, setEvolutionStatus] = useState<EvolutionStatus>("idle");
const [reflection, setReflection] = useState<ReflectionResult | null>(null);
const [evolutionRound, setEvolutionRound] = useState(0);

// New function: triggers reflection phase
const evolve = useCallback(async () => { ... }, [...]);

// New function: re-runs with reflection insights
const applyEvolution = useCallback(async (onComplete?) => { ... }, [...]);
```

`evolve()`:
1. `setEvolutionStatus("reflecting")`
2. Call edge function `reflect` mode (non-streaming fetch)
3. Parse JSON → `setReflection(result)`
4. `setEvolutionStatus("reflected")`

`applyEvolution(onComplete?)`:
1. `setEvolutionRound(r => r + 1)`
2. Calls `runAgent(reflection.evolvedGoal, outputMode, onComplete, { evolutionRound: r+1, reflection })`
3. The extra context is passed to the edge function so plan/execute prompts include it

---

## Edge Function Changes

Add `evolutionContext` to request body for plan/execute:
```json
{
  "mode": "plan",
  "goal": "...",
  "outputMode": "text",
  "evolutionContext": {
    "round": 2,
    "qualityScore": 74,
    "improvements": ["..."],
    "evolvedGoal": "..."
  }
}
```
When `evolutionContext` is present, prepend it to the system prompts.

---

## i18n Keys

```json
"evolution": {
  "evolveBtn": "EVOLVE",
  "reflecting": "AGENT SELF-REFLECTING...",
  "qualityScore": "QUALITY SCORE",
  "strengths": "STRENGTHS",
  "weaknesses": "WEAKNESSES",
  "improvements": "IMPROVEMENT DIRECTIONS",
  "applyBtn": "APPLY EVOLUTION",
  "dismissBtn": "DISMISS",
  "roundBadge": "Round {{from}} → Round {{to}}",
  "maxRounds": "Maximum evolution rounds reached (5)"
}
```

---

## Verification

1. Run any goal → completion banner + "EVOLVE" button visible
2. Click EVOLVE → "REFLECTING..." spinner shows, then report appears
3. Report shows quality score (0-100), 3 sections (strengths/weaknesses/improvements)
4. Click "APPLY EVOLUTION" → agent re-runs with Round 2 badge
5. New run uses evolved goal + improvements in prompts
6. Can repeat up to 5 rounds (button disabled after round 5)

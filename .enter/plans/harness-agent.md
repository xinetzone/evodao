# Harness Agent — History Feature Plan

## Context
User wants a history panel that records all completed sessions and allows reviewing past task outputs. UI: right slide-in panel with list view → detail view (drill-down, no modal).

---

## Data Structure

```typescript
// src/hooks/useAgentHistory.ts
interface HistoryEntry {
  id: string;                              // Date.now().toString()
  goal: string;
  tasks: Task[];
  taskOutputs: Record<number, string>;     // all completed outputs
  taskStatuses: Record<number, TaskStatus>;
  completedAt: number;                     // unix ms
}
```

- Storage key: `harness-agent-history`
- Max entries: **20** (oldest trimmed on overflow)

---

## Files

### New
| File | Purpose |
|---|---|
| `src/hooks/useAgentHistory.ts` | CRUD for history localStorage |
| `src/components/agent/HistoryPanel.tsx` | Slide-in panel (list + detail view) |

### Modified
| File | Change |
|---|---|
| `src/hooks/useHarnessAgent.ts` | Accept `onComplete` callback → caller saves to history |
| `src/pages/Index.tsx` | Wire `useAgentHistory`, pass `onComplete`, control panel open/close |
| `src/components/agent/AgentHeader.tsx` | Add History button with entry-count badge |
| `src/i18n/locales/en.json` | Add `history.*` keys |
| `src/i18n/locales/zh.json` | Add `history.*` keys |

---

## Implementation Details

### `useAgentHistory` hook
```typescript
{
  entries: HistoryEntry[];
  addEntry: (e: HistoryEntry) => void;   // prepends, trims to 20
  removeEntry: (id: string) => void;
  clearHistory: () => void;
}
```

### `useHarnessAgent` change
- Export `addHistoryEntry` as callback or expose a dedicated function.
- **Simplest approach**: add an optional `onComplete?: (entry: HistoryEntry) => void` parameter to `runAgent` and `resumeAgent`. Called right before `setStatus("done")`.

### `HistoryPanel`
Props: `open`, `onClose`, `entries`, `onClear`, `onRemove`

Two local states:
- `view: "list" | "detail"`
- `selected: HistoryEntry | null`

**List view**:
- Each row: truncated goal, `N tasks`, relative date ("2 hours ago")
- Hover row → highlight with `border-primary/30`
- Trash icon per row (delete single entry)
- "CLEAR ALL" button at bottom (only shown when entries > 0)

**Detail view**:
- Back button → returns to list
- Goal heading
- Task cards (same style as `TaskList`) — read-only status badges
- Expandable terminal output per task (same style as `TerminalOutput`)

### AgentHeader change
- Add `onHistoryOpen: () => void` and `historyCount: number` props
- History button: `<History />` icon + count badge (hidden when 0)
- Placed between status badge and LanguageSwitcher

### Index.tsx wiring
```tsx
const history = useAgentHistory();
const [historyOpen, setHistoryOpen] = useState(false);

// pass to runAgent / resumeAgent via onComplete callback
const handleRun = (goal: string) =>
  runAgent(goal, (entry) => history.addEntry(entry));
```

### i18n keys to add
```json
"history": {
  "title": "History",
  "empty": "No completed sessions yet",
  "tasks": "{{count}} tasks",
  "clearAll": "Clear All",
  "back": "Back",
  "completedAt": "Completed {{time}}",
  "deleteEntry": "Delete"
}
```

---

## Relative Time Helper
Simple inline helper (no dependency):
```typescript
function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
```
(Localized variant for Chinese: "X分钟前" etc.)

---

## Verification
1. Run a goal → on completion, history badge shows "1"
2. Open history panel → entry appears with goal, date, task count
3. Click entry → detail view shows all tasks and outputs
4. Back button → returns to list
5. Delete single entry → removed from list
6. Clear all → list empty, badge hidden
7. Max 20 entries enforced (oldest dropped on 21st)

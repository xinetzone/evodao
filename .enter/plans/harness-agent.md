# Prompt Suggestion Chips — Layout Redesign

## Context
Current layout: single horizontal scrolling row with `overflow-x-auto`.
- Shows only ~2-3 chips before requiring horizontal scroll
- `max-w-[200px]` + `s.slice(0, 42)` double-truncates text aggressively
- Right fade gradient covers last chip

User request: "保证质量和数量的平衡" — all suggestions visible + each chip readable.

## Approach: 2-column wrap grid

Replace single-row scroll with `grid grid-cols-2 gap-1.5`:
- All 4-5 suggestions rendered in 2 rows × 2 cols (no scroll)
- Each chip gets ~50% width → enough space for full text
- Remove manual `s.slice(0, 42)` — CSS `truncate` + `title` tooltip handles overflow
- Remove `overflow-x-auto`, `pr-10`, and right fade gradient
- Move label "推荐提示词" to its own line above the grid for visual clarity

## File: `src/components/agent/GoalInput.tsx` (lines 338–374)

### Before (simplified)
```tsx
<div className="relative mb-3 min-h-[26px]">
  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none pr-10">
    <span className="...label...">{label}</span>
    {activeSuggestions.map((s, i) => (
      <button ... className="... truncate max-w-[200px] sm:max-w-[240px]">
        {s.length > 42 ? s.slice(0, 42) + "…" : s}
      </button>
    ))}
  </div>
  {/* Right fade */}
  <div className="pointer-events-none absolute right-0 ..." />
</div>
```

### After
```tsx
<div className="mb-3">
  {/* Label row */}
  <div className="flex items-center gap-1.5 mb-1.5">
    <span className="text-[9px] text-muted-foreground tracking-widest font-bold shrink-0">
      {suggestionsAI ? (
        <span className="flex items-center gap-1 text-primary/50">
          <Sparkles className="w-2.5 h-2.5" /> {t("promptSuggestions.aiLabel")}
        </span>
      ) : t("promptSuggestions.label")}
    </span>
  </div>

  {/* Chips grid */}
  <div className="grid grid-cols-2 gap-1.5">
    {activeSuggestions.map((s, i) => (
      <button
        key={i}
        onClick={() => handleSuggestionClick(s)}
        disabled={isRunning}
        className="px-2.5 py-1 text-[10px] text-foreground/65 border border-border/60
                   rounded hover:border-primary/40 hover:text-foreground hover:bg-primary/5
                   transition-all duration-150 truncate text-left w-full"
        title={s}
      >
        {s}
      </button>
    ))}
  </div>
</div>
```

Loading state stays in the label row (spinner + text), chips grid is not rendered while loading.

## Verification
- In text mode (5 suggestions): 3 rows (2+2+1), last row chip spans full column (natural)
- In agent/qa/image mode (4 suggestions): 2 rows × 2, perfectly balanced
- All chips show full text with CSS truncation + tooltip on hover
- No horizontal scroll — everything visible at once

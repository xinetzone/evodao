# UI Polish: Felt Texture + Text Contrast Fix

## Context
Two separate issues:
1. Background needs a felt/fabric texture on top of the cream color
2. Several text elements in GoalInput use `/40` opacity that produces ~1.8:1 contrast on cream — unacceptable

---

## Part 1 — Felt Texture Background

### Technique
Pure CSS diagonal weave pattern applied as `background-image` on the body.
Classic felt/textile CSS: two overlapping repeating diagonal gradients at ±45°
produce a woven diamond pattern that mimics fabric fiber.

```css
body {
  background-color: hsl(var(--background));   /* cream base */
  background-image:
    repeating-linear-gradient(
      45deg,
      transparent 0px, transparent 3px,
      hsl(36 40% 55% / 0.06) 3px, hsl(36 40% 55% / 0.06) 4px
    ),
    repeating-linear-gradient(
      -45deg,
      transparent 0px, transparent 3px,
      hsl(36 40% 55% / 0.05) 3px, hsl(36 40% 55% / 0.05) 4px
    );
}
```

Cards and panels should have `background-color` only (no texture inheritance), so the texture stays on the body layer.

### Card Background Override
Add a CSS utility class `.card-solid` in index.css that explicitly sets a solid background to prevent texture showing through card elements incorrectly.

Actually, since cards use `bg-card` which translates to `background-color: hsl(var(--card))`, they naturally override the body's `background-image`. No special handling needed — `background-image` and `background-color` are separate CSS properties.

---

## Part 2 — Text Contrast Fixes in GoalInput

### Root cause
On cream background `hsl(46 80% 90%)`, muted-foreground `hsl(28 10% 42%)` at `/40` opacity gives effective contrast ~1.8:1.

### Lines to fix in `src/components/agent/GoalInput.tsx`

| Line | Current | Fixed | Reason |
|---|---|---|---|
| 204 | `text-muted-foreground/40` (hint text) | `text-muted-foreground/60` | Raise hint visibility |
| 348 | `text-muted-foreground/40` (推荐提示词 label) | `text-muted-foreground` (full opacity) | Label must be clearly readable |
| 363 | `text-muted-foreground/70` (chip text) | `text-foreground/65` | Chip text should use foreground for higher contrast |
| 453 | `placeholder:text-muted-foreground/40` | `placeholder:text-muted-foreground/55` | Slightly improve placeholder |

Also in `src/pages/Index.tsx`:

| Line | Current | Fixed |
|---|---|---|
| 484 | `text-muted-foreground/60` (standby desc) | `text-muted-foreground/80` |
| 494 | `text-primary/50` (STEP label) | `text-primary/70` |
| 497 | `text-foreground/70` (step label) | `text-foreground/80` |
| 500 | `text-muted-foreground/60` (step desc) | `text-muted-foreground/75` |

---

## Files to Modify

1. **`src/index.css`** — Add felt texture to `body` background-image
2. **`src/components/agent/GoalInput.tsx`** — Fix 4 opacity values
3. **`src/pages/Index.tsx`** — Fix 4 opacity values in idle hero section

---

## Verification
- "推荐提示词" label should be clearly visible on cream background
- Hint text ("// Enter 执行 · Shift+Enter 换行") should be readable
- Suggestion chips text should be legible
- Background should show subtle diagonal woven fiber pattern
- Cards (GoalInput box, etc.) should have solid background without texture showing through incorrectly

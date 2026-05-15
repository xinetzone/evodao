# Warm Dark Theme: "Amber Forge"

## Context
Current blue-navy theme lacks warmth and has contrast issues. User wants a visually beautiful warm-colored scheme.

## Design Direction
**"Amber Forge"** — Deep charcoal dark + rich amber/gold primary accent.
Inspired by: Raycast warm dark, Linear amber, premium dark editorial.

The amber primary creates a "digital alchemy" feeling — perfectly fitting an AI agent product. High contrast, warm, inviting, and premium-looking.

---

## Complete Color Palette

| Token | HSL | Hex (approx) | Role |
|---|---|---|---|
| `--background` | `22 18% 5%` | `#0e0b09` | Very dark warm charcoal |
| `--foreground` | `38 25% 93%` | `#edebe6` | Warm cream — not cold white |
| `--card` | `24 15% 9%` | `#191410` | Warm elevated surface |
| `--card-foreground` | `38 20% 90%` | `#e6e3dd` | Slightly warm card text |
| `--primary` | `38 95% 60%` | `#f5a01e` | Rich amber gold |
| `--primary-foreground` | `22 18% 5%` | `#0e0b09` | Dark on amber |
| `--secondary` | `25 12% 14%` | `#231d18` | Warm dark secondary |
| `--secondary-foreground` | `35 15% 74%` | `#bfb8ad` | Warm medium |
| `--muted` | `25 12% 11%` | `#1c1713` | Slightly elevated muted bg |
| `--muted-foreground` | `35 12% 64%` | `#a89f92` | Warm medium gray — 7:1 contrast |
| `--accent` | `18 90% 58%` | `#f07026` | Deep orange complement |
| `--accent-foreground` | `22 18% 5%` | `#0e0b09` | Dark on orange |
| `--destructive` | `0 72% 58%` | `#e84040` | Red |
| `--border` | `25 14% 18%` | `#2e2520` | Warm visible border |
| `--input` | `25 12% 14%` | `#231d18` | Input bg |
| `--ring` | `38 95% 60%` | `#f5a01e` | Focus ring = primary amber |
| `--radius` | `0.5rem` | — | Corner radius |

### Sidebar tokens (slightly darker base)
| Token | HSL |
|---|---|
| `--sidebar-background` | `22 20% 3%` |
| `--sidebar-foreground` | `35 18% 80%` |
| `--sidebar-primary` | `38 95% 60%` |
| `--sidebar-border` | `25 14% 15%` |

### Glow / Shadow / Gradient tokens
| Token | Value |
|---|---|
| `--neon-amber` | `38 95% 60%` |
| `--neon-amber-dim` | `38 70% 42%` |
| `--shadow-glow` | `0 0 20px hsl(38 95% 60% / 0.20)` |
| `--shadow-glow-strong` | `0 0 40px hsl(38 95% 60% / 0.38)` |
| `--shadow-card` | `0 4px 24px hsl(22 18% 2% / 0.60)` |
| `--gradient-hero` | `linear-gradient(135deg, hsl(38 95% 60% / 0.07) 0%, hsl(18 90% 58% / 0.03) 100%)` |
| `--gradient-card` | `linear-gradient(135deg, hsl(24 15% 10%) 0%, hsl(24 15% 8%) 100%)` |

### Keyframe colors
- `pulse-glow`: `hsl(38 95% 60% / 0.25)` → `hsl(38 95% 60% / 0.55)`
- `pulse-text-glow`: `text-shadow 6px hsl(38 95% 60% / 0.40)` → `18px / 0.80`

---

## WCAG Contrast Verification
| Element | Foreground | Background | Ratio | Pass |
|---|---|---|---|---|
| Body text | `#edebe6` | `#0e0b09` | ~17:1 | ✓ AAA |
| Muted text | `#a89f92` | `#0e0b09` | ~7:1 | ✓ AA |
| Primary amber | `#f5a01e` | `#0e0b09` | ~10:1 | ✓ AAA |
| Card text | `#e6e3dd` | `#191410` | ~12:1 | ✓ AAA |

---

## Files to Modify

### `src/index.css`
- Replace entire `:root` block with new warm amber tokens
- Rename `--neon-blue` → `--neon-amber` 
- Update all `hsl(217 100% ...)` references in utilities and keyframes to amber `hsl(38 95% 60%)`

### `tailwind.config.ts`
- Rename `neon.blue` → `neon.amber` color alias
- Update `pulse-glow` keyframe values to amber

### `src/pages/Index.tsx`
- Grid lines already use `hsl(var(--primary))` — no change needed ✓

---

## No Changes Needed
- All component files — they reference semantic tokens only
- i18n files — no change
- Layout / logic — no change

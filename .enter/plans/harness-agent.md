# UI Theme Overhaul

## Context
Current theme: harsh pure-green (`hsl(142 100% 50%)`) terminal hacker aesthetic on near-black background with monospace everywhere. Reference site (道衍) shows: clean card design, warm accent color, sans-serif body text, softer surface hierarchy, more breathing room.

Goal: Keep dark mode (fits the AI agent product), replace amateur pure-green with a sophisticated **deep navy + electric violet-blue** palette inspired by modern AI product design principles extracted from the reference.

---

## New Design Direction

| Token | Old | New | Reason |
|---|---|---|---|
| Background | 220 40% 4% (near-black) | 224 38% 4% (deep navy-black) | Subtle warmth |
| Foreground | 142 100% 72% (pure green!) | 220 15% 90% (clean off-white) | No more green body text |
| Primary | 142 100% 50% (pure #00ff00) | 217 100% 64% (electric blue) | Sophisticated, premium |
| Card | 220 35% 7% | 224 32% 7% | Depth maintained |
| Muted foreground | 220 20% 50% | 220 12% 52% | Less saturated |
| Border | 220 25% 16% | 224 22% 16% | Consistent palette |
| Shadow glow | green | blue | Match new primary |
| Body font | `font-mono` everywhere | `font-sans` body + `font-mono` code-only | Match reference's typographic hierarchy |

Secondary accent: keep `text-yellow-400` for planning/warning states (intentional semantic).

---

## Files to Change

### 1. `src/index.css` (primary change)
- New `:root` tokens: background, foreground, card, primary, secondary, muted, accent, border, ring
- Update sidebar tokens to match
- Update terminal-specific tokens (`--terminal-green` → `--neon-blue`)
- Update utility classes: `.terminal-glow`, `.text-glow`, `.border-glow` to use new primary
- Update `@keyframes pulse-glow`, `pulse-text-glow` keyframe colors
- Update `body`: remove `font-mono`, use `font-sans`; monospace only via explicit `font-mono` class
- Add new design tokens: `--gradient-hero`, `--shadow-card`, richer card gradient

### 2. `tailwind.config.ts`
- Add `sans` font family: `['Inter', 'system-ui', 'sans-serif']` as default
- Update keyframe colors: `pulse-glow` uses new primary blue (not hardcoded `hsl(142...)`)
- Add `neon` color alias pointing to new primary token

### 3. `src/pages/Index.tsx` (one-line fix)
- Grid lines decoration hardcodes `hsl(142 100% 50%)` → replace with `hsl(var(--primary))`

### 4. `tailwind.config.ts`
- `pulse-glow` keyframe: replace `142 100% 50%` with `var(--primary)` approach

---

## New Palette (exact HSL values)

```css
/* Dark navy background */
--background: 224 38% 4%;
--foreground: 220 15% 90%;

/* Cards with depth */
--card: 224 32% 7%;
--card-foreground: 220 12% 85%;

/* Electric blue primary */
--primary: 217 100% 64%;
--primary-foreground: 224 38% 4%;

/* Muted surfaces */
--secondary: 224 25% 11%;
--secondary-foreground: 220 12% 65%;
--muted: 224 25% 9%;
--muted-foreground: 220 12% 52%;

/* Accent: violet for variety */
--accent: 258 90% 68%;
--accent-foreground: 224 38% 4%;

/* Utility */
--destructive: 0 70% 55%;
--border: 224 22% 16%;
--input: 224 25% 11%;
--ring: 217 100% 64%;
--radius: 0.5rem;

/* New semantic tokens */
--neon-blue: 217 100% 64%;
--neon-blue-dim: 217 60% 42%;
--shadow-glow: 0 0 20px hsl(217 100% 64% / 0.25);
--shadow-glow-strong: 0 0 40px hsl(217 100% 64% / 0.45);
--gradient-terminal: linear-gradient(180deg, hsl(224 38% 5%) 0%, hsl(224 38% 4%) 100%);
--gradient-card: linear-gradient(135deg, hsl(224 32% 8%) 0%, hsl(224 32% 6%) 100%);
--shadow-card: 0 4px 24px hsl(224 38% 2% / 0.6);
```

---

## Verification
1. Check header: logo badge, status pill, token badge all use blue not green
2. Check GoalInput: execute button primary color = blue
3. Check idle hero: concentric rings use blue primary
4. Check footer: pulse dot uses blue
5. Check PlatformPanel: OK badge is blue
6. Verify body text is NOT green – should be near-white
7. Verify terminal output areas retain `font-mono` class (they use explicit mono classes)
8. Check Auth page for any hardcoded green

---

## Non-changes
- Component logic: zero changes
- i18n: zero changes
- Layout structure: zero changes
- Yellow warning states: unchanged (semantic yellow is intentional)
- Red destructive states: unchanged

# Mobile UI Optimization Plan

## Context
Screenshot shows three mobile rendering problems:
1. **ModelSelector dropdown clips on left** — items render as "laude Opus 4.7" (missing "C"), "PT-5.4" (missing "G"), "eepSeek" (missing "De"). The portal `right` position isn't clamped, causing the left edge to overflow the viewport on narrow screens.
2. **Header toolbar overflow** — too many buttons (status, task manager, history, platforms, lang switcher, user menu) crammed into ~280px on mobile.
3. **GoalInput mode row tight** — mode tabs + model selector fight for space, suggestions row overflows horizontally.

---

## Fix 1 — ModelSelector: Viewport-clamped portal position
**File**: `src/components/agent/ModelSelector.tsx`

Current `useEffect`:
```
right: window.innerWidth - rect.right   // can cause left overflow
width: 220px (hardcoded className)
```

New logic — clamp so `leftEdge >= 8px`:
```typescript
const vw = window.innerWidth;
const width = Math.min(220, vw - 16);           // shrink on very narrow screens
const idealRight = vw - rect.right;
const leftEdge = vw - idealRight - width;
const right = leftEdge < 8 ? Math.max(0, vw - width - 8) : idealRight;
setDropdownPos({ top: rect.bottom + 6, right, width });
```

Also update `dropdownPos` type to include `width?: number`.
Portal div: move `width` from Tailwind class into `style={{ ..., width: dropdownPos.width ?? 220 }}`, remove `w-[220px]` className.

---

## Fix 2 — AgentHeader: Collapse toolbar on mobile
**File**: `src/components/agent/AgentHeader.tsx`

### 2a — Platforms button: hide from toolbar on mobile
```tsx
// Add hidden sm:flex to the Platforms button wrapper
<button className="hidden sm:flex items-center gap-1.5 ...">
```
On mobile, Platforms is accessible from the user dropdown instead (see 2b).

### 2b — Move Language toggle + Platforms into user dropdown on mobile
Add two items inside the user dropdown (visible only on mobile with `sm:hidden`):
- Language toggle row (zh/en switch)
- Platforms menu item (calls `onPlatformOpen`)

`AgentHeader` needs to receive `onPlatformOpen` prop (already added).

### 2c — Reduce icon button padding on mobile
For task manager, history buttons:
```
px-2 sm:px-2.5 → px-1.5 sm:px-2.5
```

### 2d — LanguageSwitcher: hide on mobile, show only in user dropdown
```tsx
<div className="hidden sm:flex ...">   // wrap LanguageSwitcher
```
Add language toggle directly in user dropdown for mobile (sm:hidden section).

---

## Fix 3 — GoalInput: Mode tabs compact on mobile
**File**: `src/components/agent/GoalInput.tsx`

### 3a — Mode tab labels: truncate on xs
Use abbreviated labels on mobile:
- 任务模式 → 任务 (mobile) / 任务模式 (sm+)
- 构建模式 → 构建
- 探索问答 → 问答
- 图像生成 → 图像

Implementation: wrap in `<span className="hidden sm:inline">模</span>` pattern, or check `i18n.language` for a short label.

### 3b — Mode row layout
Ensure mode pill + model selector wrap cleanly:
```tsx
// Currently: flex items-center gap-1.5 sm:gap-2 flex-wrap
// Add: items-start to avoid vertical misalignment when wrapping
className="flex items-start gap-1.5 sm:gap-2 flex-wrap"
```

### 3c — Suggestion chips scroll hint
Add `scrollbar-thin` or a right-fade gradient to hint overflow:
```tsx
<div className="relative">
  <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none ...">
  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/80 pointer-events-none" />
</div>
```

---

## Files to modify
1. `src/components/agent/ModelSelector.tsx` — viewport clamping (critical)
2. `src/components/agent/AgentHeader.tsx` — collapse toolbar + move lang/platforms to dropdown
3. `src/components/agent/GoalInput.tsx` — compact mode tabs + suggestions UX

---

## Verification
- Viewport at 375px: ModelSelector dropdown should open fully visible (left edge ≥ 8px from viewport)
- Header at 375px: Only [status] [task-mgr] [history] [lang switcher hidden] [user] visible — total fits
- Mode tabs at 375px: show abbreviated labels, wrap cleanly to second line
- User dropdown includes language toggle on mobile

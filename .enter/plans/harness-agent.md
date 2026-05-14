# Mobile UI Optimization Plan

## Context
The app is a desktop-first AI agent interface. On mobile (≤375px), several areas overflow or are hard to use:
1. **AgentHeader** – `px-6` too wide, right-side has 5+ buttons crammed together
2. **GoalInput** – Top control row: 4 mode pills + model selector + intent button doesn't fit on one line on small screens (~480px+ needed)
3. **Index.tsx** – main `px-6 py-8` not reduced for mobile
4. **Footer** – `px-6` both sides, content may overflow
5. **HistoryPanel** – Delete button uses `group-hover:opacity-0/100` — touch devices can't hover, delete is inaccessible
6. **Resume banner** – action buttons may overflow on narrow screens

## Files to Change
- `src/components/agent/AgentHeader.tsx`
- `src/components/agent/GoalInput.tsx`
- `src/components/agent/HistoryPanel.tsx`
- `src/pages/Index.tsx`

## Specific Changes

### 1. AgentHeader.tsx
- Padding: `px-6` → `px-3 sm:px-6`
- Gap: `gap-3` → `gap-2 sm:gap-3`
- Logo subtitle: `hidden xs:block` → `hidden sm:block` (already has `p` below `h1`, wrap in `hidden sm:block`)
- Status badge: on xs show only icon, hide text — add `hidden xs:inline sm:inline` to text span
- Token badge: already `hidden sm:flex`, keep as is
- User email: already `hidden sm:block`, keep as is

### 2. GoalInput.tsx
- **Top control row**: Change from `flex items-center justify-between mb-3` to `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3`
- **Controls sub-row** (mode pills + model selector): `flex items-center gap-2 flex-wrap sm:flex-nowrap`
- Mode pill buttons: `px-2 py-0.5 sm:px-2.5 sm:py-1` (slightly smaller on mobile)
- **Suggestion chips row**: on mobile, limit horizontal scrolling: `flex items-center gap-1.5 flex-wrap mb-3 min-h-[26px] overflow-x-auto`
- Bottom toolbar: already `flex items-center justify-between`, just ensure buttons don't overflow — `flex-wrap gap-2`
- Optimize + Reset + Run buttons: add `flex-wrap` to container

### 3. HistoryPanel.tsx
- Delete button: change `opacity-0 group-hover:opacity-100` to `opacity-60 sm:opacity-0 sm:group-hover:opacity-100` so it's always visible on mobile/touch

### 4. Index.tsx
- Main content div: `px-6 py-8` → `px-4 sm:px-6 py-6 sm:py-8`
- Footer: `px-6` → `px-4 sm:px-6`
- Resume banner buttons: `flex-col sm:flex-row` gap for action buttons on xs

## Verification
- Resize browser to 375px width — no horizontal scroll
- Header: logo + status + user avatar visible, no overflow
- GoalInput: mode pills stack below prompt label on xs, flow naturally
- Suggestion chips wrap instead of overflow
- History panel: delete button visible on mobile without hovering
- Resume banner: buttons don't overflow

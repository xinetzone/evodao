# Plan: Fix Panel Rendering via createPortal

## Context
The root page element has `overflow: hidden` (`<div className="w-full h-full flex flex-col bg-background overflow-hidden">`), which creates a stacking context. All `fixed`-positioned panels rendered inside this container are trapped within its bounds — their backdrop and translate animations don't escape the container. Only `PromptLibraryModal` and `ModelSelector` already apply the fix (`createPortal(…, document.body)`).

The screenshot shows `UsagePanel`'s backdrop not covering the full viewport and the panel's z-index fighting with other stacking layers.

## Affected files

| File | Component |
|------|-----------|
| `src/components/agent/UsagePanel.tsx` | `fixed` backdrop + panel |
| `src/components/agent/HistoryPanel.tsx` | `fixed` backdrop + panel |
| `src/components/agent/TaskManagerPanel.tsx` | `fixed` backdrop + panel |
| `src/components/agent/PlatformPanel.tsx` | `fixed` backdrop + panel |
| `src/components/agent/HelpModal.tsx` | `fixed` modal |
| `src/components/agent/AgentWorldModal.tsx` | `fixed` modal |

## Fix per file

For each file:
1. Add `import { createPortal } from "react-dom";` (if not present)
2. Wrap the returned JSX with `createPortal(<JSX>, document.body)`
3. Guard with `if (!open) return null` before the portal

Pattern (already proven in PromptLibraryModal):
```tsx
import { createPortal } from "react-dom";

export function SomePanel({ open, onClose }) {
  if (!open) return null;
  return createPortal(
    <> {/* backdrop + panel JSX */} </>,
    document.body
  );
}
```

## Notes
- All panels already return `null` when `!open` — just move that guard before the portal
- No z-index changes needed; existing z-40/z-50 values are correct once portal is used
- No layout or style changes — pure structural fix

## Verification
- Open each panel, confirm backdrop covers full viewport
- Close each panel, confirm no visual artifacts remain
- Run lint — expect 0 errors

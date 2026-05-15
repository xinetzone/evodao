# Plan: Enlarge GoalInput Font Sizes

## Context
Screenshot shows all secondary text in the main input area is too small to read comfortably. The culprit is the extensive use of `text-[9px]` and `text-[10px]` custom sizes throughout `GoalInput.tsx`. The main textarea itself uses `text-sm` (14px) and is fine; everything around it is too small.

## Scope
**File: `src/components/agent/GoalInput.tsx` only** — header sizes are acceptable.

## Size Mapping

| Current | → New | Tailwind equiv |
|---------|-------|----------------|
| `text-[9px]`  | `text-[11px]` | ~22% larger |
| `text-[10px]` | `text-xs`     | 12px, ~20% larger |

## Affected Elements

| Line(s) | Element |
|---------|---------|
| 218 | Intent auto-detect button label |
| 239 | Mode toggle pills (任务模式/构建模式/探索问答/图像生成) |
| 271 | Image model name in selector button |
| 280 | Image model dropdown section header |
| 288 | Image model dropdown items |
| 315, 320, 325 | Mode hint text below pills |
| 334 | Intent detection reason badge |
| 343 | Suggestion loading indicator |
| 351 | "推荐提示词" section label |
| 364 | "提示词库" library picker button |
| 379 | Suggestion chip text |
| 397 | Attachment preview chip text |
| 482 | "附件" attach button |
| 500 | Char counter / "等待输入" hint |
| 515 | Optimize (优化) button |

## Implementation
Single-pass edit of `GoalInput.tsx`:
- Replace all `text-[9px]` → `text-[11px]`
- Replace all `text-[10px]` → `text-xs`
- Use `replace_all: true` for each substitution

## Verification
- Run lint — expect 0 errors
- Preview should show suggestion chips, mode pills, labels all ~20% larger
